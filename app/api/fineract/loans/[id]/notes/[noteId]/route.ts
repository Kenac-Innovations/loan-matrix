import { NextRequest, NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { fetchFineractAPI } from "@/lib/api";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: loanId, noteId } = await params;
    const body = await request.json();
    
    if (!body.note) {
      return NextResponse.json(
        { error: "Note content is required" },
        { status: 400 }
      );
    }
    
    const data = await fetchFineractAPI(`/loans/${loanId}/notes/${noteId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error updating note:", error);
    return buildFineractErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const { id: loanId, noteId } = await params;
    
    const data = await fetchFineractAPI(`/loans/${loanId}/notes/${noteId}`, {
      method: "DELETE",
    });
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error deleting note:", error);
    return buildFineractErrorResponse(error);
  }
}
