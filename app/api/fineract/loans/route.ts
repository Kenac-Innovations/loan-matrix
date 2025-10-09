import { NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { fetchFineractAPI } from "@/lib/api";

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

/**
 * POST /api/fineract/loans
 * Creates a new loan in Fineract
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // POST to Fineract /loans
    const result = await fetchFineractAPI('/loans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Set external ID to loan ID for future reference
    if (result && result.resourceId) {
      const loanId = result.resourceId;
      
      // Update the loan with the external ID set to the loan ID
      try {
        await fetchFineractAPI(`/loans/${loanId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            externalId: String(loanId),
            locale: 'en',
            dateFormat: 'yyyy-MM-dd',
          }),
        });
        
        console.log(`Updated loan ${loanId} with external ID set to loan ID`);
      } catch (updateError) {
        console.error('Failed to update loan external ID:', updateError);
        // Don't fail the entire operation if external ID update fails
      }
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error creating loan:", error);

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
