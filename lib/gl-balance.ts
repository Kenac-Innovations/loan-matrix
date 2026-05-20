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
