import { NextResponse } from "next/server";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";
import { getSearchAuthToken } from "@/lib/fineract-search-auth";

const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

/**
 * Get the service account token for Fineract API calls
 * Uses hardcoded token for now (same as other Fineract API routes)
 */
function getAccessToken(): string {
  return getSearchAuthToken();
}

/**
 * POST /api/fineract/clients/[id]/images
 * Uploads a client image (selfie) to Fineract
 * Expects a base64 data URI in the request body (e.g., "data:image/png;base64,iVBORw0KG...")
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.text(); // Get raw text body (base64 data URI)

    if (!body || !body.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Invalid image data. Expected base64 data URI." },
        { status: 400 }
      );
    }

    const accessToken = getAccessToken();
    const fineractTenantId = await getFineractTenantId();

    const url = `${baseUrl}/fineract-provider/api/v1/clients/${id}/images`;

    const headers: any = {
      Authorization: `Basic ${accessToken}`,
      "Fineract-Platform-TenantId": fineractTenantId,
      "Content-Type": "text/plain",
      Accept: "application/json, text/plain, */*",
    };

    let response;
    if (url.startsWith("http://")) {
      response = await fetch(url, {
        method: "POST",
        headers,
        body,
      });
    } else {
      const https = require("https");
      const agent = new https.Agent({ rejectUnauthorized: false });
      response = await fetch(url, {
        method: "POST",
        headers,
        body,
        //@ts-ignore
        agent,
      });
    }

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = {
          defaultUserMessage: `HTTP ${response.status}: ${response.statusText}`,
          developerMessage: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return NextResponse.json(
        {
          error:
            errorData.defaultUserMessage ||
            errorData.developerMessage ||
            "Failed to upload image",
          details: errorData,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error uploading client image:", error);
    return NextResponse.json(
      {
        error: error?.message || "Failed to upload image",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fineract/clients/[id]/images
 * Fetches client images
 * Supports query parameters: maxHeight, maxWidth
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const maxHeight = searchParams.get("maxHeight");
    const maxWidth = searchParams.get("maxWidth");

    // Build query string
    const queryParams = new URLSearchParams();
    if (maxHeight) queryParams.append("maxHeight", maxHeight);
    if (maxWidth) queryParams.append("maxWidth", maxWidth);

    const queryString = queryParams.toString();
    const endpoint = `/clients/${id}/images${queryString ? `?${queryString}` : ""}`;

    // For images, we need to handle the response as text/plain since Fineract returns base64
    const accessToken = getAccessToken();
    const fineractTenantId = await getFineractTenantId();

    const url = `${baseUrl}/fineract-provider/api/v1${endpoint}`;

    const headers: any = {
      Authorization: `Basic ${accessToken}`,
      "Fineract-Platform-TenantId": fineractTenantId,
      Accept: "application/json, text/plain, */*",
    };

    let response;
    if (url.startsWith("http://")) {
      response = await fetch(url, {
        method: "GET",
        headers,
      });
    } else {
      const https = require("https");
      const agent = new https.Agent({ rejectUnauthorized: false });
      response = await fetch(url, {
        method: "GET",
        headers,
        //@ts-ignore
        agent,
      });
    }

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(null);
      }
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = {
          defaultUserMessage: `HTTP ${response.status}: ${response.statusText}`,
          developerMessage: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
      return NextResponse.json(
        {
          error:
            errorData.defaultUserMessage ||
            errorData.developerMessage ||
            "Failed to fetch client images",
          details: errorData,
        },
        { status: response.status }
      );
    }

    // Fineract returns the image as a base64 string or JSON
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      // If it's text/plain, it's likely a base64 string
      const textData = await response.text();
      return NextResponse.json(textData);
    }
  } catch (error: any) {
    console.error("Error fetching client images:", error);
    if (error?.status === 404) {
      return NextResponse.json(null);
    }
    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch client images",
      },
      { status: error?.status || 500 }
    );
  }
}
