import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const data = await fetchFineractAPI(`/loans/${loanId}/notes`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching loan notes:", error);
    
    // If it's a Fineract API error with status code, preserve it
    if (error.status && error.errorData) {
      return NextResponse.json(
        error.errorData,
        { status: error.status }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch loan notes" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const body = await request.json();
    
    if (!body.note) {
      return NextResponse.json(
        { error: "Note content is required" },
        { status: 400 }
      );
    }
    
    const data = await fetchFineractAPI(`/loans/${loanId}/notes`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error creating note:", error);
    
    // If it's a Fineract API error with status code, preserve it
    if (error.status && error.errorData) {
      return NextResponse.json(
        error.errorData,
        { status: error.status }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to create note" },
      { status: 500 }
    );
  }
}
