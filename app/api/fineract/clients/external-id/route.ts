import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * POST /api/fineract/clients/external-id
 * Fetches client details by external ID (national ID) from Fineract
 * Receives external ID in the request body to avoid URL encoding issues
 * Uses the /clients/search endpoint (v2) to search for clients
 *
 * Request body: { externalId: string }
 */

// GET handler for debugging - should not be used in production
export async function GET(request: Request) {
  console.log(
    "==========> [ROUTE] GET /api/fineract/clients/external-id - Wrong method!"
  );
  return NextResponse.json(
    {
      error:
        "This endpoint only accepts POST requests. Please use POST with body: { externalId: string }",
    },
    { status: 405 }
  );
}

export async function POST(request: Request) {
  console.log(
    "==========> [ROUTE] POST /api/fineract/clients/external-id - Route handler called!"
  );
  console.log("==========> [ROUTE] Request URL:", request.url);
  console.log("==========> [ROUTE] Request method:", request.method);

  try {
    console.log("==========> [ROUTE] Parsing request body...");
    const body = await request.json();
    console.log("==========> [ROUTE] Request body received:", body);

    const { externalId } = body;
    console.log("==========> [ROUTE] External ID extracted:", externalId);

    if (!externalId) {
      return NextResponse.json(
        { error: "External ID is required" },
        { status: 400 }
      );
    }

    // Use the v2 search endpoint with POST to avoid URL encoding issues
    // This handles external IDs with special characters like forward slashes
    console.log("==========> [ROUTE] Preparing search payload...");
    const searchPayload = {
      request: { text: externalId },
      page: 0,
      size: 50,
    };
    console.log(
      "==========> [ROUTE] Search payload:",
      JSON.stringify(searchPayload)
    );

    console.log("==========> [ROUTE] Calling Fineract search API...");
    console.log("==========> [ROUTE] Searching for external ID:", externalId);
    const searchData = await fetchFineractAPI(
      "/clients/search",
      {
        method: "POST",
        body: JSON.stringify(searchPayload),
      },
      "v2"
    );
    // Fineract v2 search API returns results in 'content' array, not 'pageItems'
    const clients = searchData?.content || searchData?.pageItems || [];

    console.log(
      "==========> [ROUTE] Search API response received, clients count:",
      clients.length
    );
    console.log(
      "==========> [ROUTE] Full search response:",
      JSON.stringify(searchData, null, 2)
    );

    // Log all found clients' external IDs for debugging
    if (clients.length > 0) {
      console.log(
        "==========> [ROUTE] Found clients with external IDs:",
        clients.map((c: any) => c.externalId).filter(Boolean)
      );
    }

    // Check if any clients were found
    if (!clients || clients.length === 0) {
      console.log("==========> [ROUTE] No clients found in search results");
      console.log("==========> [ROUTE] Searched for external ID:", externalId);
      return NextResponse.json(
        {
          error: "Client not found with the provided external ID",
          searchedExternalId: externalId,
          searchResponse: searchData,
        },
        { status: 404 }
      );
    }

    // Find the client that matches the external ID exactly
    // (search might return multiple results)
    console.log(
      "==========> [ROUTE] Looking for exact match of external ID:",
      externalId
    );
    console.log(
      "==========> [ROUTE] Available external IDs in results:",
      clients.map((c: any) => ({
        id: c.id,
        externalId: c.externalId,
      }))
    );

    const matchingClient = clients.find(
      (client: any) => client.externalId === externalId
    );

    console.log("==========> [ROUTE] Matching client found:", !!matchingClient);

    if (!matchingClient) {
      return NextResponse.json(
        { error: "Client not found with the provided external ID" },
        { status: 404 }
      );
    }

    // If we only have basic info from search, fetch full client details
    // Otherwise return the search result (which should have all needed fields)
    if (matchingClient.id) {
      try {
        const fullClientData = await fetchFineractAPI(
          `/clients/${matchingClient.id}`
        );
        return NextResponse.json(fullClientData);
      } catch (fetchError) {
        // If fetching full details fails, return the search result
        console.warn(
          "Could not fetch full client details, returning search result:",
          fetchError
        );
        return NextResponse.json(matchingClient);
      }
    }

    return NextResponse.json(matchingClient);
  } catch (error: any) {
    console.error("==========> [ROUTE] ERROR in external-id route:", error);
    console.error("==========> [ROUTE] Error message:", error?.message);
    console.error("==========> [ROUTE] Error stack:", error?.stack);

    // Handle specific error cases
    if (error.status === 404) {
      return NextResponse.json(
        { error: "Client not found with the provided external ID" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
