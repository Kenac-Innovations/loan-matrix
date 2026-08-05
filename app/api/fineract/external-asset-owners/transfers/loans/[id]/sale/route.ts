import { NextRequest, NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { fetchFineractAPI } from "@/lib/api";

/**
 * POST /api/fineract/external-asset-owners/transfers/loans/[id]/sale
 * Proxies to Fineract's loan sale command endpoint
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const loanId = parseInt(id);

    if (isNaN(loanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 });
    }

    const payload = await request.json();

    const data = await fetchFineractAPI(`/external-asset-owners/transfers/loans/${loanId}?command=sale`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error selling loan:", error);
    return buildFineractErrorResponse(error);
  }
}
