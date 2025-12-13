import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * GET /api/fineract/clients/[id]/addresses
 * Fetches addresses for a specific client
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Note: Fineract uses singular "client" not "clients" for addresses endpoint
    const data = await fetchFineractAPI(`/client/${id}/addresses`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching client addresses:", error);
    // If 404, return empty array (no addresses exist yet)
    if (error?.status === 404) {
      return NextResponse.json([]);
    }
    return NextResponse.json(
      {
        error:
          error?.message ||
          error?.errorData?.defaultUserMessage ||
          "Failed to fetch client addresses",
        details: error?.errorData || null,
      },
      { status: error?.status || 500 }
    );
  }
}

/**
 * POST /api/fineract/clients/[id]/addresses
 * Creates a new address for a client
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Get addressType - required for the query parameter
    let addressType = body.addressType;
    if (typeof addressType === "string") {
      addressType = parseInt(addressType);
    }
    if (!addressType || isNaN(addressType)) {
      return NextResponse.json(
        { error: "addressType is required and must be a valid number" },
        { status: 400 }
      );
    }

    // Build payload matching the working curl format exactly
    // Body uses: {"addressType":17,"addressLine1":"...","addressLine2":"...","addressLine3":"...","city":"...","stateProvinceId":100,"countryId":99,"postalCode":"..."}
    const payload: any = {};

    // Add addressType as number
    payload.addressType = addressType;

    // Add string fields
    if (body.addressLine1) payload.addressLine1 = body.addressLine1;
    if (body.addressLine2) payload.addressLine2 = body.addressLine2;
    if (body.addressLine3) payload.addressLine3 = body.addressLine3;
    if (body.city) payload.city = body.city;
    if (body.postalCode) payload.postalCode = body.postalCode;

    // Add ID fields as numbers
    if (body.stateProvinceId) {
      payload.stateProvinceId =
        typeof body.stateProvinceId === "string"
          ? parseInt(body.stateProvinceId)
          : body.stateProvinceId;
    }
    if (body.countryId) {
      payload.countryId =
        typeof body.countryId === "string"
          ? parseInt(body.countryId)
          : body.countryId;
    }

    // Add optional fields
    if (body.isActive !== undefined) payload.isActive = Boolean(body.isActive);

    console.log(
      "Sending address payload to Fineract:",
      JSON.stringify(payload)
    );

    // Note: Fineract uses singular "client" not "clients" for addresses endpoint
    // URL format: /client/{id}/addresses?type={addressType}
    const data = await fetchFineractAPI(
      `/client/${id}/addresses?type=${addressType}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error creating client address:", error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          error?.errorData?.defaultUserMessage ||
          "Failed to create client address",
        details: error?.errorData || null,
      },
      { status: error?.status || 500 }
    );
  }
}
