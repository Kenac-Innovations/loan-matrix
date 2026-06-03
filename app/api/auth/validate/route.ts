import { NextRequest, NextResponse } from "next/server";
import {
  authenticateWithFineractCredentials,
  FineractAuthenticationError,
  getPermissionValidationError,
} from "@/lib/fineract-auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    const authUser = await authenticateWithFineractCredentials({
      username,
      password,
    });

    const validationError = getPermissionValidationError(authUser.rawPermissions);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof FineractAuthenticationError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }

    console.error("Validation route error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Unable to connect to authentication service",
      },
      { status: 500 }
    );
  }
}
