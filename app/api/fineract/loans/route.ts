import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSession as getCustomSession } from "@/app/actions/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import { getSearchHeaders } from "@/lib/fineract-search-auth";

const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

/**
 * Get access token from either NextAuth session or custom JWT session
 * Used for operations that require user-specific auth (create, update, etc.)
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
 * Uses service account auth for search operations
 */
export async function GET(request: NextRequest) {
  try {
    const fineractTenantId = await getFineractTenantId();

    console.log("=== LOANS API - Tenant Information ===");
    console.log("Using Fineract Tenant ID:", fineractTenantId);
    console.log("=======================================");

    // Use service account headers for search/listing operations
    const headers = getSearchHeaders(fineractTenantId);

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
      const searchQuery = query.trim();
      console.log("Searching loans with query:", searchQuery);

      // Use Fineract's search endpoint to find loans and clients
      const searchUrl = `${baseUrl}/fineract-provider/api/v1/search?query=${encodeURIComponent(searchQuery)}&resource=loans,clients&exactMatch=false`;

      console.log("Search URL:", searchUrl);

      const searchResponse = await fetch(searchUrl, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (searchResponse.ok) {
        const searchResults = await searchResponse.json();
        console.log("Search API found results:", searchResults?.length || 0);

        // Collect unique loan IDs and client IDs from search results
        const loanIds = new Set<number>();
        const clientIds = new Set<number>();

        for (const item of searchResults || []) {
          if (item.entityType === "LOAN") {
            loanIds.add(item.entityId);
          } else if (item.entityType === "CLIENT") {
            clientIds.add(item.entityId);
          }
        }

        console.log("Found loan IDs:", loanIds.size, "client IDs:", clientIds.size);

        // Fetch loans for matching clients using SQL search
        if (clientIds.size > 0) {
          const clientIdList = Array.from(clientIds).join(',');
          const clientLoansUrl = `${baseUrl}/fineract-provider/api/v1/loans?sqlSearch=l.client_id in (${clientIdList})&limit=500`;
          
          console.log("Fetching loans for clients:", clientLoansUrl);
          
          const clientLoansResponse = await fetch(clientLoansUrl, {
            method: "GET",
            headers,
            cache: "no-store",
          });
          
          if (clientLoansResponse.ok) {
            const clientLoansResult = await clientLoansResponse.json();
            const clientLoans = clientLoansResult?.pageItems || clientLoansResult || [];
            console.log("Found loans for clients:", clientLoans.length);
            
            // Return these loans directly
            result = { pageItems: clientLoans, totalFilteredRecords: clientLoans.length };
          } else {
            result = { pageItems: [], totalFilteredRecords: 0 };
          }
        } else if (loanIds.size > 0) {
          // Fetch loans by IDs
          const loanIdList = Array.from(loanIds).join(',');
          const loansUrl = `${baseUrl}/fineract-provider/api/v1/loans?sqlSearch=l.id in (${loanIdList})&limit=500`;
          
          const loansResponse = await fetch(loansUrl, {
            method: "GET",
            headers,
            cache: "no-store",
          });
          
          if (loansResponse.ok) {
            const loansResult = await loansResponse.json();
            const loans = loansResult?.pageItems || loansResult || [];
            result = { pageItems: loans, totalFilteredRecords: loans.length };
          } else {
            result = { pageItems: [], totalFilteredRecords: 0 };
          }
        } else {
          result = { pageItems: [], totalFilteredRecords: 0 };
        }
      } else {
        const errorText = await searchResponse.text();
        console.error("Search API failed:", searchResponse.status, errorText);
        result = { pageItems: [], totalFilteredRecords: 0 };
      }
    } else if (accountNo) {
      // Search by exact account number
      const accountUrl = `${baseUrl}/fineract-provider/api/v1/loans?sqlSearch=l.account_no='${accountNo}'`;

      const response = await fetch(accountUrl, {
        method: "GET",
        headers,
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
        headers,
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
 * Uses user's auth token for audit trail
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
