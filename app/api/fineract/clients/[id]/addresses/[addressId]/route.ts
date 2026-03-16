import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * PUT /api/fineract/clients/[id]/addresses/[addressId]
 * Updates a specific address for a client.
 * Fineract endpoint: PUT /client/{clientId}/addresses?type={addressTypeId}
 * The path param [addressId] is actually the addressTypeId used as the query param.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const { id, addressId: addressTypeId } = await params;
    const body = await request.json();

    const addressType =
      typeof body.addressType === "string"
        ? parseInt(body.addressType)
        : body.addressType ?? parseInt(addressTypeId);

    if (!addressType || isNaN(addressType)) {
      return NextResponse.json(
        { error: "addressType is required and must be a valid number (ID)" },
        { status: 400 }
      );
    }

    if (!body.addressId) {
      return NextResponse.json(
        { error: "addressId is required in the request body" },
        { status: 400 }
      );
    }

    const payload: Record<string, any> = {
      addressId:
        typeof body.addressId === "string"
          ? parseInt(body.addressId)
          : body.addressId,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : false,
    };

    const stringFields = [
      "addressLine1",
      "addressLine2",
      "addressLine3",
      "city",
      "postalCode",
    ] as const;
    for (const field of stringFields) {
      if (body[field]) payload[field] = body[field];
    }

    const numericFields = ["stateProvinceId", "countryId"] as const;
    for (const field of numericFields) {
      if (body[field]) {
        payload[field] =
          typeof body[field] === "string"
            ? parseInt(body[field])
            : body[field];
      }
    }

    console.log(
      "Sending address update payload to Fineract:",
      JSON.stringify(payload)
    );

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
