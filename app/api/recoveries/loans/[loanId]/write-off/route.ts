import { NextRequest, NextResponse } from "next/server";
import { writeOffRecoveryLoan } from "@/lib/fineract-recoveries";
import { parseLoanId } from "@/app/api/recoveries/_utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ loanId: string }> }
) {
  try {
    const { loanId: rawLoanId } = await params;
    const loanId = parseLoanId(rawLoanId);
    if (!loanId) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 });
    }

    const body = await request.json();
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (!note) {
      return NextResponse.json({ error: "Note is required" }, { status: 400 });
    }

    const result = await writeOffRecoveryLoan(loanId, note);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Error writing off recovery loan:", error);
    return NextResponse.json(
      {
        error: "Failed to write off loan",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
