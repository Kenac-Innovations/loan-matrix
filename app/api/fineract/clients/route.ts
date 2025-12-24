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
 * Proxies to Fineract's clients endpoint with server-side search
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = searchParams.get("offset") || "0";
    const limit = searchParams.get("limit") || "20";
    const query = searchParams.get("query");

    let data;

    if (query) {
      // Use Fineract's search API for server-side search
      console.log("Searching clients with query:", query);

      const accessToken = await getAccessToken();
      const fineractTenantId = await getFineractTenantId();

      if (!accessToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Use Fineract's search endpoint - uppercase query for case-sensitive Fineract
      const uppercaseQuery = query.toUpperCase();
      const searchUrl = `${baseUrl}/fineract-provider/api/v1/search?query=${encodeURIComponent(
        uppercaseQuery
      )}&resource=clients`;

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
            headers: {
              Authorization: `Basic ${accessToken}`,
              "Fineract-Platform-TenantId": fineractTenantId,
              Accept: "application/json",
            },
            cache: "no-store",
          });
          if (clientResponse.ok) {
            const client = await clientResponse.json();
            clients.push(client);
          }
        }

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
      // Regular listing with pagination
      const fineractService = await getFineractServiceWithSession();
      data = await fineractService.getClients(
        parseInt(offset),
        parseInt(limit)
      );
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
