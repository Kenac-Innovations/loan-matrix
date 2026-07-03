import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { processUssdApplicationToDisbursement } from "@/lib/ussd-loan-processing-service";

/**
 * POST /api/ussd-leads/[id]/submit
 * Creates or reuses the lead and Fineract loan, evaluates CDE, and returns the
 * resulting automatic-processing status.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const applicationId = Number(id);

    if (Number.isNaN(applicationId)) {
      return NextResponse.json(
        { error: "Invalid application id" },
        { status: 400 }
      );
    }

    let incoming: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object") {
        incoming = parsed as Record<string, unknown>;
      }
    } catch {
      // The optional lead ID payload may be omitted.
    }

    const leadId =
      typeof incoming.leadId === "string" ? incoming.leadId : null;
    const application = await prisma.ussdLoanApplication.findFirst({
      where: { loanApplicationUssdId: applicationId },
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const result = await processUssdApplicationToDisbursement({
      application,
      leadId,
      triggeredBy: "system",
    });

    return NextResponse.json({
      success: result.success,
      coreResponse: result.coreResponse ?? { resourceId: result.loanId },
      cdeResult: result.cdeResult,
      autoProgressMessage: result.autoProgressMessage,
      status: result.status,
    });
  } catch (error: unknown) {
    type LoanCreationError = {
      status?: number;
      errorData?: {
        defaultUserMessage?: string;
        errors?: Array<{ defaultUserMessage?: string }>;
      };
      message?: string;
    };

    const loanCreationError = error as LoanCreationError;
    console.error(
      "Error creating loan from USSD application:",
      loanCreationError
    );

    if (loanCreationError.status && loanCreationError.errorData) {
      return NextResponse.json(
        {
          error: loanCreationError.message,
          status: loanCreationError.status,
          errorData: loanCreationError.errorData,
        },
        { status: loanCreationError.status }
      );
    }

    return NextResponse.json(
      { error: loanCreationError.message || "Unknown error" },
      { status: 500 }
    );
  }
}
