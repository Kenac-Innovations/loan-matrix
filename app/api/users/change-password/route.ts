import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

// Hardcoded service token for API calls
// TODO: Move to environment variable
const SERVICE_TOKEN = "bWlmb3M6cGFzc3dvcmQ=";

/**
 * Password validation rules
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (!@#$%^&*(),.?":{}|<>)
 */
function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * PUT /api/users/change-password
 * Change user password via Fineract API
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.userId) {
      return NextResponse.json(
        { error: "Unauthorized - Please login to change your password" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { password, repeatPassword, currentPassword } = body;

    // Validate required fields
    if (!password || !repeatPassword) {
      return NextResponse.json(
        { error: "Password and repeat password are required" },
        { status: 400 }
      );
    }

    // Check if passwords match
    if (password !== repeatPassword) {
      return NextResponse.json(
        { error: "Passwords do not match" },
        { status: 400 }
      );
    }

    // Validate password strength
    const validation = validatePassword(password);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Password does not meet requirements",
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const fineractTenantId = await getFineractTenantId();
    const userId = session.user.userId;

    // Call Fineract API to change password
    const url = `${baseUrl}/fineract-provider/api/v1/users/${userId}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${SERVICE_TOKEN}`,
        "Fineract-Platform-TenantId": fineractTenantId,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        password,
        repeatPassword,
      }),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { defaultUserMessage: `HTTP ${response.status}: ${response.statusText}` };
      }

      // Extract specific error message
      let errorMessage = errorData.defaultUserMessage || errorData.developerMessage;
      
      if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
        errorMessage = errorData.errors[0].defaultUserMessage || errorData.errors[0].developerMessage || errorMessage;
      }

      return NextResponse.json(
        {
          error: errorMessage || "Failed to change password",
          details: errorData,
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: "Password changed successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Error changing password:", error);
    return NextResponse.json(
      { error: error.message || "Failed to change password" },
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
    requirements: [
      "Minimum 8 characters",
      "At least one uppercase letter (A-Z)",
      "At least one lowercase letter (a-z)",
      "At least one number (0-9)",
      "At least one special character (!@#$%^&*(),.?\":{}|<>)",
    ],
  });
}
