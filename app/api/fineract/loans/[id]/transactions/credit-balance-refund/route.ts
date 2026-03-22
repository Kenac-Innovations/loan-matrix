import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { getFineractErrorMessage } from "@/lib/fineract-error";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const body = await request.json();
    
    const data = await fetchFineractAPI(
      `/loans/${loanId}/transactions?command=creditBalanceRefund`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error creating credit balance refund:", error);
    const status = error.status || 500;
    return NextResponse.json(
      { error: getFineractErrorMessage(error) },
      { status }
    );
  }
}
