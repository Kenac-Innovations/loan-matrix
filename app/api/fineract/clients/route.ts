import { NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import { getSession } from "@/lib/auth";
import { getSession as getCustomSession } from "@/app/actions/auth";

const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

/**
 * Get access token from either NextAuth session or custom JWT session
 */
async function getAccessToken(): Promise<string | undefined> {
  try {
    const nextAuthSession = (await getSession()) as any;
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
 * GET /api/fineract/clients
 * Proxies to Fineract's clients endpoint with server-side search, filters, and sorting
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = searchParams.get("offset") || "0";
    const limit = searchParams.get("limit") || "20";
    const query = searchParams.get("query");
    const officeId = searchParams.get("officeId");
    const status = searchParams.get("status"); // active, pending, closed
    const orderBy = searchParams.get("orderBy") || "id"; // id, displayName, accountNo
    const sortOrder = searchParams.get("sortOrder") || "DESC"; // ASC, DESC

    const accessToken = await getAccessToken();
    const fineractTenantId = await getFineractTenantId();

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const headers = {
      Authorization: `Basic ${accessToken}`,
      "Fineract-Platform-TenantId": fineractTenantId,
      Accept: "application/json",
    };

    let data;

    if (query) {
      // Use Fineract's search API for server-side search
      console.log("Searching clients with query:", query);

      // Use Fineract's search endpoint - uppercase query for case-sensitive Fineract
      const uppercaseQuery = query.toUpperCase();
      const searchUrl = `${baseUrl}/fineract-provider/api/v1/search?query=${encodeURIComponent(
        uppercaseQuery
      )}&resource=clients`;

      const searchResponse = await fetch(searchUrl, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (searchResponse.ok) {
        const searchResults = await searchResponse.json();
        console.log("Search results count:", searchResults?.length || 0);

        // Extract client IDs from search results
        const clientIds = new Set<number>();

        for (const item of searchResults || []) {
          if (item.entityType === "CLIENT") {
            clientIds.add(item.entityId);
          }
        }

        // Fetch full details for found clients (limit to 50)
        const clients = [];
        for (const clientId of Array.from(clientIds).slice(0, 50)) {
          const clientUrl = `${baseUrl}/fineract-provider/api/v1/clients/${clientId}`;
          const clientResponse = await fetch(clientUrl, {
            method: "GET",
            headers,
            cache: "no-store",
          });
          if (clientResponse.ok) {
            const client = await clientResponse.json();
            // Apply office filter if specified
            if (officeId && client.officeId !== Number.parseInt(officeId)) {
              continue;
            }
            // Apply status filter if specified
            if (status) {
              const isActive = client.active;
              if (status === "active" && !isActive) continue;
              if (status === "inactive" && isActive) continue;
            }
            clients.push(client);
          }
        }

        // Sort results
        clients.sort((a, b) => {
          let aVal = a[orderBy] || "";
          let bVal = b[orderBy] || "";
          if (typeof aVal === "string") aVal = aVal.toLowerCase();
          if (typeof bVal === "string") bVal = bVal.toLowerCase();
          if (sortOrder === "ASC") {
            return aVal > bVal ? 1 : -1;
          }
          return aVal < bVal ? 1 : -1;
        });

        data = {
          clients: {
            pageItems: clients,
            totalFilteredRecords: clients.length,
          },
        };
      } else {
        console.log("Search failed, falling back to empty results");
        data = {
          clients: {
            pageItems: [],
            totalFilteredRecords: 0,
          },
        };
      }
    } else {
      // Build URL with Fineract's native filter parameters
      let clientsUrl = `${baseUrl}/fineract-provider/api/v1/clients?offset=${offset}&limit=${limit}&paged=true&orderBy=${orderBy}&sortOrder=${sortOrder}`;

      // Add office filter - Fineract supports officeId as query param
      if (officeId) {
        clientsUrl += `&officeId=${officeId}`;
      }

      // Add status filter - Fineract uses 'status' parameter
      // Note: Some Fineract versions may not support this, we'll filter client-side as fallback
      if (status) {
        if (status === "active") {
          clientsUrl += `&status=active`;
        } else if (status === "pending") {
          clientsUrl += `&status=pending`;
        } else if (status === "closed") {
          clientsUrl += `&status=closed`;
        }
      }

      console.log("Fetching clients with URL:", clientsUrl);

      const response = await fetch(clientsUrl, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (response.ok) {
        const result = await response.json();
        let clients = result.pageItems || result || [];

        // Client-side status filtering as fallback (in case Fineract doesn't support status param)
        if (status && Array.isArray(clients)) {
          clients = clients.filter((client: any) => {
            if (status === "active") return client.active === true;
            if (status === "inactive") return client.active === false;
            if (status === "pending")
              return client.status?.code === "clientStatusType.pending";
            if (status === "closed")
              return client.status?.code === "clientStatusType.closed";
            return true;
          });
        }

        data = {
          clients: {
            pageItems: clients,
            totalFilteredRecords: result.totalFilteredRecords || clients.length,
          },
        };
      } else {
        console.log("Clients fetch failed, status:", response.status);
        // Fallback to basic listing without filters
        const fineractService = await getFineractServiceWithSession();
        data = await fineractService.getClients(
          Number.parseInt(offset),
          Number.parseInt(limit)
        );
      }
    }

    // Return the data as-is to preserve the original structure
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching clients:", error);

    // Better error handling for different error types
    const errorMessage =
      error?.message || error?.errorData?.defaultUserMessage || "Unknown error";
    const statusCode = error?.status || 500;

    return NextResponse.json(
      {
        error: errorMessage,
        details: error?.errorData || null,
      },
      { status: statusCode }
    );
  }
}

/**
 * POST /api/fineract/clients
 * Creates a new client in Fineract
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const fineractService = await getFineractServiceWithSession();

    // Use the Fineract service to create client
    const data = await fineractService.createClient(payload);

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("Error creating client:", error);

    // Better error handling for different error types
    const errorMessage =
      error?.message || error?.errorData?.defaultUserMessage || "Unknown error";
    const statusCode = error?.status || 500;

    return NextResponse.json(
      {
        error: errorMessage,
        details: error?.errorData || null,
      },
      { status: statusCode }
    );
  }
}
