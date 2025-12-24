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
    const nextAuthSession = (await getSession()) as any;
    // Check for base64EncodedAuthenticationKey first (Fineract format), then accessToken
    if (nextAuthSession?.base64EncodedAuthenticationKey) {
      return nextAuthSession.base64EncodedAuthenticationKey;
    }
    if (nextAuthSession?.accessToken) {
      return nextAuthSession.accessToken;
    }

    const customSession = (await getCustomSession()) as any;
    if (customSession?.base64EncodedAuthenticationKey) {
      return customSession.base64EncodedAuthenticationKey;
    }
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
 * GET /api/fineract/loans
 * Fetches all loans from Fineract
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = await getAccessToken();
    const fineractTenantId = await getFineractTenantId();

    console.log("=== LOANS API - Tenant Information ===");
    console.log("Using Fineract Tenant ID:", fineractTenantId);
    console.log("=======================================");

    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = searchParams.get("limit") || "100";
    const offset = searchParams.get("offset") || "0";
    const query = searchParams.get("query");
    const accountNo = searchParams.get("accountNo");

    let result;

    // If we have a search query, use Fineract's search API
    if (query) {
      // Uppercase query for case-sensitive Fineract
      const uppercaseQuery = query.toUpperCase();
      console.log("Searching loans with query:", uppercaseQuery);

      // First search for matching accounts/clients
      const searchUrl = `${baseUrl}/fineract-provider/api/v1/search?query=${encodeURIComponent(
        uppercaseQuery
      )}&resource=loans,clients`;

      const searchResponse = await fetch(searchUrl, {
        method: "GET",
        headers: {
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (searchResponse.ok) {
        const searchResults = await searchResponse.json();
        console.log("Search results:", searchResults?.length || 0);

        // Extract loan IDs from search results and fetch full loan details
        const loanIds = new Set<number>();
        const clientIds = new Set<number>();

        for (const item of searchResults || []) {
          if (item.entityType === "LOAN") {
            loanIds.add(item.entityId);
          } else if (item.entityType === "CLIENT") {
            clientIds.add(item.entityId);
          }
        }

        // If we found clients, fetch their loans too
        if (clientIds.size > 0) {
          for (const clientId of Array.from(clientIds).slice(0, 10)) {
            // Limit to 10 clients
            const clientLoansUrl = `${baseUrl}/fineract-provider/api/v1/loans?sqlSearch=l.client_id=${clientId}`;
            const clientLoansResponse = await fetch(clientLoansUrl, {
              method: "GET",
              headers: {
                Authorization: `Basic ${accessToken}`,
                "Fineract-Platform-TenantId": fineractTenantId,
                Accept: "application/json",
              },
              cache: "no-store",
            });
            if (clientLoansResponse.ok) {
              const clientLoans = await clientLoansResponse.json();
              for (const loan of clientLoans?.pageItems || clientLoans || []) {
                loanIds.add(loan.id);
              }
            }
          }
        }

        // Fetch full details for found loans
        const loans = [];
        for (const loanId of Array.from(loanIds).slice(0, 50)) {
          // Limit to 50 loans
          const loanUrl = `${baseUrl}/fineract-provider/api/v1/loans/${loanId}`;
          const loanResponse = await fetch(loanUrl, {
            method: "GET",
            headers: {
              Authorization: `Basic ${accessToken}`,
              "Fineract-Platform-TenantId": fineractTenantId,
              Accept: "application/json",
            },
            cache: "no-store",
          });
          if (loanResponse.ok) {
            const loan = await loanResponse.json();
            loans.push(loan);
          }
        }

        result = { pageItems: loans, totalFilteredRecords: loans.length };
      } else {
        // Fallback to regular listing if search fails
        console.log("Search failed, falling back to regular listing");
        result = { pageItems: [], totalFilteredRecords: 0 };
      }
    } else if (accountNo) {
      // Search by exact account number
      const accountUrl = `${baseUrl}/fineract-provider/api/v1/loans?sqlSearch=l.account_no='${accountNo}'`;

      const response = await fetch(accountUrl, {
        method: "GET",
        headers: {
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Fineract loans fetch failed:",
          response.status,
          errorText
        );
        return NextResponse.json(
          {
            success: false,
            error: `Failed to fetch loans: ${response.status}`,
          },
          { status: response.status }
        );
      }

      result = await response.json();
    } else {
      // Regular listing with pagination
      let url = `${baseUrl}/fineract-provider/api/v1/loans?limit=${limit}&offset=${offset}`;
      if (status) {
        url += `&status=${status}`;
      }

      console.log("Fetching loans from Fineract:", url);
      console.log("Fineract-Platform-TenantId header:", fineractTenantId);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${accessToken}`,
          "Fineract-Platform-TenantId": fineractTenantId,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "Fineract loans fetch failed:",
          response.status,
          errorText
        );
        return NextResponse.json(
          {
            success: false,
            error: `Failed to fetch loans: ${response.status}`,
          },
          { status: response.status }
        );
      }

      result = await response.json();
    }

    console.log(
      "Loans fetched successfully, count:",
      result?.pageItems?.length || result?.length || 0
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching loans:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch loans: ${errorMessage}` },
      { status: 500 }
    );
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
