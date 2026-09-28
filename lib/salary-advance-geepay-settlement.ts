import prisma from "@/lib/prisma";
import { fetchFineractAPI } from "@/lib/api";
import type { TenantAutoProgressToDisbursementRule } from "@/shared/types/tenant";
import { getRequiredSalaryAdvancePaymentCallbackUrl } from "@/lib/salary-advance-payment-callback";

const DEFAULT_PAYMENT_SERVICE_BASE_URL = "https://payment.kenac.tech";
const PAYMENT_SERVICE_TIMEOUT_MS = 10_000;

type RecordLike = Record<string, unknown>;

type SalaryAdvanceApplication = {
  id: string;
  tenantId: string;
  loanApplicationUssdId: number;
  referenceNumber: string;
  userPhoneNumber: string;
  mobileMoneyNumber: string | null;
  paymentStatus: string | null;
};

type SettlementSnapshot = {
  settled: boolean;
  failed: boolean;
  status: string;
  providerReferenceNumber: string | null;
  failureReason: string | null;
};

export type SalaryAdvanceSettlementResult =
  | { outcome: "pending"; message: string }
  | { outcome: "settled"; message: string }
  | { outcome: "manual_review"; message: string };

function paymentServiceBaseUrl(): string {
  return (
    process.env.PAYMENT_SERVICE_BASE_URL ||
    process.env.PAYMENT_GATEWAY_BASE_URL ||
    DEFAULT_PAYMENT_SERVICE_BASE_URL
  ).replace(/\/$/, "");
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function readRecord(value: unknown): RecordLike {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as RecordLike;
}

function positiveNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const numericValue = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }
  }

  return null;
}

function truncateMessage(value: unknown, fallback: string): string {
  const message = cleanString(value) || fallback;
  return message.slice(0, 500);
}

function settlementStatusFromResponse(payload: unknown): SettlementSnapshot {
  const envelope = readRecord(payload);
  const data = readRecord(envelope.data);
  const status = (cleanString(data.status) || "PENDING").toUpperCase();

  return {
    // The gateway is authoritative here: an accepted payment request is not a
    // settlement. Payment Service exposes settled=true only after its GeePay
    // disbursement status check has confirmed the transfer.
    settled: data.settled === true,
    failed: data.failed === true || status === "FAILED" || status === "CANCELLED",
    status,
    providerReferenceNumber:
      cleanString(data.providerReferenceNumber) ??
      cleanString(data.provider_reference_number),
    failureReason: cleanString(data.failureReason) ?? cleanString(data.failure_reason),
  };
}

export function requiresGeePaySettlement(
  rule: Pick<TenantAutoProgressToDisbursementRule, "requireGeePaySettlement"> | null | undefined
): boolean {
  return rule?.requireGeePaySettlement === true;
}

async function updateLeadSettlementMetadata(
  leadId: string,
  patch: RecordLike
): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { stateMetadata: true },
  });

  if (!lead) {
    return;
  }

  const stateMetadata = readRecord(lead.stateMetadata);
  const autoDisbursement = readRecord(stateMetadata.autoDisbursement);
  const paymentSettlement = readRecord(autoDisbursement.paymentSettlement);

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      stateMetadata: {
        ...stateMetadata,
        autoDisbursement: {
          ...autoDisbursement,
          paymentSettlement: {
            ...paymentSettlement,
            ...patch,
          },
        },
      } as never,
    },
  });
}

async function findLeadForApplication(application: SalaryAdvanceApplication) {
  return prisma.lead.findFirst({
    where: {
      tenantId: application.tenantId,
      stateMetadata: {
        path: ["applicationId"],
        equals: application.loanApplicationUssdId,
      },
    },
    include: {
      tenant: {
        select: { slug: true },
      },
    },
  });
}

async function findApplicationForLeadId(
  leadId: string
): Promise<SalaryAdvanceApplication | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { tenantId: true, stateMetadata: true },
  });
  if (!lead) {
    return null;
  }

  const metadata = readRecord(lead.stateMetadata);
  const applicationId = positiveNumber(metadata.applicationId);
  const referenceNumber = cleanString(metadata.referenceNumber);
  if (!applicationId && !referenceNumber) {
    return null;
  }

  return (await prisma.ussdLoanApplication.findFirst({
    where: {
      tenantId: lead.tenantId,
      OR: [
        ...(applicationId ? [{ loanApplicationUssdId: applicationId }] : []),
        ...(referenceNumber ? [{ referenceNumber }] : []),
      ],
    },
    select: {
      id: true,
      tenantId: true,
      loanApplicationUssdId: true,
      referenceNumber: true,
      userPhoneNumber: true,
      mobileMoneyNumber: true,
      paymentStatus: true,
    },
  })) as SalaryAdvanceApplication | null;
}

