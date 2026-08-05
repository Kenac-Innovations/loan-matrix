import { NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
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
    const data = await fetchFineractAPI(`/loanproducts/${id}`, {
      authMode: "service",
    });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching loan product:", error);
    return buildFineractErrorResponse(error);
  }
}
