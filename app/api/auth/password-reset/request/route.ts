import { NextRequest, NextResponse } from "next/server";
import {
  PasswordResetError,
  requestPasswordReset,
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
    const username = typeof body.username === "string" ? body.username.trim() : "";

    if (!username) {
      return NextResponse.json(
        { success: false, error: "Username is required" },
        { status: 400 }
      );
    }

    const tenant = await requireCurrentTenant();
    const result = await requestPasswordReset({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSettings: tenant.settings,
      username,
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

    console.error("Error requesting password reset:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Unable to start password reset. Please try again.",
      },
      { status: 500 }
    );
  }
}
