import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSession as getCustomSession } from "@/app/actions/auth";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";

const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

/**
 * Get access token from either NextAuth session or custom JWT session
 */
async function getAccessToken(): Promise<string | undefined> {
  try {
    const nextAuthSession = await getSession();
    if (nextAuthSession?.accessToken) {
      return nextAuthSession.accessToken;
    }

    const customSession = await getCustomSession();
    if (customSession?.accessToken) {
      return customSession.accessToken;
    }

    return undefined;
  } catch (error) {
    console.error("Error getting access token:", error);
    return undefined;
  }
}

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

    const accessToken = await getAccessToken();

    const fineractTenantId = extractTenantSlugFromRequest(request);

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("=== FETCHING FINERACT CLIENT DETAILS ===");
    console.log("Client ID:", clientId);
    console.log("Base URL:", baseUrl);
    console.log("Tenant ID:", fineractTenantId);

    const url = `${baseUrl}/fineract-provider/api/v1/clients/${clientId}`;
    console.log("Full URL:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${accessToken}`,
        "Fineract-Platform-TenantId": fineractTenantId,
        Accept: "application/json",
      },
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      if (response.status === 404) {
        console.log("Client not found in Fineract");
        return NextResponse.json(
          { error: "Client not found in Fineract" },
          { status: 404 }
        );
      }
      const errorData = await response.json();
      console.error("Fineract client fetch error:", errorData);
      return NextResponse.json(
        { error: errorData.developerMessage || "Failed to fetch client" },
        { status: response.status }
      );
    }

    const clientData = await response.json();
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
