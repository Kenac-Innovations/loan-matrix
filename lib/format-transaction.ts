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
