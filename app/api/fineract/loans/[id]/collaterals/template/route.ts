import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const data = await fetchFineractAPI(`/loans/${loanId}/collaterals/template`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching collateral template:", error);
    
    // If it's a Fineract API error with status code, preserve it
    if (error.status && error.errorData) {
      return NextResponse.json(
        error.errorData,
        { status: error.status }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch collateral template" },
      { status: 500 }
    );
  }
}
