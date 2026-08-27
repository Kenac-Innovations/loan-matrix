import { NextRequest, NextResponse } from "next/server";
import {
  lookupUssdUserByPhone,
  normalizeUssdPhoneNumber,
} from "@/lib/ussd-admin-client";
import {
  requireUssdClientDetailsAccess,
  requireUssdServiceTenantId,
  UssdClientDetailsAccessError,
} from "@/lib/ussd-client-details-access";

function errorResponse(error: unknown) {
  if (error instanceof UssdClientDetailsAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("USSD client details lookup failed:", error);
  return NextResponse.json(
    { error: "Failed to search USSD client" },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireUssdClientDetailsAccess();
    const ussdServiceTenantId = requireUssdServiceTenantId(access.tenant);
    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get("phoneNumber") ?? "";
    const normalizedPhoneNumber = normalizeUssdPhoneNumber(phoneNumber);

    if (!normalizedPhoneNumber || normalizedPhoneNumber.length < 9) {
      return NextResponse.json(
        { error: "Enter a valid phone number" },
        { status: 400 }
      );
    }

    const user = await lookupUssdUserByPhone({
      phoneNumber: normalizedPhoneNumber,
      ussdServiceTenantId,
    });

    if (!user) {
      return NextResponse.json(
        { error: "USSD client not found" },
        { status: 404 }
      );
    }

    if (!user.externalId || user.externalId <= 0) {
      return NextResponse.json(
        { error: "The matched USSD client is not linked to a Fineract client" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      user: {
        userId: user.userId,
        fullName: user.fullName,
        externalId: user.externalId,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
