import { NextRequest, NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const data = await fetchFineractAPI(`/loans/${loanId}/collaterals`, {
      authMode: "service",
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching loan collaterals:", error);
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
    
    const data = await fetchFineractAPI(`/loans/${loanId}/collaterals`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error creating collateral:", error);
    return buildFineractErrorResponse(error);
  }
}
