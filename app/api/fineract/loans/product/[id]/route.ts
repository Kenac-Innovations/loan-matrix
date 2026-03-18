import { NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

/**
 * GET /api/fineract/loans/product/[id]
 * Fetches a single loan product from Fineract, including topup configuration.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await fetchFineractAPI(`/loanproducts/${id}`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching loan product:", error);
    return NextResponse.json(
      { error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
