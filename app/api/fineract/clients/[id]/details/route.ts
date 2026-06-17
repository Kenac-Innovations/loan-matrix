import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";

const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

/**
 * GET /api/fineract/clients/[id]/details
 * Fetches comprehensive client details from Fineract
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: clientId } = params;

    const fineractTenantId = extractTenantSlugFromRequest(request);

    console.log("=== FETCHING FINERACT CLIENT DETAILS ===");
    console.log("Client ID:", clientId);
    console.log("Base URL:", baseUrl);
    console.log("Tenant ID:", fineractTenantId);

    const url = `${baseUrl}/fineract-provider/api/v1/clients/${clientId}`;
    console.log("Full URL:", url);

    const clientData = await fetchFineractAPI(`/clients/${clientId}`, {
      authMode: "service",
    });
    console.log("Client data fetched successfully");
    console.log("Client:", {
      id: clientData.id,
      displayName: clientData.displayName,
      accountNo: clientData.accountNo,
      status: clientData.status?.value,
    });

    return NextResponse.json(clientData);
  } catch (error) {
    console.error("Error fetching Fineract client details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch client: ${errorMessage}` },
      { status: 500 }
    );
  }
}
