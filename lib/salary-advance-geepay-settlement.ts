import prisma from "@/lib/prisma";
import { fetchFineractAPI } from "@/lib/api";
import { getRequiredLoanMatrixBackendPaymentCallbackUrl } from "@/lib/loan-matrix-be-payment-callback";
import type { TenantAutoProgressToDisbursementRule } from "@/shared/types/tenant";

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
 * Payment Service receives the existing internal Loan Matrix Backend endpoint;
 * the backend owns every terminal payment state change.
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
    const callbackUrl = getRequiredLoanMatrixBackendPaymentCallbackUrl();
    // Persist the callback correlation before the payment request leaves this
    // process. GeePay can complete quickly enough for Payment Service to call
    // the backend before this HTTP request returns.
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
