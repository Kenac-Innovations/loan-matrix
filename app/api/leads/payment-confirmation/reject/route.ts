import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma";
import prisma from "@/lib/prisma";
import { fetchFineractAPI } from "@/lib/api";
import { requirePaymentConfirmationAccess } from "@/lib/payment-confirmation-access";
import { formatDateForFineractUndo } from "@/lib/bulk-repayment-reverse";
import { getPipelineStageNameForLoanAction } from "@/lib/fineract-stage-sync";

type RejectItemInput = {
  paymentReference?: string | null;
  fineractLoanId?: number | string | null;
  fineractClientId?: number | string | null;
  loanAccountNo?: string | null;
  clientName?: string | null;
};

type CommandResult = {
  command: string;
  status: "SUCCESS" | "FAILED";
  response?: unknown;
  error?: string;
};

function normalizeReference(value: unknown): string {
  return String(value ?? "").trim();
}

function parseOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function getErrorMessage(error: unknown): string {
  const details = error as {
    message?: string;
    errorData?: {
      defaultUserMessage?: string;
      developerMessage?: string;
      error?: string;
      errors?: Array<{
        defaultUserMessage?: string;
        developerMessage?: string;
      }>;
    };
  };

  return (
    details.errorData?.errors?.[0]?.defaultUserMessage ||
    details.errorData?.errors?.[0]?.developerMessage ||
    details.errorData?.defaultUserMessage ||
    details.errorData?.developerMessage ||
    details.errorData?.error ||
    details.message ||
    "Fineract command failed"
  );
}

