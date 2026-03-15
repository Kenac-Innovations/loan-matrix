import { NextRequest, NextResponse } from "next/server";
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
    
    // If it's a Fineract API error with status code, preserve it
    if (error.status && error.errorData) {
      return NextResponse.json(
        error.errorData,
        { status: error.status }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to update note" },
      { status: 500 }
    );
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
    
    // If it's a Fineract API error with status code, preserve it
    if (error.status && error.errorData) {
      return NextResponse.json(
        error.errorData,
        { status: error.status }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to delete note" },
      { status: 500 }
    );
  }
}
