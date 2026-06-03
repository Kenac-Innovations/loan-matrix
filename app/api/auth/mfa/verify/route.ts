import { NextRequest, NextResponse } from "next/server";
import { MfaChallengeError, verifyMfaChallengeCode } from "@/lib/mfa";
import { requireCurrentTenant } from "@/lib/user-login-service";
import { MFA_CODE_LENGTH, MFA_CODE_PATTERN } from "@/shared/constants/mfa";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const challengeId =
      typeof body.challengeId === "string" ? body.challengeId.trim() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!challengeId || !code) {
      return NextResponse.json(
        {
          success: false,
          error: "Challenge ID and verification code are required",
        },
        { status: 400 }
      );
    }

    if (!MFA_CODE_PATTERN.test(code)) {
      return NextResponse.json(
        {
          success: false,
          error: `Verification code must be exactly ${MFA_CODE_LENGTH} digits`,
        },
        { status: 400 }
      );
    }

    const tenant = await requireCurrentTenant();
    const verification = await verifyMfaChallengeCode({
      tenantId: tenant.id,
      challengeId,
      code,
    });

    return NextResponse.json({
      success: true,
      ...verification,
    });
  } catch (error) {
    if (error instanceof MfaChallengeError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          ...(error.details ?? {}),
        },
        { status: error.status }
      );
    }

    console.error("Error verifying MFA challenge:", error);
    return NextResponse.json(
      { success: false, error: "Unable to verify the MFA code" },
      { status: 500 }
    );
  }
}
