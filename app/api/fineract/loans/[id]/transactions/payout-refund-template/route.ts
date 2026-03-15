import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    
    const data = await fetchFineractAPI(
      `/loans/${loanId}/transactions/template?command=payoutRefund&locale=en&dateFormat=dd MMMM yyyy`
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching payout refund template:", error);
    if (error.status && error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to fetch payout refund template" },
      { status: 500 }
    );
  }
}