/**
 * Pure utility functions for cashier expense GL posting.
 * No server-side dependencies; safe for testing and client-side use.
 */

export type SettleTransactionType =
  | "EXPENSE"
  | "RETURN_TO_VAULT"
  | "DISBURSEMENT"
  | "CREDIT_BALANCE_REFUND";

/**
 * Resolve and validate the settlement transaction type.
 * If input is omitted/empty, defaults to "RETURN_TO_VAULT".
 * Returns null if the type is invalid.
 */
export function resolveSettleTransactionType(
  input?: string | null
): SettleTransactionType | null {
  if (!input || typeof input !== "string") {
    return "RETURN_TO_VAULT";
  }

  const trimmed = input.trim().toUpperCase();
  if (!trimmed) {
    return "RETURN_TO_VAULT";
  }

  const validTypes: SettleTransactionType[] = [
    "EXPENSE",
    "RETURN_TO_VAULT",
    "DISBURSEMENT",
    "CREDIT_BALANCE_REFUND",
  ];

  if (validTypes.includes(trimmed as SettleTransactionType)) {
    return trimmed as SettleTransactionType;
  }

  return null;
}

/**
 * Validate an expense GL account.
 * Returns an error string if validation fails, null if valid.
 */
export function validateExpenseGlAccount(account: any): string | null {
  if (!account) {
    return "GL account not found";
  }

  // Check if account is disabled
  if (account.disabled === true) {
    return "GL account is disabled";
  }

  // Check account type is EXPENSE (type.id === 5 or type.value/code === "EXPENSE")
  const accountType = account.type;
  if (accountType) {
    const isExpenseType =
      accountType.id === 5 || accountType.value === "EXPENSE" || accountType.code === "EXPENSE";
    if (!isExpenseType) {
      return `GL account type must be EXPENSE, got ${accountType.value || accountType.code || accountType.id}`;
    }
  } else {
    return "GL account type not available";
  }

  // Check usage detail is set (usage.id === 1 for detail accounts)
  const usage = account.usage;
  if (!usage || usage.id !== 1) {
    return "GL account must be a detail account (usage = 1), not a header";
  }

  // Check manual entries are allowed
  if (account.manualEntriesAllowed !== true) {
    return "GL account does not allow manual entries";
  }

  return null;
}

/**
 * Pick the main vault GL account ID from financial activity accounts.
 * Returns the GL account ID for the entry where financialActivityData.id === 101 (CASH_AT_MAINVAULT).
 */
export function pickMainVaultGlAccountId(
  financialActivityAccounts: any
): number | null {
  if (!Array.isArray(financialActivityAccounts)) {
    return null;
  }

  for (const entry of financialActivityAccounts) {
    const fad = entry.financialActivityData;
    if (fad && fad.id === 101) {
      // CASH_AT_MAINVAULT
      const glId = entry.glAccountData?.id;
      if (typeof glId === "number") {
        return glId;
      }
    }
  }

  return null;
}
