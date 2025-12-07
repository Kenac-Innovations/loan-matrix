import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSession as getCustomSession } from "@/app/actions/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

/**
 * Get access token from either NextAuth session or custom JWT session
 */
async function getAccessToken(): Promise<string | undefined> {
  try {
    const nextAuthSession = await getSession();
    if (nextAuthSession?.accessToken) {
      return nextAuthSession.accessToken;
    }

    const customSession = await getCustomSession();
    if (customSession?.accessToken) {
      return customSession.accessToken;
    }

    return undefined;
  } catch (error) {
    console.error("Error getting access token:", error);
    return undefined;
  }
}

/**
 * POST /api/fineract/loans
 * Creates a new loan in Fineract
 */
export async function POST(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();
    const fineractTenantId = await getFineractTenantId();

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    console.log("Creating loan in Fineract with data:", body);

    const response = await fetch(`${baseUrl}/fineract-provider/api/v1/loans`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${accessToken}`,
        "Fineract-Platform-TenantId": fineractTenantId,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Fineract loan creation failed:", errorData);
      return NextResponse.json(
        {
          success: false,
          error: errorData.developerMessage || "Failed to create loan",
          details: errorData,
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log("Loan created successfully:", result);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error creating loan:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to create loan: ${errorMessage}` },
      { status: 500 }
    );
  }
}
