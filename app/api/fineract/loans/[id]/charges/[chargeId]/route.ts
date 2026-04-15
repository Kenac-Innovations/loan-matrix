import { NextRequest, NextResponse } from "next/server";
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
    if (error.status && error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to process loan charge action" },
      { status: 500 }
    );
  }
}
