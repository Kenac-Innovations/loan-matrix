import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import {
  formatMobileForFineract,
  getNumericPhoneValidationError,
  isAfricanCountryDialCode,
} from "@/lib/phone-utils";
import { prisma } from "@/lib/prisma";
import {
  lookupUssdUserByPhone,
  normalizeUssdPhoneNumber,
} from "@/lib/ussd-admin-client";
import { updateUssdClientPhone } from "@/lib/ussd-client-sync";
import {
  requireUssdClientDetailsAccess,
  requireUssdServiceTenantId,
  UssdClientDetailsAccessError,
} from "@/lib/ussd-client-details-access";

type UpdatePhoneBody = {
  sourcePhoneNumber?: unknown;
  countryCode?: unknown;
  phoneNumber?: unknown;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function errorResponse(error: unknown) {
  if (error instanceof UssdClientDetailsAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("USSD client phone update failed:", error);
  return NextResponse.json(
    { error: "Failed to update the USSD client phone number" },
    { status: 500 }
  );
}

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function POST(request: NextRequest) {
  let logId: string | null = null;
  let ussdUpdateCompleted = false;

  try {
    const access = await requireUssdClientDetailsAccess();
    const ussdServiceTenantId = requireUssdServiceTenantId(access.tenant);
    const body = (await request.json().catch(() => ({}))) as UpdatePhoneBody;
    const sourcePhoneNumber = normalizeUssdPhoneNumber(
      cleanString(body.sourcePhoneNumber)
    );
    const countryCode = cleanString(body.countryCode);
    const phoneNumber = cleanString(body.phoneNumber);

    if (!sourcePhoneNumber || sourcePhoneNumber.length < 9) {
      return NextResponse.json(
        { error: "Enter a valid current USSD phone number" },
        { status: 400 }
      );
    }

    if (!isAfricanCountryDialCode(countryCode)) {
      return NextResponse.json(
        { error: "Select a valid African country code" },
        { status: 400 }
      );
    }

    const phoneValidationError = getNumericPhoneValidationError(phoneNumber);
    if (phoneValidationError || !phoneNumber) {
      return NextResponse.json(
        { error: phoneValidationError || "Enter a valid new phone number" },
        { status: 400 }
      );
    }

    const requestedPhoneNumber = formatMobileForFineract(
      phoneNumber,
      countryCode
    );

    const user = await lookupUssdUserByPhone({
      phoneNumber: sourcePhoneNumber,
      ussdServiceTenantId,
    });

    if (!user) {
      const log = await prisma.ussdClientInfoUpdateLog.create({
        data: {
          tenantId: access.tenant.id,
          sourcePhoneNumber,
          requestedPhoneNumber,
          actorUserId: access.actorUserId,
          actorName: access.actorName,
          status: "NOT_FOUND",
          errorMessage: "USSD client not found",
          completedAt: new Date(),
        },
      });

      return NextResponse.json(
        { error: "USSD client not found", logId: log.id },
        { status: 404 }
      );
    }

    if (!user.externalId || user.externalId <= 0) {
      const log = await prisma.ussdClientInfoUpdateLog.create({
        data: {
          tenantId: access.tenant.id,
          sourcePhoneNumber: user.phoneNumber || sourcePhoneNumber,
          requestedPhoneNumber,
          ussdUserId: user.userId,
          clientName: user.fullName,
          actorUserId: access.actorUserId,
          actorName: access.actorName,
          status: "FINERACT_CLIENT_NOT_LINKED",
          errorMessage: "The matched USSD client is not linked to a Fineract client",
          completedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          error: "The matched USSD client is not linked to a Fineract client",
          logId: log.id,
        },
        { status: 422 }
      );
    }

    const log = await prisma.ussdClientInfoUpdateLog.create({
      data: {
        tenantId: access.tenant.id,
        sourcePhoneNumber: user.phoneNumber || sourcePhoneNumber,
        requestedPhoneNumber,
        ussdUserId: user.userId,
        fineractClientId: user.externalId,
        clientName: user.fullName,
        actorUserId: access.actorUserId,
        actorName: access.actorName,
        status: "PENDING",
      },
    });
    logId = log.id;

    const ussdResult = await updateUssdClientPhone({
      ussdServiceTenantId,
      externalId: user.externalId,
      currentPhoneNumber: user.phoneNumber || sourcePhoneNumber,
      newPhoneNumber: requestedPhoneNumber,
    });

    if (!ussdResult.success || ussdResult.primaryPhoneUpdated !== true) {
      await prisma.ussdClientInfoUpdateLog.update({
        where: { id: log.id },
        data: {
          status:
            ussdResult.status || "USSD_PRIMARY_PHONE_UPDATE_UNCONFIRMED",
          ussdStatus: ussdResult.status,
          errorMessage:
            ussdResult.message ||
            "USSD did not confirm that the approved primary phone was updated",
          completedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          error:
            ussdResult.message ||
            "USSD did not confirm the primary phone update",
          status: ussdResult.status,
          logId: log.id,
        },
        { status: 400 }
      );
    }

    ussdUpdateCompleted = true;
    await fetchFineractAPI(`/clients/${user.externalId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mobileNo: requestedPhoneNumber,
        dateFormat: "yyyy-MM-dd",
        locale: "en",
      }),
      authMode: "service",
    });

    const fineractClient = (await fetchFineractAPI(`/clients/${user.externalId}`, {
      authMode: "service",
    })) as { mobileNo?: string | null };
    const verifiedPhoneNumber = formatMobileForFineract(
      fineractClient.mobileNo ?? "",
      countryCode
    );

    if (verifiedPhoneNumber !== requestedPhoneNumber) {
      throw new Error("Fineract did not confirm the updated client phone number");
    }

    await prisma.ussdClientInfoUpdateLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCESS",
        ussdStatus: ussdResult.status,
        fineractStatus: "UPDATED",
        responseMessage: "USSD and Fineract phone numbers updated successfully",
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "USSD and Loan Matrix client phone numbers were updated successfully",
      phoneNumber: requestedPhoneNumber,
      logId: log.id,
    });
  } catch (error) {
    if (logId) {
      const errorMessage = messageFromError(
        error,
        "Unknown USSD client phone update failure"
      );
      await prisma.ussdClientInfoUpdateLog.update({
        where: { id: logId },
        data: {
          status: ussdUpdateCompleted ? "FINERACT_SYNC_FAILED" : "USSD_FAILED",
          fineractStatus: ussdUpdateCompleted ? "FAILED" : "NOT_ATTEMPTED",
          errorMessage,
          completedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          error: ussdUpdateCompleted
            ? "USSD was updated, but the Loan Matrix client phone could not be synchronized"
            : errorMessage,
          logId,
        },
        { status: 502 }
      );
    }

    return errorResponse(error);
  }
}
