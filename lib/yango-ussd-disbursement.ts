import type { Prisma } from "@/app/generated/prisma";
import prisma from "@/lib/prisma";
import { fetchFineractAPI } from "@/lib/api";
import { resolvePaymentTypeForPreferredMethod } from "@/lib/payment-method-resolution";
import { isYangoUssdPaymentCandidate } from "@/lib/payment-reference-status";

type JsonLike = Prisma.JsonValue | Record<string, unknown> | null | undefined;

export type YangoUssdDisbursementLead = {
  id?: string | null;
  tenantId?: string | null;
  loanProductId?: number | null;
  loanProductName?: string | null;
  mobileNo?: string | null;
  accountNumber?: string | null;
  preferredPaymentMethod?: string | null;
  stateMetadata?: JsonLike;
};

export type YangoUssdDisbursementApplication = {
  loanApplicationUssdId: number;
  referenceNumber: string;
  messageId: string;
  userPhoneNumber: string;
  loanMatrixLoanProductId: number;
  loanProductName: string;
  loanProductDisplayName: string;
  payoutMethod?: string | null;
  mobileMoneyNumber?: string | null;
  mobileMoneyProvider?: string | null;
};

export type YangoUssdDisbursementDetails = {
  externalId: string;
  accountNumber: string;
  paymentTypeId?: number;
};

function toCleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toPositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return parsed > 0 ? parsed : null;
  }

  return null;
}

function readMetadata(metadata: JsonLike): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
}

function buildApplicationWhere(
  lead: YangoUssdDisbursementLead
): Prisma.UssdLoanApplicationWhereInput | null {
  const metadata = readMetadata(lead.stateMetadata);
  const applicationId = toPositiveInteger(metadata.applicationId);
  const referenceNumber = toCleanString(metadata.referenceNumber);
  const messageId = toCleanString(metadata.messageId);
  const clauses: Prisma.UssdLoanApplicationWhereInput[] = [];

  if (applicationId) {
    clauses.push({ loanApplicationUssdId: applicationId });
  }

  if (referenceNumber) {
    clauses.push({ referenceNumber });
  }

  if (messageId) {
    clauses.push({ messageId });
  }

  if (clauses.length === 0) {
    return null;
  }

  return {
    ...(lead.tenantId ? { tenantId: lead.tenantId } : {}),
    OR: clauses,
  };
}

export async function findUssdApplicationForLead(
  lead: YangoUssdDisbursementLead
): Promise<YangoUssdDisbursementApplication | null> {
  const where = buildApplicationWhere(lead);

  if (!where) {
    return null;
  }

  return prisma.ussdLoanApplication.findFirst({
    where,
    select: {
      loanApplicationUssdId: true,
      referenceNumber: true,
      messageId: true,
      userPhoneNumber: true,
      loanMatrixLoanProductId: true,
      loanProductName: true,
      loanProductDisplayName: true,
      payoutMethod: true,
      mobileMoneyNumber: true,
      mobileMoneyProvider: true,
    },
  });
}

export function resolveYangoUssdDisbursementDetails(input: {
  lead?: YangoUssdDisbursementLead | null;
  application?: YangoUssdDisbursementApplication | null;
  paymentTypeId?: number | null;
}): YangoUssdDisbursementDetails | null {
  const lead = input.lead ?? null;
  const application = input.application ?? null;
  const metadata = readMetadata(lead?.stateMetadata);
  const referenceNumber =
    toCleanString(application?.referenceNumber) ??
    toCleanString(metadata.referenceNumber);
  const accountNumber =
    toCleanString(application?.mobileMoneyNumber) ??
    toCleanString(application?.userPhoneNumber) ??
    toCleanString(lead?.mobileNo) ??
    toCleanString(lead?.accountNumber);
  const isYango = isYangoUssdPaymentCandidate({
    referenceNumber,
    loanMatrixLoanProductId:
      application?.loanMatrixLoanProductId ??
      toPositiveInteger(metadata.loanMatrixLoanProductId) ??
      lead?.loanProductId ??
      null,
    loanProductName:
      application?.loanProductName ??
      toCleanString(metadata.loanProductName) ??
      lead?.loanProductName ??
      null,
    loanProductDisplayName: application?.loanProductDisplayName ?? null,
  });

  if (!isYango || !referenceNumber || !accountNumber) {
    return null;
  }

  return {
    externalId: referenceNumber,
    accountNumber,
    ...(input.paymentTypeId ? { paymentTypeId: input.paymentTypeId } : {}),
  };
}

export async function resolveMobileMoneyPaymentTypeId(): Promise<number | null> {
  const paymentTypes = await fetchFineractAPI("/paymenttypes");
  const paymentTypeList = Array.isArray(paymentTypes)
    ? paymentTypes
    : paymentTypes?.pageItems ?? [];
  const resolvedPaymentType = resolvePaymentTypeForPreferredMethod(
    "MOBILE_MONEY",
    paymentTypeList
  );

  return resolvedPaymentType ? Number(resolvedPaymentType.paymentTypeId) : null;
}

export async function resolveYangoUssdDisbursementDetailsForLead(
  lead: YangoUssdDisbursementLead,
  paymentTypeId?: number | null
): Promise<YangoUssdDisbursementDetails | null> {
  const application = await findUssdApplicationForLead(lead);
  const resolvedPaymentTypeId =
    (await resolveMobileMoneyPaymentTypeId()) ?? paymentTypeId ?? null;

  return resolveYangoUssdDisbursementDetails({
    lead,
    application,
    paymentTypeId: resolvedPaymentTypeId,
  });
}
