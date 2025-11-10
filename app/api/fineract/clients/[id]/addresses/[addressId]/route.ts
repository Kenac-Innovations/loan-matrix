import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * PUT /api/fineract/clients/[id]/addresses/[addressId]
 * Updates a specific address for a client
 * Note: Fineract uses the address type as a query parameter, not the address ID in the path
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Extract addressType from the body - this is used as the query parameter
    // Ensure it's a number (ID), not a string name
    let addressType = body.addressType;

    // If addressType is a string (name), we need to convert it to ID
    // But for now, ensure it's a number
    if (typeof addressType === "string") {
      addressType = parseInt(addressType);
    }

    if (!addressType || isNaN(addressType)) {
      return NextResponse.json(
        {
          error: "addressType is required and must be a valid number (ID)",
        },
        { status: 400 }
      );
    }

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
    // And uses the address type as a query parameter: /client/{id}/addresses?type={addressType}
    const data = await fetchFineractAPI(
      `/client/${id}/addresses?type=${addressType}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error updating client address:", error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          error?.errorData?.defaultUserMessage ||
          "Failed to update client address",
        details: error?.errorData || null,
      },
      { status: error?.status || 500 }
    );
  }
}

/**
 * DELETE /api/fineract/clients/[id]/addresses/[addressId]
 * Deletes a specific address for a client
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { id, addressId } = await params;

    // Note: Fineract uses singular "client" not "clients" for addresses endpoint
    const data = await fetchFineractAPI(
      `/client/${id}/addresses/${addressId}`,
      {
        method: "DELETE",
      }
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error deleting client address:", error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          error?.errorData?.defaultUserMessage ||
          "Failed to delete client address",
        details: error?.errorData || null,
      },
      { status: error?.status || 500 }
    );
  }
}
