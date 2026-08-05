import { NextRequest, NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { fetchFineractAPI } from "@/lib/api";

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; chargeId: string }>;
  }
) {
  try {
    const { id: loanId, chargeId } = await params;
    const body = await request.json().catch(() => ({}));
    const search = new URL(request.url).search;

    const data = await fetchFineractAPI(
      `/loans/${loanId}/charges/${chargeId}${search}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error processing loan charge action:", error);
    return buildFineractErrorResponse(error);
  }
}
