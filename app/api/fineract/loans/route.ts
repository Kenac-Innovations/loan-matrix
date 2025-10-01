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

    console.log("Loans API Debug:", {
      offset,
      limit,
      url: request.url
    });

    const fineractService = await getFineractServiceWithSession();
    const data = await fineractService.getLoans(
      parseInt(offset),
      parseInt(limit)
    );

    console.log("Loans API Response:", {
      dataType: typeof data,
      isArray: Array.isArray(data),
      length: Array.isArray(data) ? data.length : 'N/A',
      firstItem: Array.isArray(data) && data.length > 0 ? data[0] : 'No items',
      fullData: data
    });

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
