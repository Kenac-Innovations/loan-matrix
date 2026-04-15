interface FineractErrorPayload {
  defaultUserMessage?: string;
  errors?: Array<{
    defaultUserMessage?: string;
  }>;
}

interface FineractApiError extends Error {
  status?: number;
  errorData?: FineractErrorPayload;
}

/** Fineract loan transaction undo expects "dd MMMM yyyy" to match the existing transaction undo flow. */
export function formatDateForFineractUndo(date: Date): string {
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "long" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export async function undoLoanRepaymentTransaction(params: {
  tenantSlug: string;
  loanId: number;
  fineractTransactionId: string;
  transactionDate: Date;
}): Promise<FineractErrorPayload> {
  const baseUrl = (process.env.FINERACT_BASE_URL || "http://mifos-be.kenac.co.zw").replace(/\/$/, "");
  const serviceToken =
    process.env.FINERACT_SERVICE_TOKEN || "bWlmb3M6cGFzc3dvcmQ=";

  const body = {
    dateFormat: "dd MMMM yyyy",
    locale: "en",
    transactionAmount: 0,
    transactionDate: formatDateForFineractUndo(params.transactionDate),
  };

  const url = `${baseUrl}/fineract-provider/api/v1/loans/${params.loanId}/transactions/${params.fineractTransactionId}?command=undo`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${serviceToken}`,
      "Fineract-Platform-TenantId": params.tenantSlug,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload: FineractErrorPayload = {};
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as FineractErrorPayload;
    } catch {
      payload = {};
    }
  }

  if (!response.ok) {
    const message =
      payload?.errors?.[0]?.defaultUserMessage ||
      payload?.defaultUserMessage ||
      `HTTP ${response.status}: ${response.statusText}`;

    const error = new Error(message) as FineractApiError;
    error.status = response.status;
    error.errorData = {
      ...payload,
      defaultUserMessage: message,
    };
    throw error;
  }

  return payload;
}
