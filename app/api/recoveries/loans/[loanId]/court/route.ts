import { NextRequest, NextResponse } from "next/server";
import { getLoanCourtData } from "@/lib/fineract-recoveries";
import { parseLoanId } from "@/app/api/recoveries/_utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ loanId: string }> }
) {
  try {
    const { loanId: rawLoanId } = await params;
    const loanId = parseLoanId(rawLoanId);
    if (!loanId) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 });
    }

    const data = await getLoanCourtData(loanId);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error fetching loan court data:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch loan court data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
