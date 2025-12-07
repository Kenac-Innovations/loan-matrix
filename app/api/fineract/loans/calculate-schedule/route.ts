import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * POST /api/fineract/loans/calculate-schedule
 * Calculates loan repayment schedule using Fineract calculateLoanSchedule command
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();

    console.log("=== CALCULATE SCHEDULE REQUEST ===");
    console.log("Payload:", JSON.stringify(payload, null, 2));
    console.log("Product ID:", payload.productId);
    console.log("Client ID:", payload.clientId);
    console.log("Principal:", payload.principal);

    // POST to Fineract /loans?command=calculateLoanSchedule
    const data = await fetchFineractAPI(
      "/loans?command=calculateLoanSchedule",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    console.log("=== SCHEDULE CALCULATED SUCCESSFULLY ===");
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("=== ERROR CALCULATING LOAN SCHEDULE ===");
    console.error("Error type:", error.constructor.name);
    console.error("Error message:", error.message);
    console.error("Error status:", error.status);
    console.error("Error data:", JSON.stringify(error.errorData, null, 2));
    console.error("Full error:", error);

    // Check if it's an API error with status and errorData
    if (error.status && error.errorData) {
      return NextResponse.json(
        {
          error: error.message || "Failed to calculate loan schedule",
          status: error.status,
          details: error.errorData,
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: error.message || "Unknown error calculating loan schedule" },
      { status: 500 }
    );
  }
}
