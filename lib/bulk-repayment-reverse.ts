type FineractApiError = {
  errors?: Array<{ defaultUserMessage?: string; developerMessage?: string }>;
  defaultUserMessage?: string;
  developerMessage?: string;
};

/** Fineract loan transaction undo expects "dd MMMM yyyy" (matches client loan transaction UI). */
export function formatDateForFineractUndo(d: Date): string {
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "long" });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

type FineractLoanTransaction = {
  id?: number | string;
  amount?: number;
  manuallyReversed?: boolean;
  date?: string | [number, number, number];
  type?: {
    repayment?: boolean;
    recoveryRepayment?: boolean;
  };
  transactionRelations?: Array<{
    fromLoanTransaction?: number | string;
    toLoanTransaction?: number | string;
    relationType?: string;
    amount?: number;
  }>;
};

type LoanWithTransactionsResponse = {
  transactions?: FineractLoanTransaction[];
};

function normalizeTxnId(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeTxnDate(value: string | [number, number, number] | null | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

async function getLoanTransactionsForUndo(
  loanId: number,
  tenantSlug?: string
): Promise<FineractLoanTransaction[]> {
  const loan = (await fetchFineractAPIForTenant(
    `/loans/${loanId}?associations=transactions`,
    { method: "GET" },
    tenantSlug
  )) as LoanWithTransactionsResponse;
  return Array.isArray(loan.transactions) ? loan.transactions : [];
}

async function fetchFineractAPIForTenant(
  endpoint: string,
  options: RequestInit,
  tenantSlug?: string
): Promise<unknown> {
  const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";
  const serviceToken = process.env.FINERACT_SERVICE_TOKEN || "bWlmb3M6cGFzc3dvcmQ=";
  const fineractTenantId = tenantSlug || process.env.FINERACT_TENANT_ID || "goodfellow";
  const url = `${baseUrl}/fineract-provider/api/v1${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    Authorization: `Basic ${serviceToken}`,
    "Fineract-Platform-TenantId": fineractTenantId,
    Accept: "application/json",
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  if (url.startsWith("http://")) {
    response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string> | undefined),
      },
    });
  } else {
    const agent = new https.Agent({ rejectUnauthorized: false });
    response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers as Record<string, string> | undefined),
      },
      ...({ agent } as { agent: unknown }),
    });
  }

  if (!response.ok) {
    let errorData: FineractApiError = {};
    try {
      errorData = (await response.json()) as FineractApiError;
    } catch {
      errorData = {};
    }

    const specificErrorMessage =
      errorData.errors?.[0]?.defaultUserMessage ||
      errorData.errors?.[0]?.developerMessage ||
      errorData.defaultUserMessage ||
      errorData.developerMessage ||
      `HTTP ${response.status}: ${response.statusText}`;

    const error = new Error(`API error: ${response.status} ${response.statusText}`);
    (
      error as Error & {
        status: number;
        errorData: FineractApiError;
      }
    ).status = response.status;
    (
      error as Error & {
        status: number;
        errorData: FineractApiError;
      }
    ).errorData = {
      ...errorData,
      defaultUserMessage: specificErrorMessage,
      developerMessage: specificErrorMessage,
    };
    throw error;
  }

  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text) as unknown;
}

function pickUndoableRepaymentTransaction(params: {
  transactions: FineractLoanTransaction[];
  storedTransactionId: string;
  transactionDate?: Date;
  amount?: number;
}): string {
  const targetDate = params.transactionDate?.toISOString().slice(0, 10) ?? null;
  const targetAmount =
    typeof params.amount === "number" && Number.isFinite(params.amount)
      ? Number(params.amount.toFixed(2))
      : null;

  const candidates = params.transactions
    .filter((tx) => (tx.type?.repayment || tx.type?.recoveryRepayment) && !tx.manuallyReversed)
    .sort((a, b) => {
      const aDate = normalizeTxnDate(a.date) ?? "";
      const bDate = normalizeTxnDate(b.date) ?? "";
      if (aDate !== bDate) return bDate.localeCompare(aDate);
      return Number(b.id ?? 0) - Number(a.id ?? 0);
    });

  const exactId = candidates.find(
    (tx) => normalizeTxnId(tx.id) === params.storedTransactionId
  );
  if (exactId?.id !== undefined) {
    return String(exactId.id);
  }

  const replayReplacement = candidates.find((tx) =>
    tx.transactionRelations?.some(
      (relation) =>
        relation.relationType === "REPLAYED" &&
        normalizeTxnId(relation.toLoanTransaction) === params.storedTransactionId
    )
  );
  if (replayReplacement?.id !== undefined) {
    return String(replayReplacement.id);
  }

  const amountAndDateMatch = candidates.find((tx) => {
    const sameDate = !targetDate || normalizeTxnDate(tx.date) === targetDate;
    const sameAmount =
      targetAmount === null ||
      (typeof tx.amount === "number" && Number(tx.amount.toFixed(2)) === targetAmount);
    return sameDate && sameAmount;
  });
  if (amountAndDateMatch?.id !== undefined) {
    return String(amountAndDateMatch.id);
  }

  throw new Error(
    `Could not find an active repayment transaction to undo for stored transaction ${params.storedTransactionId}`
  );
}

export async function resolveUndoableRepaymentTransactionId(params: {
  tenantSlug?: string;
  loanId: number;
  fineractTransactionId: string;
  transactionDate?: Date;
  amount?: number;
}): Promise<string> {
  const storedTransactionId = normalizeTxnId(params.fineractTransactionId);
  if (!storedTransactionId) {
    throw new Error("Missing Fineract transaction id");
  }

  const transactions = await getLoanTransactionsForUndo(
    params.loanId,
    params.tenantSlug
  );
  return pickUndoableRepaymentTransaction({
    transactions,
    storedTransactionId,
    transactionDate: params.transactionDate,
    amount: params.amount,
  });
}

/**
 * POST .../loans/{loanId}/transactions/{transactionId}?command=undo
 * Fineract may reject if the txn is not the latest on the loan or business rules block undo.
 */
export async function undoLoanRepaymentTransaction(params: {
  tenantSlug?: string;
  loanId: number;
  fineractTransactionId: string;
  /** Date Fineract associates with the undo (use original repayment business date when possible). */
  transactionDate: Date;
  /** Original repayment amount, used to locate the active replayed transaction when ids have drifted. */
  amount?: number;
}): Promise<unknown> {
  const undoTransactionId = await resolveUndoableRepaymentTransactionId({
    tenantSlug: params.tenantSlug,
    loanId: params.loanId,
    fineractTransactionId: params.fineractTransactionId,
    transactionDate: params.transactionDate,
    amount: params.amount,
  });

  const body = {
    dateFormat: "dd MMMM yyyy",
    locale: "en",
    transactionAmount: 0,
    transactionDate: formatDateForFineractUndo(params.transactionDate),
  };
  return fetchFineractAPIForTenant(
    `/loans/${params.loanId}/transactions/${undoTransactionId}?command=undo`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    params.tenantSlug
  );
}
import https from "https";
