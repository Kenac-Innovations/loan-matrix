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
 * GET /api/fineract/loans/[id]/details
 * Fetches comprehensive loan details from Fineract including repayment schedule, charges, and transactions
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: loanId } = params;

    const accessToken = await getAccessToken();
    const fineractTenantId = await getFineractTenantId();

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("=== FETCHING FINERACT LOAN DETAILS ===");
    console.log("Loan ID:", loanId);
    console.log("Base URL:", baseUrl);
    console.log("Tenant ID:", fineractTenantId);

    // Fetch loan with associations for complete data
    const url = `${baseUrl}/fineract-provider/api/v1/loans/${loanId}?associations=all`;
    console.log("Full URL:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${accessToken}`,
        "Fineract-Platform-TenantId": fineractTenantId,
        Accept: "application/json",
      },
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      if (response.status === 404) {
        console.log("Loan not found in Fineract");
        return NextResponse.json(
          { error: "Loan not found in Fineract" },
          { status: 404 }
        );
      }
      const errorData = await response.json();
      console.error("Fineract loan fetch error:", errorData);
      return NextResponse.json(
        { error: errorData.developerMessage || "Failed to fetch loan" },
        { status: response.status }
      );
    }

    const loanData = await response.json();
    console.log("Loan data fetched successfully");
    console.log("Loan:", {
      id: loanData.id,
      accountNo: loanData.accountNo,
      status: loanData.status?.value,
      principal: loanData.principal,
    });

    return NextResponse.json(loanData);
  } catch (error) {
    console.error("Error fetching Fineract loan details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch loan: ${errorMessage}` },
      { status: 500 }
    );
  }
}