async function resolveDisbursementDetails(
  fineractLoanId: number | null
): Promise<{ amount: number; loanAccountNo: string } | null> {
  if (!fineractLoanId) {
    return null;
  }

  try {
    const loan = readRecord(
      await fetchFineractAPI(`/loans/${fineractLoanId}`, {
        authMode: "service",
      })
    );
    const amount = positiveNumber(
      loan.netDisbursalAmount,
      loan.approvedPrincipal,
      loan.principal,
      loan.proposedPrincipal
    );
    if (!amount) {
      return null;
    }

    return {
      amount,
      loanAccountNo: cleanString(loan.accountNo) || String(fineractLoanId),
    };
  } catch (error) {
    console.warn(
      "[SalaryAdvanceSettlement] Could not read Fineract disbursement details:",
      error
    );
    return null;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    PAYMENT_SERVICE_TIMEOUT_MS
  );

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Starts a Salary Advance payout exactly once after Fineract has disbursed.
 * REQUESTING is written before the gateway call. If the process dies after an
 * uncertain network hand-off, the application is quarantined for review
 * rather than risking a second payout request.
 */
export async function initiateSalaryAdvanceGeePaySettlement(input: {
  leadId: string;
  rule: TenantAutoProgressToDisbursementRule;
}): Promise<SalaryAdvanceSettlementResult> {
  const application = await findApplicationForLeadId(input.leadId);

  if (!application) {
    return {
      outcome: "manual_review",
      message: "Payment settlement requires review: USSD application was not found.",
    };
  }

  const lead = await findLeadForApplication(application);
  const leadMetadata = readRecord(lead?.stateMetadata);
  const autoDisbursement = readRecord(leadMetadata.autoDisbursement);
  const existingSettlement = readRecord(autoDisbursement.paymentSettlement);
  const hasMatchingSettlementReference =
    cleanString(existingSettlement.referenceNumber) === application.referenceNumber;

  if (application.paymentStatus === "PENDING") {
    if (!hasMatchingSettlementReference) {
      return {
        outcome: "manual_review",
        message:
          "Payment settlement requires review: an unowned pending payment state already exists.",
      };
    }
    return {
      outcome: "pending",
      message: "Payment settlement pending GeePay confirmation.",
    };
  }

  if (application.paymentStatus === "COMPLETED") {
    if (!hasMatchingSettlementReference) {
      return {
        outcome: "manual_review",
        message:
          "Payment settlement requires review: an unowned completed payment state already exists.",
      };
    }
    return {
      outcome: "settled",
      message: "Payment settlement already completed.",
    };
  }

  const claimed = await prisma.ussdLoanApplication.updateMany({
    where: {
      id: application.id,
      tenantId: application.tenantId,
      paymentStatus: null,
    },
    data: {
      paymentStatus: "REQUESTING",
      processingNotes: "Salary Advance payment request prepared; awaiting Payment Service acceptance.",
    },
  });

  if (claimed.count !== 1) {
    return {
      outcome: "manual_review",
      message:
        "Payment settlement requires review: a prior payment request has an unknown outcome.",
    };
  }

  const disbursement = await resolveDisbursementDetails(
    lead?.fineractLoanId ?? null
  );
  const amount = disbursement?.amount ?? null;
  const phoneNumber = application.mobileMoneyNumber || application.userPhoneNumber;
  const paymentServiceTenantId =
    cleanString(input.rule.paymentServiceTenantId) || cleanString(lead?.tenant?.slug);

  if (
    !lead?.fineractLoanId ||
    !disbursement ||
    !amount ||
    !phoneNumber ||
    !paymentServiceTenantId
  ) {
    const message =
      "Payment settlement requires review: missing a Fineract loan, payout amount, mobile number, or Payment Service tenant.";
    await prisma.ussdLoanApplication.update({
      where: { id: application.id },
      data: { paymentStatus: "MANUAL_REVIEW", processingNotes: message },
    });
    await updateLeadSettlementMetadata(input.leadId, {
      status: "manual_review",
      reason: "missing_payment_request_data",
      updatedAt: new Date().toISOString(),
    });
    return { outcome: "manual_review", message };
  }

  try {
    const callbackUrl = getRequiredSalaryAdvancePaymentCallbackUrl();
    // Persist the callback correlation before the payment request leaves this
    // process. GeePay can complete quickly enough for Payment Service to call
    // back before this HTTP request returns.
    await updateLeadSettlementMetadata(input.leadId, {
      status: "requesting",
      referenceNumber: application.referenceNumber,
      amount,
      loanAccountNo: disbursement.loanAccountNo,
      requestedAt: new Date().toISOString(),
    });
    const response = await fetchWithTimeout(
      `${paymentServiceBaseUrl()}/api/v1/payments/disburse`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantId: paymentServiceTenantId,
          amount,
          phoneNumber,
          narration: `Salary Advance payout ${application.referenceNumber}`,
          referenceNumber: application.referenceNumber,
          callbackUrl,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Payment Service rejected the request (${response.status}).`);
    }

    const markedPending = await prisma.ussdLoanApplication.updateMany({
      where: { id: application.id, paymentStatus: "REQUESTING" },
      data: {
        paymentStatus: "PENDING",
        processingNotes:
          "Salary Advance payment accepted by Payment Service; awaiting GeePay callback.",
      },
    });

    if (markedPending.count !== 1) {
      const current = await prisma.ussdLoanApplication.findUnique({
        where: { id: application.id },
        select: { status: true, paymentStatus: true },
      });
      if (
        current?.status === "AUTO_DISBURSED" &&
        current.paymentStatus === "COMPLETED"
      ) {
        return {
          outcome: "settled",
          message: "Payment callback confirmed settlement.",
        };
      }
      return {
        outcome: "manual_review",
        message:
          "Payment settlement requires review: callback state changed before payment acceptance was recorded.",
      };
    }
    await updateLeadSettlementMetadata(input.leadId, {
      status: "pending",
      acceptedAt: new Date().toISOString(),
    });

    return {
      outcome: "pending",
      message: "Payment settlement pending GeePay confirmation.",
    };
  } catch (error) {
    const message = `Payment settlement requires review: ${truncateMessage(
      error instanceof Error ? error.message : error,
      "Payment Service could not accept the request."
    )}`;
    await prisma.ussdLoanApplication.update({
      where: { id: application.id },
      data: { paymentStatus: "MANUAL_REVIEW", processingNotes: message },
    });
    await updateLeadSettlementMetadata(input.leadId, {
      status: "manual_review",
      reason: "payment_service_request_failed",
      updatedAt: new Date().toISOString(),
    });
    return { outcome: "manual_review", message };
  }
}

export async function applySalaryAdvanceGeePayCallback(input: {
  status: string;
  referenceNumber: string;
  amount: unknown;
  customer: string | null;
  message: string | null;
  gatewayStatus: string | null;
}): Promise<SalaryAdvanceSettlementResult> {
  const application = (await prisma.ussdLoanApplication.findFirst({
    where: { referenceNumber: input.referenceNumber },
    select: {
      id: true,
      tenantId: true,
      loanApplicationUssdId: true,
      referenceNumber: true,
      userPhoneNumber: true,
      mobileMoneyNumber: true,
      paymentStatus: true,
    },
  })) as SalaryAdvanceApplication | null;

  if (!application) {
    return {
      outcome: "manual_review",
      message: "Payment callback could not be matched to a Salary Advance application.",
    };
  }

  const normalizedStatus = input.status.trim().toUpperCase();
  if (normalizedStatus !== "COMPLETED" && normalizedStatus !== "FAILED") {
    return {
      outcome: "pending",
      message: `Payment callback reported non-terminal status ${normalizedStatus}.`,
    };
  }

  const lead = await findLeadForApplication(application);
  const metadata = readRecord(lead?.stateMetadata);
  const autoDisbursement = readRecord(metadata.autoDisbursement);
  const paymentSettlement = readRecord(autoDisbursement.paymentSettlement);
  const expectedAmount = positiveNumber(paymentSettlement.amount);
  const callbackAmount = positiveNumber(input.amount);
  const hasMatchingReference =
    cleanString(paymentSettlement.referenceNumber) === application.referenceNumber;

  if (!lead?.fineractLoanId || !hasMatchingReference) {
    const message =
      "Payment callback requires review: linked Salary Advance payment metadata is missing.";
    await prisma.ussdLoanApplication.update({
      where: { id: application.id },
      data: { status: "MANUAL_REVIEW", paymentStatus: "MANUAL_REVIEW", processingNotes: message },
    });
    if (lead) {
      await updateLeadSettlementMetadata(lead.id, {
        status: "manual_review",
        reason: "missing_payment_callback_metadata",
        updatedAt: new Date().toISOString(),
      });
    }
    return { outcome: "manual_review", message };
  }

  if (
    normalizedStatus === "COMPLETED" &&
    (!expectedAmount ||
      !callbackAmount ||
      Math.abs(expectedAmount - callbackAmount) > 0.005)
  ) {
    const message =
      "Payment callback requires review: the confirmed amount does not match the disbursed Salary Advance amount.";
    await prisma.ussdLoanApplication.update({
      where: { id: application.id },
      data: { status: "MANUAL_REVIEW", paymentStatus: "MANUAL_REVIEW", processingNotes: message },
    });
    await updateLeadSettlementMetadata(lead.id, {
      status: "manual_review",
      reason: "payment_callback_amount_mismatch",
      callbackAmount,
      expectedAmount,
      updatedAt: new Date().toISOString(),
    });
    return { outcome: "manual_review", message };
  }

  const callbackNote = [
    `GeePay callback ${normalizedStatus.toLowerCase()} for ${application.referenceNumber}.`,
    input.gatewayStatus ? `Gateway status: ${input.gatewayStatus}.` : null,
    input.message ? `Message: ${input.message}.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  if (normalizedStatus === "FAILED") {
    await prisma.ussdLoanApplication.update({
      where: { id: application.id },
      data: {
        status: "MANUAL_REVIEW",
        paymentStatus: "FAILED",
        processingNotes: callbackNote,
        processedAt: new Date(),
      },
    });
    await updateLeadSettlementMetadata(lead.id, {
      status: "manual_review",
      reason: "geepay_disbursement_failed",
      callbackReceivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { outcome: "manual_review", message: callbackNote };
  }

  if (!expectedAmount || !lead.fineractClientId) {
    const message =
      "Payment callback requires review: the authoritative disbursement amount or client is missing.";
    await prisma.ussdLoanApplication.update({
      where: { id: application.id },
      data: { status: "MANUAL_REVIEW", paymentStatus: "MANUAL_REVIEW", processingNotes: message },
    });
    await updateLeadSettlementMetadata(lead.id, {
      status: "manual_review",
      reason: "missing_payment_callback_payout_data",
      updatedAt: new Date().toISOString(),
    });
    return { outcome: "manual_review", message };
  }

  const loanAccountNo =
    cleanString(paymentSettlement.loanAccountNo) || String(lead.fineractLoanId);
  await prisma.$transaction([
    prisma.loanPayout.upsert({
      where: {
        tenantId_fineractLoanId: {
          tenantId: application.tenantId,
          fineractLoanId: lead.fineractLoanId,
        },
      },
      create: {
        tenantId: application.tenantId,
        fineractLoanId: lead.fineractLoanId,
        fineractClientId: lead.fineractClientId,
        clientName:
          [lead.firstname, lead.middlename, lead.lastname]
            .filter(Boolean)
            .join(" ") || "Client",
        loanAccountNo,
        amount: expectedAmount,
        currency: "ZMW",
        status: "PAID",
        paymentMethod: "MOBILE_MONEY",
        paidAt: new Date(),
        paidBy: "system",
        notes: callbackNote,
      },
      update: {
        status: "PAID",
        paymentMethod: "MOBILE_MONEY",
        paidAt: new Date(),
        paidBy: "system",
        notes: callbackNote,
      },
    }),
    prisma.ussdLoanApplication.update({
      where: { id: application.id },
      data: {
        status: "AUTO_DISBURSED",
        paymentStatus: "COMPLETED",
        processingNotes: callbackNote,
        processedAt: new Date(),
      },
    }),
  ]);
  await updateLeadSettlementMetadata(lead.id, {
    status: "completed",
    callbackReceivedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });

  return { outcome: "settled", message: "Payment callback confirmed settlement." };
}

/**
 * This remains a manual reconciliation helper. Automatic Salary Advance
 * completion is callback-driven and does not call this function.
 */
export async function reconcileSalaryAdvanceGeePaySettlement(
  application: SalaryAdvanceApplication
): Promise<SalaryAdvanceSettlementResult> {
  const lead = await findLeadForApplication(application);
  if (!lead?.fineractLoanId) {
    return {
      outcome: "manual_review",
      message: "Payment settlement requires review: linked Fineract loan was not found.",
    };
  }

  let snapshot: SettlementSnapshot;
  try {
    const response = await fetchWithTimeout(
      `${paymentServiceBaseUrl()}/api/v1/payments/disbursements/${encodeURIComponent(
        application.referenceNumber
      )}/settlement`,
      { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" }
    );

    if (!response.ok) {
      return {
        outcome: "pending",
        message: `Payment settlement check is unavailable (${response.status}); it will be retried without sending another payout.`,
      };
    }

    snapshot = settlementStatusFromResponse(await response.json());
  } catch (error) {
    return {
      outcome: "pending",
      message: `Payment settlement check is unavailable: ${truncateMessage(
        error instanceof Error ? error.message : error,
        "temporary gateway error"
      )}`,
    };
  }

  if (snapshot.settled) {
    const metadata = readRecord(lead.stateMetadata);
    const autoDisbursement = readRecord(metadata.autoDisbursement);
    const paymentSettlement = readRecord(autoDisbursement.paymentSettlement);
    const settledAmount = positiveNumber(paymentSettlement.amount);
    const loanAccountNo =
      cleanString(paymentSettlement.loanAccountNo) || String(lead.fineractLoanId);

    if (!settledAmount || !lead.fineractClientId) {
      return {
        outcome: "manual_review",
        message:
          "Payment settlement requires review: the authoritative disbursement amount or client is missing.",
      };
    }

    const settlementNote = [
      `GeePay settlement confirmed for ${application.referenceNumber}.`,
      snapshot.providerReferenceNumber
        ? `Provider reference: ${snapshot.providerReferenceNumber}.`
        : null,
    ]
      .filter(Boolean)
      .join(" ");

    await prisma.$transaction([
      prisma.loanPayout.upsert({
        where: {
          tenantId_fineractLoanId: {
            tenantId: application.tenantId,
            fineractLoanId: lead.fineractLoanId,
          },
        },
        create: {
          tenantId: application.tenantId,
          fineractLoanId: lead.fineractLoanId,
          fineractClientId: lead.fineractClientId,
          clientName:
            [lead.firstname, lead.middlename, lead.lastname]
              .filter(Boolean)
              .join(" ") || "Client",
          loanAccountNo,
          amount: settledAmount,
          currency: "ZMW",
          status: "PAID",
          paymentMethod: "MOBILE_MONEY",
          paidAt: new Date(),
          paidBy: "system",
          notes: settlementNote,
        },
        update: {
          status: "PAID",
          paymentMethod: "MOBILE_MONEY",
          paidAt: new Date(),
          paidBy: "system",
          notes: settlementNote,
        },
      }),
      prisma.ussdLoanApplication.update({
        where: { id: application.id },
        data: {
          paymentStatus: "COMPLETED",
          processingNotes: settlementNote,
        },
      }),
    ]);
    await updateLeadSettlementMetadata(lead.id, {
      status: "completed",
      providerReferenceNumber: snapshot.providerReferenceNumber,
      settledAt: new Date().toISOString(),
    });
    return { outcome: "settled", message: "Payment settlement completed." };
  }

  if (snapshot.failed) {
    const message = `Payment settlement requires review: ${
      snapshot.failureReason || "GeePay reported a failed disbursement."
    }`;
    await prisma.ussdLoanApplication.update({
      where: { id: application.id },
      data: { paymentStatus: "FAILED", processingNotes: message },
    });
    await updateLeadSettlementMetadata(lead.id, {
      status: "manual_review",
      reason: "geepay_disbursement_failed",
      providerReferenceNumber: snapshot.providerReferenceNumber,
      updatedAt: new Date().toISOString(),
    });
    return { outcome: "manual_review", message };
  }

  await prisma.ussdLoanApplication.update({
    where: { id: application.id },
    data: { paymentStatus: "PENDING" },
  });
  await updateLeadSettlementMetadata(lead.id, {
    status: "pending",
    providerReferenceNumber: snapshot.providerReferenceNumber,
    lastCheckedAt: new Date().toISOString(),
  });
  return {
    outcome: "pending",
    message: `Payment settlement remains ${snapshot.status.toLowerCase()}.`,
  };
}