async function runOptionalFineractCommand(
  loanId: number,
  command: string,
  body: Record<string, unknown>
): Promise<CommandResult> {
  try {
    const response = await fetchFineractAPI(`/loans/${loanId}?command=${command}`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return { command, status: "SUCCESS", response };
  } catch (error) {
    return { command, status: "FAILED", error: getErrorMessage(error) };
  }
}

async function runRequiredFineractCommand(
  loanId: number,
  command: string,
  body: Record<string, unknown>
): Promise<CommandResult> {
  try {
    const response = await fetchFineractAPI(`/loans/${loanId}?command=${command}`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return { command, status: "SUCCESS", response };
  } catch (error) {
    return { command, status: "FAILED", error: getErrorMessage(error) };
  }
}

async function markLeadRejected(
  tenantId: string,
  loanId: number,
  actorName: string
) {
  const targetStageName = getPipelineStageNameForLoanAction("reject");
  if (!targetStageName) return;

  const lead = await prisma.lead.findFirst({
    where: { tenantId, fineractLoanId: loanId },
    select: { id: true, currentStageId: true },
  });
  if (!lead) return;

  const targetStage = await prisma.pipelineStage.findFirst({
    where: { tenantId, name: targetStageName, isActive: true },
    select: { id: true },
  });
  if (!targetStage || lead.currentStageId === targetStage.id) return;

  await prisma.stateTransition.create({
    data: {
      leadId: lead.id,
      tenantId,
      fromStageId: lead.currentStageId || targetStage.id,
      toStageId: targetStage.id,
      event: "loan_reject",
      triggeredBy: actorName,
      triggeredAt: new Date(),
      metadata: {
        loanId,
        source: "payment-confirmation",
      },
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      currentStageId: targetStage.id,
      status: "REJECTED",
      updatedAt: new Date(),
      lastModified: new Date(),
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const access = await requirePaymentConfirmationAccess();
    if (!access.ok) return access.response;

    const body = await request.json();
    const uploadId = normalizeReference(body?.uploadId);
    const items = Array.isArray(body?.items)
      ? (body.items as RejectItemInput[])
      : [];
    const baseNote =
      normalizeReference(body?.note) ||
      "Rejected after payment confirmation lookup returned no matching payment";

    if (!uploadId) {
      return NextResponse.json({ error: "uploadId is required" }, { status: 400 });
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: "At least one payment reference is required" },
        { status: 400 }
      );
    }

    const upload = await prisma.paymentConfirmationUpload.findFirst({
      where: { id: uploadId, tenantId: access.tenant.id },
      select: { id: true },
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    const paymentReferences = items
      .map((item) => normalizeReference(item.paymentReference))
      .filter(Boolean);
    const lookupLogs = await prisma.paymentConfirmationActionLog.findMany({
      where: {
        tenantId: access.tenant.id,
        uploadId,
        action: "LOOKUP",
        paymentReference: { in: paymentReferences },
      },
      orderBy: [{ rowNumber: "asc" }, { createdAt: "asc" }],
    });
    const lookupByReference = new Map(
      lookupLogs.map((log) => [log.paymentReference, log])
    );

    const results = [];

    for (const item of items) {
      const paymentReference = normalizeReference(item.paymentReference);
      if (!paymentReference) continue;

      const lookupLog = lookupByReference.get(paymentReference);
      const fineractLoanId =
        parseOptionalInt(item.fineractLoanId) ?? lookupLog?.fineractLoanId ?? null;
      const fineractClientId =
        parseOptionalInt(item.fineractClientId) ??
        lookupLog?.fineractClientId ??
        null;
      const loanAccountNo =
        normalizeReference(item.loanAccountNo) || lookupLog?.loanAccountNo || null;
      const clientName =
        normalizeReference(item.clientName) || lookupLog?.clientName || null;

      if (!fineractLoanId) {
        const errorMessage = "No Fineract loan ID was available for this reference";
        await prisma.paymentConfirmationActionLog.create({
          data: {
            tenantId: access.tenant.id,
            uploadId,
            rowNumber: lookupLog?.rowNumber ?? null,
            paymentReference,
            matched: false,
            action: "REJECT_LOAN",
            actionStatus: "FAILED",
            fineractClientId,
            loanAccountNo,
            clientName,
            actedById: access.actorId,
            actedByName: access.actorName,
            errorMessage,
            requestPayload: item as Prisma.InputJsonValue,
          },
        });
        results.push({ paymentReference, status: "FAILED", error: errorMessage });
        continue;
      }

      const note = `${baseNote}. Payment reference: ${paymentReference}`;
      const commandResults: CommandResult[] = [];
      commandResults.push(
        await runOptionalFineractCommand(fineractLoanId, "undodisbursal", {
          note,
        })
      );
      commandResults.push(
        await runOptionalFineractCommand(fineractLoanId, "undoapproval", {
          note,
        })
      );
      const rejectResult = await runRequiredFineractCommand(
        fineractLoanId,
        "reject",
        {
          rejectedOnDate: formatDateForFineractUndo(new Date()),
          dateFormat: "dd MMMM yyyy",
          locale: "en",
          note,
        }
      );
      commandResults.push(rejectResult);

      const succeeded = rejectResult.status === "SUCCESS";
      const errorMessage = succeeded ? null : rejectResult.error || "Reject failed";

      if (succeeded) {
        await markLeadRejected(
          access.tenant.id,
          fineractLoanId,
          access.actorName
        );
        await prisma.paymentConfirmationActionLog.updateMany({
          where: {
            tenantId: access.tenant.id,
            uploadId,
            action: "LOOKUP",
            paymentReference,
          },
          data: {
            actionStatus: "REJECTED",
          },
        });
      }

      await prisma.paymentConfirmationActionLog.create({
        data: {
          tenantId: access.tenant.id,
          uploadId,
          rowNumber: lookupLog?.rowNumber ?? null,
          paymentReference,
          matched: false,
          action: "REJECT_LOAN",
          actionStatus: succeeded ? "SUCCESS" : "FAILED",
          leadId: lookupLog?.leadId ?? null,
          fineractLoanId,
          fineractClientId,
          loanAccountNo,
          clientName,
          actedById: access.actorId,
          actedByName: access.actorName,
          errorMessage,
          requestPayload: item as Prisma.InputJsonValue,
          responsePayload: { commands: commandResults } as Prisma.InputJsonValue,
        },
      });

      results.push({
        paymentReference,
        fineractLoanId,
        status: succeeded ? "SUCCESS" : "FAILED",
        commands: commandResults,
        error: errorMessage,
      });
    }

    const rejectedReferences = results
      .filter((result) => result.status === "SUCCESS")
      .map((result) => result.paymentReference);
    const failedReferences = results
      .filter((result) => result.status === "FAILED")
      .map((result) => result.paymentReference);

    await prisma.paymentConfirmationUpload.update({
      where: { id: uploadId },
      data: {
        rejectedCount: { increment: rejectedReferences.length },
        failedCount: { increment: failedReferences.length },
        status: failedReferences.length > 0 ? "PARTIAL" : "COMPLETED",
      },
    });

    return NextResponse.json({
      rejectedReferences,
      failedReferences,
      results,
    });
  } catch (error) {
    console.error("Payment confirmation reject failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reject loans",
      },
      { status: 500 }
    );
  }
}
