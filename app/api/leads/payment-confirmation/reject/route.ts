import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma";
import prisma from "@/lib/prisma";
import { fetchFineractAPI } from "@/lib/api";
import { requirePaymentConfirmationAccess } from "@/lib/payment-confirmation-access";
import { formatDateForFineractUndo } from "@/lib/bulk-repayment-reverse";
import { getPipelineStageNameForLoanAction } from "@/lib/fineract-stage-sync";

type RejectItemInput = {
  paymentReference?: string | null;
  loanExternalId?: string | null;
  fineractLoanId?: number | string | null;
  fineractClientId?: number | string | null;
  loanAccountNo?: string | null;
  clientName?: string | null;
};

const PAYMENT_CONFIRMATION_LOAN_LOOKUP_REPORT =
  "LM_PAYMENT_CONFIRMATION_LOAN_BY_EXTERNAL_ID";

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeReportKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function getReportHeaderName(header: unknown): string {
  if (typeof header === "string") return header;
  const record = asRecord(header);
  if (!record) return "";
  return String(
    record.columnName ||
      record.columnDisplayName ||
      record.displayName ||
      record.name ||
      ""
  );
}

function normalizeReportRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }

  const root = asRecord(payload);
  const headers = Array.isArray(root?.columnHeaders)
    ? root.columnHeaders.map(getReportHeaderName)
    : [];
  const data = Array.isArray(root?.data) ? root.data : [];

  return data
    .map((item) => {
      const record = asRecord(item);
      const row = Array.isArray(record?.row)
        ? record.row
        : Array.isArray(item)
          ? item
          : null;

      if (!row) return record;

      return headers.reduce<Record<string, unknown>>((acc, header, index) => {
        if (header) acc[header] = row[index];
        return acc;
      }, {});
    })
    .filter((item): item is Record<string, unknown> => Boolean(item));
}

function getReportField(
  row: Record<string, unknown>,
  aliases: string[]
): unknown {
  const normalizedAliases = new Set(aliases.map(normalizeReportKey));
  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.has(normalizeReportKey(key))) {
      return value;
    }
  }
  return null;
}

async function lookupLoanByExternalId(loanExternalId: string) {
  if (!loanExternalId) return null;

  const reportPayload = await fetchFineractAPI(
    `/runreports/${PAYMENT_CONFIRMATION_LOAN_LOOKUP_REPORT}?genericResultSet=false&R_loanExternalId=${encodeURIComponent(
      loanExternalId
    )}`,
    {
      authMode: "service",
      cache: "no-store",
    }
  );
  const row = normalizeReportRows(reportPayload)[0];
  if (!row) return null;

  return {
    fineractLoanId: parseOptionalInt(
      getReportField(row, ["loan_id", "loanId", "id"])
    ),
    fineractClientId: parseOptionalInt(
      getReportField(row, ["client_id", "clientId"])
    ),
    loanAccountNo:
      normalizeReference(getReportField(row, ["account_no", "accountNo"])) ||
      null,
    clientName:
      normalizeReference(getReportField(row, ["client_name", "clientName"])) ||
      null,
    externalId:
      normalizeReference(getReportField(row, ["external_id", "externalId"])) ||
      loanExternalId,
    raw: reportPayload,
  };
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
      const loanExternalId =
        normalizeReference(item.loanExternalId) ||
        lookupLog?.paymentUserReference ||
        paymentReference;
      const loanLookup = await lookupLoanByExternalId(loanExternalId);
      const fineractLoanId =
        loanLookup?.fineractLoanId ??
        parseOptionalInt(item.fineractLoanId) ??
        lookupLog?.fineractLoanId ??
        null;
      const fineractClientId =
        loanLookup?.fineractClientId ??
        parseOptionalInt(item.fineractClientId) ??
        lookupLog?.fineractClientId ??
        null;
      const loanAccountNo =
        loanLookup?.loanAccountNo ||
        normalizeReference(item.loanAccountNo) ||
        lookupLog?.loanAccountNo ||
        null;
      const clientName =
        loanLookup?.clientName ||
        normalizeReference(item.clientName) ||
        lookupLog?.clientName ||
        null;

      if (!fineractLoanId) {
        const errorMessage = `No Fineract loan was found for loan externalId ${loanExternalId}`;
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
            requestPayload: {
              ...item,
              loanExternalId,
            } as Prisma.InputJsonValue,
            responsePayload: {
              loanLookup,
            } as Prisma.InputJsonValue,
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
          requestPayload: {
            ...item,
            loanExternalId,
          } as Prisma.InputJsonValue,
          responsePayload: {
            loanLookup,
            commands: commandResults,
          } as Prisma.InputJsonValue,
        },
      });

      results.push({
        paymentReference,
        fineractLoanId,
        loanExternalId,
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
