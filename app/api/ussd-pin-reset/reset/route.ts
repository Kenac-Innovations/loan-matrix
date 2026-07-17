import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  lookupUssdUserByPhone,
  normalizeUssdPhoneNumber,
  resetUssdPin,
} from "@/lib/ussd-admin-client";
import {
  requireUssdPinResetAccess,
  UssdPinResetAccessError,
} from "@/lib/ussd-pin-reset-access";

type ResetBody = {
  phoneNumber?: unknown;
  reason?: unknown;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function errorResponse(error: unknown) {
  if (error instanceof UssdPinResetAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("USSD PIN change request failed:", error);
  return NextResponse.json(
    { error: "Failed to require USSD PIN change" },
    { status: 500 }
  );
}

export async function POST(request: NextRequest) {
  let logId: string | null = null;

  try {
    const access = await requireUssdPinResetAccess();
    const body = (await request.json().catch(() => ({}))) as ResetBody;
    const phoneNumber = cleanString(body.phoneNumber);
    const reason = cleanString(body.reason);
    const normalizedPhoneNumber = normalizeUssdPhoneNumber(phoneNumber);

    if (!normalizedPhoneNumber || normalizedPhoneNumber.length < 9) {
      return NextResponse.json(
        { error: "Enter a valid phone number" },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { error: "PIN change reason is required" },
        { status: 400 }
      );
    }

    const user = await lookupUssdUserByPhone(normalizedPhoneNumber);

    if (!user) {
      const notFoundLog = await prisma.ussdPinResetLog.create({
        data: {
          tenantId: access.tenant.id,
          phoneNumber: normalizedPhoneNumber,
          actorUserId: access.actorUserId,
          actorName: access.actorName,
          reason,
          status: "NOT_FOUND",
          errorMessage: "USSD user not found",
          completedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          error: "USSD user not found",
          logId: notFoundLog.id,
        },
        { status: 404 }
      );
    }

    const log = await prisma.ussdPinResetLog.create({
      data: {
        tenantId: access.tenant.id,
        phoneNumber: user.phoneNumber || normalizedPhoneNumber,
        ussdUserId: user.userId,
        clientName: user.fullName,
        nationalIdMask: user.nationalIdMask,
        actorUserId: access.actorUserId,
        actorName: access.actorName,
        reason,
        status: "PENDING",
      },
    });
    logId = log.id;

    const resetResult = await resetUssdPin({
      phoneNumber: user.phoneNumber || normalizedPhoneNumber,
      actorUserId: access.actorUserId,
      actorName: access.actorName,
      reason,
    });

    const finalStatus =
      resetResult.status || (resetResult.success ? "FLAGGED" : "FAILED");

    await prisma.ussdPinResetLog.update({
      where: {
        id: log.id,
      },
      data: {
        status: finalStatus,
        ussdStatus: resetResult.status,
        responseMessage: resetResult.message,
        completedAt: new Date(),
      },
    });

    const responseStatus = resetResult.success ? 200 : 400;

    return NextResponse.json(
      {
        success: resetResult.success,
        status: finalStatus,
        message: resetResult.message,
        resetRequired: resetResult.resetRequired,
        pinChanged: resetResult.pinChanged,
        smsAccepted: resetResult.smsAccepted,
        user: {
          userId: user.userId,
          fullName: user.fullName,
          nationalIdMask: user.nationalIdMask,
          phoneNumber: user.phoneNumber,
        },
        logId: log.id,
      },
      { status: responseStatus }
    );
  } catch (error) {
    if (logId) {
      await prisma.ussdPinResetLog.update({
        where: {
          id: logId,
        },
        data: {
          status: "FAILED",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown PIN change request failure",
          completedAt: new Date(),
        },
      });
    }

    return errorResponse(error);
  }
}
