import { fetchFineractAPI } from "@/lib/api";

/** Fineract loan transaction undo expects "dd MMMM yyyy" (matches client loan transaction UI). */
export function formatDateForFineractUndo(d: Date): string {
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "long" });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
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
}): Promise<unknown> {
  const body = {
    dateFormat: "dd MMMM yyyy",
    locale: "en",
    transactionAmount: 0,
    transactionDate: formatDateForFineractUndo(params.transactionDate),
  };
  return fetchFineractAPI(
    `/loans/${params.loanId}/transactions/${params.fineractTransactionId}?command=undo`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );
}
