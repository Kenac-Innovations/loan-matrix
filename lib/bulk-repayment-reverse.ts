import { fetchFineractAPI } from "@/lib/api";

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

async function getLoanTransactionsForUndo(loanId: number): Promise<FineractLoanTransaction[]> {
  const loan = (await fetchFineractAPI(
    `/loans/${loanId}?associations=transactions`
  )) as LoanWithTransactionsResponse;
  return Array.isArray(loan.transactions) ? loan.transactions : [];
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
  loanId: number;
  fineractTransactionId: string;
  transactionDate?: Date;
  amount?: number;
}): Promise<string> {
  const storedTransactionId = normalizeTxnId(params.fineractTransactionId);
  if (!storedTransactionId) {
    throw new Error("Missing Fineract transaction id");
  }

  const transactions = await getLoanTransactionsForUndo(params.loanId);
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
  loanId: number;
  fineractTransactionId: string;
  /** Date Fineract associates with the undo (use original repayment business date when possible). */
  transactionDate: Date;
  /** Original repayment amount, used to locate the active replayed transaction when ids have drifted. */
  amount?: number;
}): Promise<unknown> {
  const undoTransactionId = await resolveUndoableRepaymentTransactionId({
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
  return fetchFineractAPI(
    `/loans/${params.loanId}/transactions/${undoTransactionId}?command=undo`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}
