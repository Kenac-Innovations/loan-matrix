/**
 * Cashier expense GL posting utilities.
 * Handles transaction type resolution, GL account validation, and main vault GL identification.
 */

import { fetchFineractAPI } from "@/lib/api";
import {
  createFineractJournalEntry,
  reverseFineractJournalEntry,
} from "@/lib/mobile-money-transactions";

// Re-export pure functions from the pure module
export {
  resolveSettleTransactionType,
  validateExpenseGlAccount,
  pickMainVaultGlAccountId,
  type SettleTransactionType,
} from "@/lib/cashier-expense-gl.pure";

/**
 * Fetch the main vault GL account ID from Fineract financial activity accounts.
 * Returns null when CASH_AT_MAINVAULT is not mapped; throws when Fineract cannot be reached.
 */
export async function getMainVaultGlAccountId(): Promise<number | null> {
  const { pickMainVaultGlAccountId } = await import("@/lib/cashier-expense-gl.pure");

  // Errors propagate so callers can tell a Fineract outage from a missing mapping.
  const response = await fetchFineractAPI("/financialactivityaccounts");
  return Array.isArray(response) ? pickMainVaultGlAccountId(response) : null;
}

/**
 * Re-export journal entry functions for convenience.
 */
export { createFineractJournalEntry, reverseFineractJournalEntry };
