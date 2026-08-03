import { NextRequest, NextResponse } from "next/server";
import {
  completePasswordReset,
  PasswordResetError,
  validatePassword,
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
    const verificationToken =
      typeof body.verificationToken === "string"
        ? body.verificationToken.trim()
        : "";
    const password = typeof body.password === "string" ? body.password : "";
    const repeatPassword =
      typeof body.repeatPassword === "string" ? body.repeatPassword : "";

    if (!challengeId || !verificationToken || !password || !repeatPassword) {
      return NextResponse.json(
        {
          success: false,
          error: "Verification and both password fields are required",
        },
        { status: 400 }
      );
    }

    if (password !== repeatPassword) {
      return NextResponse.json(
        { success: false, error: "Passwords do not match" },
        { status: 400 }
      );
    }

    const validation = validatePassword(password);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Password does not meet the requirements",
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const tenant = await requireCurrentTenant();
    const result = await completePasswordReset({
      tenantId: tenant.id,
      challengeId,
      verificationToken,
      password,
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

    console.error("Error completing password reset:", error);
    return NextResponse.json(
      { success: false, error: "Unable to complete password reset" },
      { status: 500 }
    );
  }
}
