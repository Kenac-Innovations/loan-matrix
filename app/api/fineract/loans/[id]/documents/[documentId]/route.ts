import { NextRequest, NextResponse } from "next/server";
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
    
    // If it's a Fineract API error with status code, preserve it
    if (error.status && error.errorData) {
      return NextResponse.json(
        error.errorData,
        { status: error.status }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to delete document" },
      { status: 500 }
    );
  }
}
