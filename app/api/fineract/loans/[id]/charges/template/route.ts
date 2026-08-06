import { NextRequest, NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    
    const data = await fetchFineractAPI(`/loans/${loanId}/charges/template`, {
      authMode: "service",
      method: "GET",
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching loan charge template:", error);
    return buildFineractErrorResponse(error);
  }
}
