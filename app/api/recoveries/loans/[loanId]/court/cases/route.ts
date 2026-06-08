import { NextRequest, NextResponse } from "next/server";
import { createCourtCase } from "@/lib/fineract-recoveries";
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
    const requiredFields = [
      ["caseNumber", "Case number"],
      ["courtName", "Court name"],
      ["status", "Status"],
      ["startedOnDate", "Started on date"],
    ] as const;
    const missingFields = requiredFields
      .filter(([field]) => !(typeof body[field] === "string" && body[field].trim()))
      .map(([, label]) => label);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Required fields missing: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await createCourtCase(
      loanId,
      {
        caseNumber: body.caseNumber,
        courtName: body.courtName,
        filingDate: body.filingDate,
        lawyerName: body.lawyerName,
        status: body.status,
        startedOnDate: body.startedOnDate,
        nextHearingDate: body.nextHearingDate,
        outcome: body.outcome,
        notes: body.notes,
      },
      await getActorName()
    );

    return NextResponse.json({ success: true, result }, { status: 201 });
  } catch (error) {
    console.error("Error creating court case:", error);
    return NextResponse.json(
      {
        error: "Failed to create court case",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
