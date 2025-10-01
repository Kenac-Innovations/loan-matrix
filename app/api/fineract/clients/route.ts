import { NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

/**
 * GET /api/fineract/clients
 * Proxies to Fineract's clients endpoint
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = searchParams.get("offset") || "0";
    const limit = searchParams.get("limit") || "20";
    const query = searchParams.get("query");

    const fineractService = await getFineractServiceWithSession();

    let data;
    if (query) {
      // Use search functionality if available in the service
      data = await fineractService.getClients(
        parseInt(offset),
        parseInt(limit)
      );
      // Filter by query on the client side if needed
      if (Array.isArray(data) && query) {
        data = data.filter(
          (client: any) =>
            client.displayName?.toLowerCase().includes(query.toLowerCase()) ||
            client.accountNo?.toLowerCase().includes(query.toLowerCase())
        );
      }
    } else {
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
