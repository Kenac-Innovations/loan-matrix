import { NextRequest, NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { fetchFineractAPI } from "@/lib/api";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const { id: loanId, documentId } = await params;
    
    const data = await fetchFineractAPI(`/loans/${loanId}/documents/${documentId}`, {
      method: "DELETE",
    });
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error deleting document:", error);
    return buildFineractErrorResponse(error);
  }
}
