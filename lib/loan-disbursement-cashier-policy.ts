type LoanDisbursementCashierPolicyInput = {
  payoutMethod?: "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER";
  transactionType?: string;
};

// Temporary production bypass while historical duplicate payout rows have spoiled cashier balances.
const TEMPORARILY_BYPASS_CASHIER_RESTRICTIONS_FOR_LOAN_DISBURSEMENT = true;

export function shouldSkipManualFineractCashierSettleForLoanDisbursement(
  input: LoanDisbursementCashierPolicyInput
): boolean {
  return (
    input.transactionType === "DISBURSEMENT" ||
    input.payoutMethod === "CASH"
  );
}

export function shouldBypassCashierRestrictionsForLoanDisbursement(
  input: LoanDisbursementCashierPolicyInput
): boolean {
  return (
    TEMPORARILY_BYPASS_CASHIER_RESTRICTIONS_FOR_LOAN_DISBURSEMENT &&
    (input.transactionType === "DISBURSEMENT" ||
      input.payoutMethod === "CASH")
  );
}
