import { NextRequest, NextResponse } from "next/server";
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
    
    // Return the actual error details from Fineract
    if (error.status && error.errorData) {
      return NextResponse.json(
        { error: error.errorData },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
