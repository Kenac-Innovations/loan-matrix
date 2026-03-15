import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

/**
 * POST /api/debug/fineract-client
 * Test endpoint to debug Fineract client creation
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    console.log("=== DEBUG: Testing Fineract client creation ===");
    console.log("Payload received:", JSON.stringify(payload, null, 2));

    const fineractService = await getFineractServiceWithSession();

    // Test with minimal required data
    const testClientData = {
      officeId: payload.officeId || 1,
      legalFormId: payload.legalFormId || 1,
      firstname: payload.firstname || "Test",
      lastname: payload.lastname || "Client",
      dateFormat: "yyyy-MM-dd",
      locale: "en",
      submittedOnDate: new Date().toISOString().split("T")[0],
      active: false,
    };

    console.log(
      "Sending to Fineract:",
      JSON.stringify(testClientData, null, 2)
    );

    const result = await fineractService.createClient(testClientData);

    console.log("=== SUCCESS: Client created ===");
    console.log("Result:", JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: true,
      message: "Test client created successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("=== ERROR: Fineract client creation failed ===");
    console.error("Error details:", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        },
      },
      { status: 500 }
    );
  }
}
