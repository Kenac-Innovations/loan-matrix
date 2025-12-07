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
 * GET /api/fineract/loans/by-external-id?externalId={externalId}
 * Fetches a loan from Fineract by external ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const externalId = searchParams.get("externalId");

    if (!externalId) {
      return NextResponse.json(
        { error: "External ID is required" },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();
    const fineractTenantId = await getFineractTenantId();

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("=== FETCHING LOAN BY EXTERNAL ID ===");
    console.log("External ID:", externalId);
    console.log("Base URL:", baseUrl);
    console.log("Tenant ID:", fineractTenantId);

    // Fineract doesn't have a direct endpoint to search loans by external ID
    // We need to search all loans and filter by external ID
    // Try using the loans search endpoint with external ID filter
    const searchUrl = `${baseUrl}/fineract-provider/api/v1/loans?externalId=${encodeURIComponent(
      externalId
    )}&associations=all`;
    console.log("Search URL:", searchUrl);

    const response = await fetch(searchUrl, {
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
        console.log("Loan not found by external ID");
        return NextResponse.json(
          { error: "Loan not found with the provided external ID" },
          { status: 404 }
        );
      }
      const errorData = await response.json().catch(() => ({}));
      console.error("Fineract loan search error:", errorData);
      return NextResponse.json(
        { error: errorData.developerMessage || "Failed to search for loan" },
        { status: response.status }
      );
    }

    const searchData = await response.json();
    console.log("Search response received");

    // Handle different response formats
    let loans = [];
    if (Array.isArray(searchData)) {
      loans = searchData;
    } else if (searchData.pageItems && Array.isArray(searchData.pageItems)) {
      loans = searchData.pageItems;
    } else if (searchData.content && Array.isArray(searchData.content)) {
      loans = searchData.content;
    }

    console.log("Found loans:", loans.length);

    // Find the loan that matches the external ID exactly
    const matchingLoan = loans.find(
      (loan: any) => loan.externalId === externalId
    );

    if (!matchingLoan) {
      console.log("No loan found matching external ID:", externalId);
      return NextResponse.json(
        { error: "Loan not found with the provided external ID" },
        { status: 404 }
      );
    }

    console.log("Loan found by external ID:", {
      id: matchingLoan.id,
      accountNo: matchingLoan.accountNo,
      externalId: matchingLoan.externalId,
    });

    // If we got basic info, fetch full details with associations
    if (matchingLoan.id) {
      try {
        const detailsUrl = `${baseUrl}/fineract-provider/api/v1/loans/${matchingLoan.id}?associations=all`;
        const detailsResponse = await fetch(detailsUrl, {
          method: "GET",
          headers: {
            Authorization: `Basic ${accessToken}`,
            "Fineract-Platform-TenantId": fineractTenantId,
            Accept: "application/json",
          },
        });

        if (detailsResponse.ok) {
          const fullLoanData = await detailsResponse.json();
          console.log("Full loan details fetched successfully");
          return NextResponse.json(fullLoanData);
        }
      } catch (err) {
        console.warn(
          "Could not fetch full loan details, returning search result:",
          err
        );
      }
    }

    return NextResponse.json(matchingLoan);
  } catch (error) {
    console.error("Error fetching loan by external ID:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to fetch loan by external ID",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
