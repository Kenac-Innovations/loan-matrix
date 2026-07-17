import { NextRequest, NextResponse } from "next/server";
import {
  lookupUssdUserByPhone,
  normalizeUssdPhoneNumber,
} from "@/lib/ussd-admin-client";
import {
  requireUssdPinResetAccess,
  requireUssdServiceTenantId,
  UssdPinResetAccessError,
} from "@/lib/ussd-pin-reset-access";

function errorResponse(error: unknown) {
  if (error instanceof UssdPinResetAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("USSD PIN reset lookup failed:", error);
  return NextResponse.json(
    { error: "Failed to search USSD user" },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireUssdPinResetAccess();
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
        { error: "USSD user not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
