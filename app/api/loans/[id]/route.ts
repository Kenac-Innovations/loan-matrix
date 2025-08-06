import { NextRequest, NextResponse } from "next/server";
import { fetchFineractAPI } from "@/lib/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const loanId = parseInt(id);

    if (isNaN(loanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 });
    }

    const data = await fetchFineractAPI(`/loans/${loanId}`);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to get loan details:", error);
    return NextResponse.json(
      { error: "Failed to get loan details" },
      { status: 500 }
    );
  }
} 