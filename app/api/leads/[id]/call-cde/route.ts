import { NextRequest, NextResponse } from "next/server";
import { callCDEAndStore } from "@/lib/cde-utils";

/**
 * POST /api/leads/[id]/call-cde
 * Calls the CDE (Credit Decision Engine) to evaluate a loan application
 * and stores the result in the lead's stateMetadata
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: leadId } = params;

    console.log("=== CDE CALL REQUEST ===");
    console.log("Lead ID:", leadId);

    // Call CDE and store result (utility handles server-side call directly)
    const cdeResult = await callCDEAndStore(leadId);

    if (cdeResult) {
      return NextResponse.json({
        success: true,
        cdeResult,
        message: "CDE evaluation completed successfully",
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "CDE evaluation failed or returned no result",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in CDE call endpoint:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: `Failed to call CDE: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
