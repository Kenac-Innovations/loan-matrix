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

    // Filter payload to only include supported Fineract address fields
    // Supported fields based on Fineract API: addressType, addressLine1, addressLine2, addressLine3,
    // city, stateProvinceId, countryId, postalCode, isActive
    // Unsupported fields: clientID, addressTypeId, street, townVillage, countyDistrict, latitude, longitude
    const supportedFields = [
      "addressType",
      "addressLine1",
      "addressLine2",
      "addressLine3",
      "city",
      "stateProvinceId",
      "countryId",
      "postalCode",
      "isActive",
      "dateFormat",
      "locale",
    ];

    const payload: any = {
      dateFormat: body.dateFormat || "yyyy-MM-dd",
      locale: body.locale || "en",
    };

    // Only include supported fields
    supportedFields.forEach((field) => {
      if (
        body[field] !== undefined &&
        body[field] !== null &&
        body[field] !== ""
      ) {
        // Convert IDs to numbers
        if (
          field === "addressType" ||
          field === "stateProvinceId" ||
          field === "countryId"
        ) {
          const numValue =
            typeof body[field] === "string"
              ? parseInt(body[field])
              : body[field];
          if (!isNaN(numValue)) {
            payload[field] = numValue;
          }
        } else if (field === "isActive") {
          payload[field] = Boolean(body[field]);
        } else {
          payload[field] = body[field];
        }
      }
    });

    // Note: Fineract uses singular "client" not "clients" for addresses endpoint
    const data = await fetchFineractAPI(`/client/${id}/addresses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

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
