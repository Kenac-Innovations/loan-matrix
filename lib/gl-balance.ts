import { fetchFineractAPI } from "@/lib/api";

export type GlBalanceSource =
  | "fineract_calculated"
  | "fineract_empty"
  | "local_fallback"
  | "local";

export interface GlBalanceResult {
  balance: number;
  currency: string | null;
  source: GlBalanceSource;
  entryCount?: number;
  error?: string;
}

/**
 * Compute the current balance for a Fineract GL account by summing journal entries.
 *
 * Treats the account as an ASSET (DEBIT increases, CREDIT decreases). This matches
 * how cash/till GL accounts (e.g. branch cash, bank vault) behave in Fineract and
 * is what we use everywhere else in the codebase (see `app/api/banks/[id]/route.ts`).
 *
 * Pages through at most `limit` most-recent entries; default 500 is large enough
 * for any reasonable single-account ledger and matches the existing bank logic.
 */
export async function getGlAccountBalance(
  glAccountId: number,
  options: { limit?: number } = {}
): Promise<GlBalanceResult> {
  const limit = options.limit ?? 500;

  try {
    const journalData = await fetchFineractAPI(
      `/journalentries?glAccountId=${glAccountId}&limit=${limit}&orderBy=id&sortOrder=DESC`
    );

    if (journalData?.pageItems && journalData.pageItems.length > 0) {
      let calculated = 0;
      for (const entry of journalData.pageItems) {
        if (entry.entryType?.value === "DEBIT") {
          calculated += entry.amount || 0;
        } else if (entry.entryType?.value === "CREDIT") {
          calculated -= entry.amount || 0;
        }
      }

      const latestEntry = journalData.pageItems[0];
      return {
        balance: calculated,
        currency: latestEntry.currency?.code ?? null,
        source: "fineract_calculated",
        entryCount: journalData.pageItems.length,
      };
    }

    return {
      balance: 0,
      currency: null,
      source: "fineract_empty",
      entryCount: 0,
    };
  } catch (error) {
    return {
      balance: 0,
      currency: null,
      source: "local_fallback",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * The displayed vault balance for a teller is sourced *only* from Fineract.
 * No local-ledger fallback, no subtraction of local allocations — when the GL
 * value is unavailable, the consumer renders NaN ("—").
 */
export type TellerVaultDisplaySource = "fineract_gl" | "unavailable";

export interface TellerVaultDisplay {
  vaultBalance: number | null;
  availableBalance: number | null;
  vaultBalanceSource: TellerVaultDisplaySource;
  currency: string | null;
  glAccountId: number | null;
  glAccountCode: string | null;
  glAccountName: string | null;
  glUnavailableReason?: "not_configured" | "fineract_unreachable";
  glError?: string;
}

/**
 * Resolve the teller vault balance for display purposes from the Fineract GL
 * account *only*. Available = vault (no subtraction of cashier allocations).
 * Returns `null` for both values when no GL is configured or Fineract is
 * unreachable, so the caller can render NaN / "—".
 */
export async function getTellerVaultDisplay(teller: {
  glAccountId: number | null;
  glAccountCode: string | null;
  glAccountName: string | null;
}): Promise<TellerVaultDisplay> {
  const baseGl = {
    glAccountId: teller.glAccountId,
    glAccountCode: teller.glAccountCode,
    glAccountName: teller.glAccountName,
  };

  if (!teller.glAccountId) {
    return {
      vaultBalance: null,
      availableBalance: null,
      vaultBalanceSource: "unavailable",
      currency: null,
      glUnavailableReason: "not_configured",
      ...baseGl,
    };
  }

  const r = await getGlAccountBalance(teller.glAccountId);
  if (r.source === "fineract_calculated" || r.source === "fineract_empty") {
    return {
      vaultBalance: r.balance,
      availableBalance: r.balance,
      vaultBalanceSource: "fineract_gl",
      currency: r.currency,
      ...baseGl,
    };
  }

  return {
    vaultBalance: null,
    availableBalance: null,
    vaultBalanceSource: "unavailable",
    currency: null,
    glUnavailableReason: "fineract_unreachable",
    glError: r.error,
    ...baseGl,
  };
}
