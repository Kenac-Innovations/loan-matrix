import { NextRequest, NextResponse } from "next/server";
import { createCourtProceeding, getLoanCourtData } from "@/lib/fineract-recoveries";
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
    const courtData = await getLoanCourtData(loanId);
    const existingCase = courtData.cases[0] as Record<string, unknown> | undefined;
    if (!existingCase) {
      return NextResponse.json(
        { error: "Start a court case before adding court proceedings" },
        { status: 409 }
      );
    }

    const existingCaseNumber = typeof existingCase.case_number === "string" ? existingCase.case_number : undefined;
    const caseNumber = typeof body.caseNumber === "string" && body.caseNumber.trim()
      ? body.caseNumber.trim()
      : existingCaseNumber;
    const missingFields = [
      caseNumber ? null : "Case number",
      typeof body.proceedingDate === "string" && body.proceedingDate.trim() ? null : "Proceeding date",
      typeof body.proceedingType === "string" && body.proceedingType.trim() ? null : "Type",
      typeof body.status === "string" && body.status.trim() ? null : "Status",
    ].filter(Boolean);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Required fields missing: ${missingFields.join(", ")}` },
        { status: 400 }
      );
    }

    const result = await createCourtProceeding(
      loanId,
      {
        caseNumber,
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
