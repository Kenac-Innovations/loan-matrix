import { NextRequest, NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const data = await fetchFineractAPI(`/loans/${loanId}/notes`, {
      authMode: "service",
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching loan notes:", error);
    return buildFineractErrorResponse(error);
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
    return buildFineractErrorResponse(error);
  }
}
