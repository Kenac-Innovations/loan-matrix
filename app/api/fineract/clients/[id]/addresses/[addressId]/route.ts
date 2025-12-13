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
      "Sending address update payload to Fineract:",
      JSON.stringify(payload)
    );

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
