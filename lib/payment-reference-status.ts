const DEFAULT_PAYMENT_SERVICE_BASE_URL = "https://payment.kenac.tech";
const PAYMENT_LOOKUP_TIMEOUT_MS = 5000;

export type PaymentReferenceStatus = {
  referenceNumber: string;
  amount?: number;
  currency?: string;
  phoneNumber?: string;
  tenantId?: string;
  narration?: string;
  status: string;
  type?: string;
};

type PaymentReferenceLookupResponse = {
  referenceNumber?: unknown;
  amount?: unknown;
  currency?: unknown;
  phoneNumber?: unknown;
  tenantId?: unknown;
  narration?: unknown;
  status?: unknown;
  type?: unknown;
};

export type UssdYangoPaymentCandidate = {
  referenceNumber?: string | null;
  loanMatrixLoanProductId?: number | null;
  loanProductName?: string | null;
  loanProductDisplayName?: string | null;
};

function paymentServiceBaseUrl(): string {
  return (
    process.env.PAYMENT_SERVICE_BASE_URL ||
    process.env.PAYMENT_GATEWAY_BASE_URL ||
    DEFAULT_PAYMENT_SERVICE_BASE_URL
  ).replace(/\/$/, "");
}

function toCleanString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function isYangoUssdPaymentCandidate(
  candidate: UssdYangoPaymentCandidate
): boolean {
  if (candidate.loanMatrixLoanProductId === 12) {
    return true;
  }

  const productName = `${candidate.loanProductName ?? ""} ${
    candidate.loanProductDisplayName ?? ""
  }`.toLowerCase();

  return productName.includes("yango");
}

export function normalizePaymentReferenceStatus(
  data: PaymentReferenceLookupResponse
): PaymentReferenceStatus | null {
  const referenceNumber = toCleanString(data.referenceNumber);
  const status = toCleanString(data.status);

  if (!referenceNumber || !status) {
    return null;
  }

  return {
    referenceNumber,
    amount: toOptionalNumber(data.amount),
    currency: toCleanString(data.currency) ?? undefined,
    phoneNumber: toCleanString(data.phoneNumber) ?? undefined,
    tenantId: toCleanString(data.tenantId) ?? undefined,
    narration: toCleanString(data.narration) ?? undefined,
    status: status.toUpperCase(),
    type: toCleanString(data.type)?.toUpperCase(),
  };
}

export async function fetchPaymentStatusByReference(
  referenceNumber: string
): Promise<PaymentReferenceStatus | null> {
  const cleanReference = toCleanString(referenceNumber);
  if (!cleanReference) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAYMENT_LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${paymentServiceBaseUrl()}/api/v1/payments/${encodeURIComponent(
        cleanReference
      )}`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      console.warn(
        `[PaymentReference] Lookup failed for ${cleanReference}: ${response.status}`
      );
      return null;
    }

    const data = (await response.json()) as PaymentReferenceLookupResponse;
    return normalizePaymentReferenceStatus(data);
  } catch (error) {
    console.warn(
      `[PaymentReference] Lookup failed for ${cleanReference}:`,
      error
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function buildYangoPaymentStatusMap<
  T extends UssdYangoPaymentCandidate
>(candidates: T[]): Promise<Map<string, PaymentReferenceStatus>> {
  const uniqueReferences = Array.from(
    new Set(
      candidates
        .filter(isYangoUssdPaymentCandidate)
        .map((candidate) => toCleanString(candidate.referenceNumber))
        .filter((reference): reference is string => Boolean(reference))
    )
  );

  if (uniqueReferences.length === 0) {
    return new Map();
  }

  const statuses = await Promise.all(
    uniqueReferences.map(async (reference) => ({
      reference,
      status: await fetchPaymentStatusByReference(reference),
    }))
  );

  return new Map(
    statuses
      .filter(
        (entry): entry is { reference: string; status: PaymentReferenceStatus } =>
          entry.status !== null
      )
      .map(({ reference, status }) => [reference, status])
  );
}
