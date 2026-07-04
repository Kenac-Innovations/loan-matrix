type PaymentServicePage<T> = {
  content?: T[];
  items?: T[];
  pageItems?: T[];
  data?: T[];
  totalElements?: number;
  totalItems?: number;
  total?: number;
  totalPages?: number;
  page?: number;
  number?: number;
  size?: number;
};

type PaymentServiceEnvelope<T> = {
  data?: T;
  payload?: T;
  response?: T;
  message?: string;
  success?: boolean;
};

export type PaymentLookupPayment = {
  id?: string;
  tenantId?: string;
  configId?: string;
  amount?: number | string;
  currency?: string;
  phoneNumber?: string;
  userReferenceNumber?: string;
  user_reference_number?: string;
  internalReferenceNumber?: string;
  internal_reference_number?: string;
  providerReferenceNumber?: string | null;
  provider_reference_number?: string | null;
  narration?: string;
  status?: string;
  callbackStatus?: string;
  paymentConfirmed?: boolean;
  confirmedAt?: string | null;
  type?: string;
  createdAt?: string;
};

export type PaymentLookupResult = {
  items: PaymentLookupPayment[];
  totalElements: number;
  totalPages: number;
  raw: unknown;
};

export type PaymentConfirmationResult = {
  confirmedPaymentReferences: string[];
  confirmedAt?: string;
  raw: unknown;
};

type ConfirmedReferencesPayload = {
  confirmedPaymentReferences?: unknown;
  confirmedReferences?: unknown;
  paymentReferences?: unknown;
  references?: unknown;
  confirmedAt?: string;
};

function asPaymentEnvelope<T>(payload: unknown): PaymentServiceEnvelope<T> | T {
  return payload as PaymentServiceEnvelope<T> | T;
}

function getPaymentServiceBaseUrl(): string {
  const baseUrl =
    process.env.PAYMENT_SERVICE_BASE_URL || process.env.PAYMENT_SERVICE_URL;

  if (!baseUrl) {
    throw new Error("PAYMENT_SERVICE_BASE_URL is not configured");
  }

  return baseUrl.replace(/\/+$/, "");
}

function buildPaymentServiceUrl(path: string): string {
  const baseUrl = getPaymentServiceBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (baseUrl.endsWith("/api/v1") && normalizedPath.startsWith("/api/v1/")) {
    return `${baseUrl}${normalizedPath.replace(/^\/api\/v1/, "")}`;
  }

  return `${baseUrl}${normalizedPath}`;
}

function unwrapPaymentResponse<T>(payload: PaymentServiceEnvelope<T> | T): T {
  const envelope = payload as PaymentServiceEnvelope<T>;
  return envelope.data ?? envelope.payload ?? envelope.response ?? (payload as T);
}

function extractPageItems<T>(page: PaymentServicePage<T> | T[]): T[] {
  if (Array.isArray(page)) return page;
  return page.content ?? page.items ?? page.pageItems ?? page.data ?? [];
}

function extractConfirmedReferences(payload: unknown): string[] {
  const data = unwrapPaymentResponse<ConfirmedReferencesPayload>(
    asPaymentEnvelope<ConfirmedReferencesPayload>(payload)
  );
  const refs =
    data?.confirmedPaymentReferences ??
    data?.confirmedReferences ??
    data?.paymentReferences ??
    data?.references ??
    [];

  return Array.isArray(refs)
    ? refs.map((ref) => String(ref).trim()).filter(Boolean)
    : [];
}

async function paymentServiceRequest<T>(
  tenantId: string,
  path: string,
  init: RequestInit
): Promise<T> {
  const response = await fetch(buildPaymentServiceUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      tenantId,
      ...(init.headers as Record<string, string> | undefined),
    },
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const body = payload as { message?: string; error?: string };
    throw new Error(
      body?.message ||
        body?.error ||
        `Payment service request failed with HTTP ${response.status}`
    );
  }

  return payload as T;
}

export async function lookupPayments(
  tenantId: string,
  paymentReferences: string[],
  page = 0,
  size = paymentReferences.length
): Promise<PaymentLookupResult> {
  const raw = await paymentServiceRequest<unknown>(
    tenantId,
    `/api/v1/payments/lookup?page=${page}&size=${size}`,
    {
      method: "POST",
      body: JSON.stringify({ paymentReferences }),
    }
  );
  const pageData = unwrapPaymentResponse<
    PaymentServicePage<PaymentLookupPayment> | PaymentLookupPayment[]
  >(
    asPaymentEnvelope<
      PaymentServicePage<PaymentLookupPayment> | PaymentLookupPayment[]
    >(raw)
  );
  const items = extractPageItems(pageData);

  return {
    items,
    totalElements: Array.isArray(pageData)
      ? items.length
      : pageData.totalElements ?? pageData.totalItems ?? pageData.total ?? items.length,
    totalPages: Array.isArray(pageData) ? 1 : pageData.totalPages ?? 1,
    raw,
  };
}

export async function lookupPaymentsInBatches(
  tenantId: string,
  paymentReferences: string[],
  batchSize = 500
): Promise<PaymentLookupResult> {
  const uniqueReferences = Array.from(
    new Set(paymentReferences.map((ref) => ref.trim()).filter(Boolean))
  );
  const allItems: PaymentLookupPayment[] = [];
  const rawResponses: unknown[] = [];

  for (let index = 0; index < uniqueReferences.length; index += batchSize) {
    const batch = uniqueReferences.slice(index, index + batchSize);
    const result = await lookupPayments(tenantId, batch, 0, batch.length);
    allItems.push(...result.items);
    rawResponses.push(result.raw);
  }

  return {
    items: allItems,
    totalElements: allItems.length,
    totalPages: rawResponses.length,
    raw: rawResponses,
  };
}

export async function confirmPayments(
  tenantId: string,
  paymentReferences: string[]
): Promise<PaymentConfirmationResult> {
  const raw = await paymentServiceRequest<unknown>(
    tenantId,
    "/api/v1/payments/confirm",
    {
      method: "POST",
      body: JSON.stringify({ paymentReferences }),
    }
  );
  const data = unwrapPaymentResponse<ConfirmedReferencesPayload>(
    asPaymentEnvelope<ConfirmedReferencesPayload>(raw)
  );

  return {
    confirmedPaymentReferences: extractConfirmedReferences(raw),
    confirmedAt: data?.confirmedAt,
    raw,
  };
}
