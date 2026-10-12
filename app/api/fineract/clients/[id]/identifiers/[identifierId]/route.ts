import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";

/**
 * DELETE /api/fineract/clients/[id]/identifiers/[identifierId]
 * Deletes an identifier (identity document) for a client
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; identifierId: string }> }
) {
  try {
    const { id, identifierId } = await params;
    const data = await fetchFineractAPI(
      `/clients/${id}/identifiers/${identifierId}`,
      {
        method: "DELETE",
      }
    );
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error deleting client identifier:", error);
    return buildFineractErrorResponse(error, {
      action: "delete",
      resource: "client identifier",
    });
  }
}
