import { NextRequest, NextResponse } from "next/server";
import { getMfaChallengeSummary, MfaChallengeError } from "@/lib/mfa";
import { requireCurrentTenant } from "@/lib/user-login-service";

export async function GET(request: NextRequest) {
  try {
    const challengeId = request.nextUrl.searchParams.get("challengeId")?.trim();

    if (!challengeId) {
      return NextResponse.json(
        { success: false, error: "Challenge ID is required" },
        { status: 400 }
      );
    }

    const tenant = await requireCurrentTenant();
    const challenge = await getMfaChallengeSummary(tenant.id, challengeId);

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

    console.error("Error fetching MFA challenge:", error);
    return NextResponse.json(
      { success: false, error: "Unable to fetch verification challenge" },
      { status: 500 }
    );
  }
}
