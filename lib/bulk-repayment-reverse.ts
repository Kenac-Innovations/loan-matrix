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

export type FineractLoanTransaction = {
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

export type RepaymentUndoResolution =
  | {
      status: "UNDOABLE";
      transactionId: string;
    }
  | {
      status: "ALREADY_REVERSED";
      transactionId: string;
    };

export type RepaymentUndoResult =
  | {
      status: "UNDONE";
      transactionId: string;
      response: unknown;
    }
  | {
      status: "ALREADY_REVERSED";
      transactionId: string;
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
  if (typeof value !== "string") return null;
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

function isRepaymentTransaction(tx: FineractLoanTransaction): boolean {
  return Boolean(tx.type?.repayment || tx.type?.recoveryRepayment);
}

function sortNewestFirst(
  transactions: FineractLoanTransaction[]
): FineractLoanTransaction[] {
  return [...transactions].sort((a, b) => {
    const aDate = normalizeTxnDate(a.date) ?? "";
    const bDate = normalizeTxnDate(b.date) ?? "";
    if (aDate !== bDate) return bDate.localeCompare(aDate);
    return Number(b.id ?? 0) - Number(a.id ?? 0);
  });
}

function toUndoResolution(tx: FineractLoanTransaction): RepaymentUndoResolution {
  if (tx.id === undefined) {
    throw new Error("Matched Fineract transaction is missing an id");
  }

  return {
    status: tx.manuallyReversed ? "ALREADY_REVERSED" : "UNDOABLE",
    transactionId: String(tx.id),
  };
}

function matchesReplayRelation(
  tx: FineractLoanTransaction,
  storedTransactionId: string
): boolean {
  return Boolean(
    tx.transactionRelations?.some(
      (relation) =>
        relation.relationType === "REPLAYED" &&
        normalizeTxnId(relation.toLoanTransaction) === storedTransactionId
    )
  );
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

export function resolveRepaymentTransactionForUndoFromTransactions(params: {
  transactions: FineractLoanTransaction[];
  storedTransactionId: string;
  transactionDate?: Date;
  amount?: number;
}): RepaymentUndoResolution {
  const targetDate = params.transactionDate?.toISOString().slice(0, 10) ?? null;
  const targetAmount =
    typeof params.amount === "number" && Number.isFinite(params.amount)
      ? Number(params.amount.toFixed(2))
      : null;

  const repayments = sortNewestFirst(
    params.transactions.filter(isRepaymentTransaction)
  );
  const activeRepayments = repayments.filter((tx) => !tx.manuallyReversed);

  const exactId = repayments.find(
    (tx) => normalizeTxnId(tx.id) === params.storedTransactionId
  );
  if (exactId?.id !== undefined) {
    return toUndoResolution(exactId);
  }

  const activeReplayReplacement = activeRepayments.find((tx) =>
    matchesReplayRelation(tx, params.storedTransactionId)
  );
  if (activeReplayReplacement?.id !== undefined) {
    return toUndoResolution(activeReplayReplacement);
  }

  const reversedReplayReplacement = repayments.find(
    (tx) =>
      tx.manuallyReversed &&
      matchesReplayRelation(tx, params.storedTransactionId)
  );
  if (reversedReplayReplacement?.id !== undefined) {
    return toUndoResolution(reversedReplayReplacement);
  }

  const amountAndDateMatch = activeRepayments.find((tx) => {
    const sameDate = !targetDate || normalizeTxnDate(tx.date) === targetDate;
    const sameAmount =
      targetAmount === null ||
      (typeof tx.amount === "number" && Number(tx.amount.toFixed(2)) === targetAmount);
    return sameDate && sameAmount;
  });
  if (amountAndDateMatch?.id !== undefined) {
    return toUndoResolution(amountAndDateMatch);
  }

  if (targetDate && targetAmount !== null) {
    const reversedAmountAndDateMatches = repayments.filter((tx) => {
      const sameDate = normalizeTxnDate(tx.date) === targetDate;
      const sameAmount =
        typeof tx.amount === "number" &&
        Number(tx.amount.toFixed(2)) === targetAmount;
      return tx.manuallyReversed && sameDate && sameAmount;
    });

    if (reversedAmountAndDateMatches.length === 1) {
      return toUndoResolution(reversedAmountAndDateMatches[0]);
    }
  }

  throw new Error(
    `Could not find an active or already-reversed repayment transaction for stored transaction ${params.storedTransactionId}`
  );
}

export async function resolveRepaymentTransactionForUndo(params: {
  tenantSlug?: string;
  loanId: number;
  fineractTransactionId: string;
  transactionDate?: Date;
  amount?: number;
}): Promise<RepaymentUndoResolution> {
  const storedTransactionId = normalizeTxnId(params.fineractTransactionId);
  if (!storedTransactionId) {
    throw new Error("Missing Fineract transaction id");
  }

  const transactions = await getLoanTransactionsForUndo(
    params.loanId,
    params.tenantSlug
  );
  return resolveRepaymentTransactionForUndoFromTransactions({
    transactions,
    storedTransactionId,
    transactionDate: params.transactionDate,
    amount: params.amount,
  });
}

export async function resolveUndoableRepaymentTransactionId(params: {
  tenantSlug?: string;
  loanId: number;
  fineractTransactionId: string;
  transactionDate?: Date;
  amount?: number;
}): Promise<string> {
  const resolution = await resolveRepaymentTransactionForUndo(params);
  if (resolution.status === "ALREADY_REVERSED") {
    throw new Error(
      `Stored transaction ${resolution.transactionId} is already reversed in Fineract`
    );
  }
  return resolution.transactionId;
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
}): Promise<RepaymentUndoResult> {
  const resolution = await resolveRepaymentTransactionForUndo({
    tenantSlug: params.tenantSlug,
    loanId: params.loanId,
    fineractTransactionId: params.fineractTransactionId,
    transactionDate: params.transactionDate,
    amount: params.amount,
  });

  if (resolution.status === "ALREADY_REVERSED") {
    return resolution;
  }

  const body = {
    dateFormat: "dd MMMM yyyy",
    locale: "en",
    transactionAmount: 0,
    transactionDate: formatDateForFineractUndo(params.transactionDate),
  };
  const response = await fetchFineractAPIForTenant(
    `/loans/${params.loanId}/transactions/${resolution.transactionId}?command=undo`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
    params.tenantSlug
  );
  return {
    status: "UNDONE",
    transactionId: resolution.transactionId,
    response,
  };
}
import https from "https";
