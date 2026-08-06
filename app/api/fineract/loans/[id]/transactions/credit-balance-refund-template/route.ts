import { NextRequest, NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    
    const data = await fetchFineractAPI(
      `/loans/${loanId}/transactions/template?command=creditBalanceRefund&locale=en&dateFormat=dd MMMM yyyy`,
      {
        authMode: "service",
      }
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching credit balance refund template:", error);
    return buildFineractErrorResponse(error);
  }
}
