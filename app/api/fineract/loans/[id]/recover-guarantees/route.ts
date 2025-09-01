import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * POST /api/fineract/loans/[id]/recover-guarantees
 * Proxies to Fineract's loan recoverGuarantees command endpoint
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loanId } = await params;
    const body = await request.json();

    const data = await fetchFineractAPI(`/loans/${loanId}?command=recoverGuarantees`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error recovering from guarantor:", error);
    if (error.status && error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to recover from guarantor" },
      { status: 500 }
    );
  }
}
