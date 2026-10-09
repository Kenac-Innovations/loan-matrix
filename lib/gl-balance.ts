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

type JournalEntryLike = {
  amount?: number | null;
  entryType?: { value?: string | null } | null;
  currency?: { code?: string | null } | null;
};

/**
 * Net a page of journal entries as an ASSET account: DEBIT increases the
 * balance, CREDIT decreases it.
 */
export function sumJournalEntries(entries: JournalEntryLike[]): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.entryType?.value === "DEBIT") {
      total += entry.amount || 0;
    } else if (entry.entryType?.value === "CREDIT") {
      total -= entry.amount || 0;
    }
  }
  return total;
}

const GL_PAGE_SIZE = 500;
// Safety stop so a misbehaving API cannot loop forever (500 x 200 = 100k entries).
const GL_MAX_PAGES = 200;

/**
 * Compute the current balance for a Fineract GL account by summing journal entries.
 *
 * Treats the account as an ASSET (DEBIT increases, CREDIT decreases). This matches
 * how cash/till GL accounts (e.g. branch cash, bank vault) behave in Fineract.
 *
 * Pages through every entry for the account — summing only the most recent page
 * gives a wrong balance once an account has more history than one page.
 */
export async function getGlAccountBalance(
  glAccountId: number,
  options: { pageSize?: number } = {}
): Promise<GlBalanceResult> {
  const pageSize = options.pageSize ?? GL_PAGE_SIZE;

  try {
    let balance = 0;
    let entryCount = 0;
    let currency: string | null = null;

    for (let page = 0; page < GL_MAX_PAGES; page++) {
      const journalData = await fetchFineractAPI(
        `/journalentries?glAccountId=${glAccountId}&offset=${page * pageSize}&limit=${pageSize}&orderBy=id&sortOrder=DESC`
      );
      const items: JournalEntryLike[] = journalData?.pageItems ?? [];

      if (page === 0) currency = items[0]?.currency?.code ?? null;
      balance += sumJournalEntries(items);
      entryCount += items.length;

      const total =
        typeof journalData?.totalFilteredRecords === "number"
          ? journalData.totalFilteredRecords
          : null;
      if (items.length < pageSize || (total !== null && entryCount >= total)) {
        break;
      }
    }

    if (entryCount === 0) {
      return { balance: 0, currency: null, source: "fineract_empty", entryCount: 0 };
    }

    return { balance, currency, source: "fineract_calculated", entryCount };
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
