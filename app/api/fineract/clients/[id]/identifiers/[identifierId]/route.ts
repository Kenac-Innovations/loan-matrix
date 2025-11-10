import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

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

    // Extract specific error message from Fineract response
    let errorMessage = "Failed to delete identifier";

    if (error?.errorData) {
      if (
        error.errorData.errors &&
        Array.isArray(error.errorData.errors) &&
        error.errorData.errors.length > 0
      ) {
        errorMessage =
          error.errorData.errors[0].defaultUserMessage ||
          error.errorData.errors[0].developerMessage ||
          errorMessage;
      } else if (error.errorData.defaultUserMessage) {
        errorMessage = error.errorData.defaultUserMessage;
      } else if (error.errorData.developerMessage) {
        errorMessage = error.errorData.developerMessage;
      }
    } else if (error?.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error?.errorData || null,
      },
      { status: error?.status || 500 }
    );
  }
}
