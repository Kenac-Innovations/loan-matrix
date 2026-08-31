export type ClientLoanAvailability = "has-loans" | "no-loans" | "unknown";

type ClientAccountsPayload = {
  loanAccounts?: unknown;
};

/**
 * Only a valid, empty account response proves that a client has no loans.
 * Failures must stay distinguishable from that business state.
 */
export function deriveClientLoanAvailability(
  payload: unknown
): ClientLoanAvailability {
  if (!payload || typeof payload !== "object") {
    return "unknown";
  }

  const { loanAccounts } = payload as ClientAccountsPayload;
  if (!Array.isArray(loanAccounts)) {
    return "unknown";
  }

  return loanAccounts.length > 0 ? "has-loans" : "no-loans";
}
