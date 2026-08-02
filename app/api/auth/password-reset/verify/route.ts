import { NextRequest, NextResponse } from "next/server";
import {
  PasswordResetError,
  verifyPasswordResetCode,
} from "@/lib/password-reset";
import { requireCurrentTenant } from "@/lib/user-login-service";

function getRequestContext(request: NextRequest) {
  return {
    requestIp:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null,
    userAgent: request.headers.get("user-agent"),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const challengeId =
      typeof body.challengeId === "string" ? body.challengeId.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!challengeId || !code) {
      return NextResponse.json(
        { success: false, error: "Challenge ID and verification code are required" },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: "Verification code must be exactly 6 digits" },
        { status: 400 }
      );
    }

    const tenant = await requireCurrentTenant();
    const result = await verifyPasswordResetCode({
      tenantId: tenant.id,
      challengeId,
      code,
      context: getRequestContext(request),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof PasswordResetError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }

    console.error("Error verifying password reset code:", error);
    return NextResponse.json(
      { success: false, error: "Unable to verify password reset code" },
      { status: 500 }
    );
  }
}
