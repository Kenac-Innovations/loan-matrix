import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { processUssdApplicationToDisbursement } from "@/lib/ussd-loan-processing-service";
import {
  claimUssdApplicationForProcessing,
  finalizeUssdApplicationProcessing,
  type UssdProcessingClaim,
} from "@/lib/ussd-processing-claim";

const APPLICATION_STATUS_BY_OUTCOME = {
  completed: "AUTO_DISBURSED",
  manual_review: "MANUAL_REVIEW",
  stopped: "AUTO_PROCESSING_STOPPED",
  failed: "AUTO_PROCESSING_FAILED",
} as const;

function buildProcessingNotes(result: {
  leadId: string;
  cdeDecision: string | null;
  autoProgressMessage: string | null;
}) {
  const reason =
    result.autoProgressMessage ||
    (result.cdeDecision
      ? `CDE returned ${result.cdeDecision}`
      : "CDE evaluation failed");

  return `Lead ${result.leadId}: ${reason}`;
}

/**
 * POST /api/ussd-leads/[id]/submit
 * Creates or reuses the lead and Fineract loan, evaluates CDE, and returns the
 * resulting automatic-processing status.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let claimedApplicationId: string | null = null;
  let claimedTenantId: string | null = null;
  let claim: UssdProcessingClaim | null = null;

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

    claim = await claimUssdApplicationForProcessing(prisma, application.id, {
      tenantId: application.tenantId,
    });
    if (!claim) {
      return NextResponse.json(
        {
          error:
            "Application is already being processed or is no longer available for submission",
        },
        { status: 409 }
      );
    }
    claimedApplicationId = application.id;
    claimedTenantId = application.tenantId;

    const result = await processUssdApplicationToDisbursement({
      application,
      leadId,
      triggeredBy: "system",
    });

    const finalized = await finalizeUssdApplicationProcessing(
      prisma,
      application.id,
      claim.token,
      {
        status: APPLICATION_STATUS_BY_OUTCOME[result.status],
        processedAt: new Date(),
        processingNotes: buildProcessingNotes(result),
      },
      application.tenantId
    );

    if (!finalized) {
      return NextResponse.json(
        {
          error:
            "Application processing lease expired or was replaced; no stale result was persisted",
        },
        { status: 409 }
      );
    }

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

    if (claimedApplicationId && claim) {
      try {
        const finalized = await finalizeUssdApplicationProcessing(
          prisma,
          claimedApplicationId,
          claim.token,
          {
            status: "AUTO_PROCESSING_FAILED",
            processedAt: new Date(),
            processingNotes: `Automatic processing failed: ${
              loanCreationError.message || "Unknown error"
            }`,
          },
          claimedTenantId ?? undefined
        );

        if (!finalized) {
          console.warn(
            `[USSD Submit] Lease lost before recording failure for application ${claimedApplicationId}; leaving the newer worker's result untouched`
          );
        }
      } catch (finalizationError) {
        console.error(
          `[USSD Submit] Failed to persist processing failure for application ${claimedApplicationId}:`,
          finalizationError
        );
      }
    }

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
