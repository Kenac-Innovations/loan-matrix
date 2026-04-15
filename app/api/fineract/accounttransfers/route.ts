import { NextRequest, NextResponse } from "next/server";
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
    if (error.status && error.errorData) {
      return NextResponse.json(error.errorData, { status: error.status });
    }
    return NextResponse.json(
      { error: error.message || "Failed to create account transfer" },
      { status: 500 }
    );
  }
}
