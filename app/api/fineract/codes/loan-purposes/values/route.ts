import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/api";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

const FINERACT_API_URL =
  process.env.NEXT_PUBLIC_FINERACT_API_URL ||
  "http://localhost:8443/fineract-provider/api/v1";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, position, isActive } = body;

    // Get authentication details
    const authHeader = await getAccessToken();
    const tenantId = await getFineractTenantId();

    console.log("Adding new loan purpose:", { name, description, position });

    // First, get or verify the LoanPurpose code exists
    const codesResponse = await fetch(`${FINERACT_API_URL}/codes`, {
      headers: {
        Authorization: authHeader,
        "Fineract-Platform-TenantId": tenantId,
        "Content-Type": "application/json",
      },
    });

    if (!codesResponse.ok) {
      throw new Error("Failed to fetch codes");
    }

    const codes = await codesResponse.json();
    const loanPurposeCode = codes.find(
      (code: any) => code.name === "LoanPurpose"
    );

    if (!loanPurposeCode) {
      throw new Error("LoanPurpose code not found in Fineract");
    }

    // Add the new code value to the LoanPurpose code
    const response = await fetch(
      `${FINERACT_API_URL}/codes/${loanPurposeCode.id}/codevalues`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Fineract-Platform-TenantId": tenantId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description: description || undefined,
          position: position || 0,
          isActive: isActive !== undefined ? isActive : true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Fineract API error:", errorText);
      throw new Error(`Failed to add loan purpose: ${response.status}`);
    }

    const result = await response.json();
    console.log("Successfully added loan purpose:", result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error adding loan purpose:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to add loan purpose",
      },
      { status: 500 }
    );
  }
}
