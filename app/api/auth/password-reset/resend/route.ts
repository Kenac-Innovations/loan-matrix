import { NextRequest, NextResponse } from "next/server";
import {
  PasswordResetError,
  resendPasswordResetCode,
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

    if (!challengeId) {
      return NextResponse.json(
        { success: false, error: "Challenge ID is required" },
        { status: 400 }
      );
    }

    const tenant = await requireCurrentTenant();
    const result = await resendPasswordResetCode({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSettings: tenant.settings,
      challengeId,
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

    console.error("Error resending password reset code:", error);
    return NextResponse.json(
      { success: false, error: "Unable to resend password reset code" },
      { status: 500 }
    );
  }
}
