import { NextRequest, NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
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
    return buildFineractErrorResponse(error);
  }
}
