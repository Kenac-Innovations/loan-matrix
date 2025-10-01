import { NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

/**
 * GET /api/fineract/loans
 * Returns paginated loans from Fineract
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const offset = searchParams.get("offset") || "0";
    const limit = searchParams.get("limit") || "50";

    const fineractService = await getFineractServiceWithSession();
    const data = await fineractService.getLoans(
      parseInt(offset),
      parseInt(limit)
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching loans:", error);

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
