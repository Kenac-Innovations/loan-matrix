import { NextRequest, NextResponse } from "next/server";
import { createCourtProceeding } from "@/lib/fineract-recoveries";
import { getActorName, parseLoanId } from "@/app/api/recoveries/_utils";

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
    const result = await createCourtProceeding(
      loanId,
      {
        caseNumber: body.caseNumber,
        proceedingDate: body.proceedingDate,
        proceedingType: body.proceedingType,
        status: body.status,
        nextHearingDate: body.nextHearingDate,
        outcome: body.outcome,
        notes: body.notes,
      },
      await getActorName()
    );

    return NextResponse.json({ success: true, result }, { status: 201 });
  } catch (error) {
    console.error("Error creating court proceeding:", error);
    return NextResponse.json(
      {
        error: "Failed to create court proceeding",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
