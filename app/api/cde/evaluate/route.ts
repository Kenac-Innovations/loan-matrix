import { NextRequest, NextResponse } from "next/server";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

const CDE_BASE_URL = process.env.CDE_BASE_URL || "http://localhost:8090";

/**
 * POST /api/cde/evaluate
 * Calls the Credit Decision Engine (CDE) to evaluate a loan application
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    console.log("\n==========================================");
    console.log("=== CDE EVALUATE API ROUTE - REQUEST ===");
    console.log("==========================================");
    console.log("\n--- FULL REQUEST PAYLOAD ---");
    console.log(JSON.stringify(data, null, 2));
    console.log("\n--- PAYLOAD SUMMARY ---");
    console.log("Mifos Loan ID:", data.mifosLoanId);
    if (data.applicant) {
      console.log(
        "Applicant:",
        `${data.applicant.firstName} ${data.applicant.lastName}`
      );
      console.log("Requested Amount:", data.requestedAmount);
      console.log("Requested Term:", data.requestedTerm, "months");
    }
    console.log("==========================================\n");

    // Get tenant ID from headers
    const tenantId = await getFineractTenantId();
    console.log("CDE Tenant ID:", tenantId);

    // CDE API structure: /api/v1/{tenantId}/loans/validate
    const cdeUrl = `${CDE_BASE_URL}/api/v1/${tenantId}/loans/validate`;
    console.log("\n--- CDE API REQUEST DETAILS ---");
    console.log("CDE Base URL:", CDE_BASE_URL);
    console.log("CDE Tenant ID:", tenantId);
    console.log("CDE Full URL:", cdeUrl);
    console.log("Request Method: POST");
    console.log("Request Headers:", {
      "Content-Type": "application/json",
      Accept: "*/*",
    });
    console.log("Request Body Size:", JSON.stringify(data).length, "bytes");

    const response = await fetch(cdeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
      },
      body: JSON.stringify(data),
    });

    console.log("\n--- CDE API RESPONSE ---");
    console.log("Response Status:", response.status);
    console.log("Response OK:", response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("CDE Error Response:", errorText);
      return NextResponse.json(
        {
          error: "CDE evaluation failed",
          details: errorText,
          status: response.status,
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log("=== CDE EVALUATION RESULT ===");
    console.log("Decision:", result.decision);
    console.log("Credit Score:", result.scoringResult?.creditScore);
    console.log("Recommendation:", result.recommendation);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error calling CDE:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Failed to call CDE",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
