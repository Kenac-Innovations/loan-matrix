export type TransactionTypeLike = {
  value?: string;
  repaymentAtDisbursement?: boolean;
  disbursement?: boolean;
  repayment?: boolean;
  accrual?: boolean;
  code?: string;
} | undefined;

export type ChargeLike = {
  chargeName?: string;
  name?: string;
  loanChargeName?: string;
  charge?: {
    name?: string;
  };
};

export type TransactionLike = {
  id?: number;
  date?: string | number[];
  amount?: number;
  outstandingLoanBalance?: number;
  type?: TransactionTypeLike;
  loanChargePaidByList?: ChargeLike[];
};

export function formatTransactionChargeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Get the display label for a loan transaction type.
 * "Repayment (at time of disbursement)" is shown as "Admin Fee" in the UI.
 */
export function getTransactionTypeDisplayLabel(type: TransactionTypeLike): string {
  if (!type) return "";
  if (type.repaymentAtDisbursement) return "Admin Fee";
  return type.value || "";
}

/**
 * Match the loan transactions table display:
 * when a single charge is attached, prefer its charge name over the generic type.
 */
export function getDisplayedTransactionType(
  transaction: TransactionLike | undefined
): string {
  if (!transaction) return "";

  const paidCharges = transaction.loanChargePaidByList;
  if (Array.isArray(paidCharges) && paidCharges.length === 1) {
    const charge = paidCharges[0];
    const chargeName =
      charge?.chargeName ||
      charge?.name ||
      charge?.loanChargeName ||
      charge?.charge?.name;

    if (typeof chargeName === "string" && chargeName.trim()) {
      return formatTransactionChargeName(chargeName);
    }
  }

  return getTransactionTypeDisplayLabel(transaction.type);
}
