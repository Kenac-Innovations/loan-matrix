import { Transaction } from "@/shared/types/transaction";

/**
 * Get the display label for a loan transaction type.
 * "Repayment (at time of disbursement)" is shown as "Admin Fee" in the UI.
 */
export function getTransactionTypeDisplayLabel(
  type: { value?: string; repaymentAtDisbursement?: boolean } | undefined
): string {
  if (!type) return "";
  if (type.repaymentAtDisbursement) return "Admin Fee";
  return type.value || "";
}

/**
 * Prefer the single paid charge name when Fineract includes it on the transaction.
 * Otherwise fall back to the current transaction type display label.
 */
export function getLoanTransactionDisplayLabel(
  transaction: Pick<Transaction, "type" | "loanChargePaidByList">
): string {
  const loanChargePaidByList = Array.isArray(transaction.loanChargePaidByList)
    ? transaction.loanChargePaidByList
    : [];

  if (loanChargePaidByList.length === 1) {
    const singleChargeName = loanChargePaidByList[0]?.name?.trim();
    if (singleChargeName) {
      return singleChargeName;
    }
  }

  return getTransactionTypeDisplayLabel(transaction.type);
}
