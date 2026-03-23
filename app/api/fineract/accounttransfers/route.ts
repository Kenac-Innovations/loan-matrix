import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";
import { getFineractErrorMessage } from "@/lib/fineract-error";

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
    const status = error.status || 500;
    return NextResponse.json(
      { error: getFineractErrorMessage(error) },
      { status }
    );
  }
}
