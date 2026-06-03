import { NextRequest, NextResponse } from "next/server";
import { MfaChallengeError, resendMfaChallenge } from "@/lib/mfa";
import { requireCurrentTenant } from "@/lib/user-login-service";

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
    const challenge = await resendMfaChallenge(tenant.id, challengeId);

    return NextResponse.json({
      success: true,
      challenge,
    });
  } catch (error) {
    if (error instanceof MfaChallengeError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }

    console.error("Error resending MFA challenge:", error);
    return NextResponse.json(
      { success: false, error: "Unable to resend verification code" },
      { status: 500 }
    );
  }
}
