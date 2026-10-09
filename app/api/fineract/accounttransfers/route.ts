import { NextRequest, NextResponse } from "next/server";
import { buildFineractErrorResponse } from "@/lib/fineract-route-error";
import { fetchFineractAPI } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const data = await fetchFineractAPI(`/accounttransfers`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error creating account transfer:", error);
    return buildFineractErrorResponse(error);
  }
}
