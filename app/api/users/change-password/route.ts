import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  fetchFineractAPIWithCredentials,
  getFineractErrorStatus,
  isFineractCommandPendingApproval,
} from "@/lib/api";
import {
  authenticateWithFineractCredentials,
  FineractAuthenticationError,
} from "@/lib/fineract-auth";
import { PASSWORD_RULES, validateNewPassword } from "@/lib/password-policy";

/**
 * PUT /api/users/change-password
 * Verifies the current password, then changes the logged-in user's own password
 * through their Fineract session.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.userId || !session.user.name) {
      return NextResponse.json(
        { error: "Unauthorized - Please login to change your password" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const repeatPassword = typeof body?.repeatPassword === "string" ? body.repeatPassword : "";

    const validation = validateNewPassword({ currentPassword, password, repeatPassword });
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors[0], details: validation.errors },
        { status: 400 }
      );
    }

    // Verify the current password against Fineract before changing anything
    try {
      await authenticateWithFineractCredentials({
        username: session.user.name,
        password: currentPassword,
      });
    } catch (error) {
      const status = error instanceof FineractAuthenticationError ? error.status : undefined;

      if (status === 401 || status === 400) {
        return NextResponse.json(
          { error: "That's not your current password.", field: "currentPassword" },
          { status: 400 }
        );
      }

      if (status === 403) {
        return NextResponse.json(
          { error: "Your account can't sign in right now. Contact your administrator." },
          { status: 403 }
        );
      }

      console.error("Error verifying current password: status", status ?? "unknown");
      return NextResponse.json(
        { error: "Couldn't verify your current password. Try again." },
        { status: 502 }
      );
    }

    // Update as the user themselves, with the credentials just verified, so this
    // never falls back to a service account.
    const basicAuth = Buffer.from(`${session.user.name}:${currentPassword}`).toString("base64");
    let result: unknown;
    try {
      result = await fetchFineractAPIWithCredentials(`/users/${session.user.userId}`, basicAuth, {
        method: "PUT",
        body: JSON.stringify({ password, repeatPassword }),
      });
    } catch (error) {
      const status = getFineractErrorStatus(error);
      console.error("Error changing password: Fineract responded with status", status ?? "unknown");
      if (status === 403) {
        return NextResponse.json(
          { error: "You don't have permission to change your password. Contact your administrator." },
          { status: 403 }
        );
      }
      return NextResponse.json(
        {
          error:
            error instanceof Error && error.message
              ? error.message
              : "Couldn't change your password. Try again.",
        },
        { status: status && status >= 400 && status < 500 ? 400 : 502 }
      );
    }

    if (isFineractCommandPendingApproval(result)) {
      return NextResponse.json(
        { error: "Your password change needs approval before it takes effect. Keep using your current password for now." },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, requiresReauth: true });
  } catch (error: unknown) {
    console.error("Error changing password:", error);
    return NextResponse.json(
      { error: error instanceof Error && error.message ? error.message : "Failed to change password" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users/change-password
 * Get password requirements
 */
export async function GET() {
  return NextResponse.json({
    requirements: PASSWORD_RULES.map((rule) => rule.label),
  });
}
