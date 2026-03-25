import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { getFineractErrorMessage } from "@/lib/fineract-error";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    
    const data = await fetchFineractAPI(
      `/loans/${loanId}/transactions/template?command=creditBalanceRefund&locale=en&dateFormat=dd MMMM yyyy`
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching credit balance refund template:", error);
    const status = error.status || 500;
    return NextResponse.json(
      { error: getFineractErrorMessage(error) },
      { status }
    );
  }
}
