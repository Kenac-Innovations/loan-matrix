import { getGlAccountBalance, getTellerVaultDisplay } from "@/lib/gl-balance";

/**
 * Bank balance figures shown on the bank screens and enforced when a bank
 * funds a teller vault.
 *
 * When the bank has a Fineract GL account, Fineract is the only source:
 * a bank → teller allocation posts DR teller GL / CR bank GL, so the bank GL
 * balance is *already* net of everything shipped to tellers. Subtracting the
 * local CashAllocation ledger on top of that counted every allocation twice and
 * drove the available balance negative.
 *
 * The local ledger is only used when no GL is configured or Fineract cannot be
 * reached.
 */
export type BankBalanceSource =
  | "fineract_calculated"
  | "fineract_empty"
  | "local_fallback"
  | "local";

export interface BankBalances {
  /** Bank funds plus what currently sits in its tellers' vaults. */
  totalAllocated: number;
  /** What currently sits in the tellers' vaults. */
  allocatedToTellers: number;
  /** What the bank can still allocate to tellers. */
  availableBalance: number;
  currency: string | null;
  source: BankBalanceSource;
}

type LocalAllocation = {
  amount: number;
  notes?: string | null;
  allocatedBy?: string | null;
};

/**
 * Local-ledger rule for which teller-vault rows drew money from the bank
 * (opening balances, imports, reversals and returns did not).
 */
export function isAllocationFromBank(alloc: {
  notes?: string | null;
  allocatedBy?: string | null;
}): boolean {
  const n = (alloc.notes ?? "").toLowerCase();
  if (n.includes("opening balance") || alloc.allocatedBy === "SYSTEM-IMPORT") return false;
  if (alloc.allocatedBy === "SYSTEM-REVERSAL") return false;
  if (n.includes("return from") || n.includes("session close") || n.includes("returned to vault")) {
    return false;
  }
  return true;
}

export function computeBankBalances(input: {
  /** Bank GL balance from Fineract, or null when no GL / Fineract unreachable. */
  bankGl: { balance: number; currency: string | null; source: "fineract_calculated" | "fineract_empty" } | null;
  hasGlAccount: boolean;
  /** Current teller vault GL balances; null when a teller's GL is unavailable. */
  tellerVaultBalances: Array<number | null>;
  localBankAllocations: LocalAllocation[];
  localTellerAllocations: LocalAllocation[];
}): BankBalances {
  if (input.bankGl) {
    const availableBalance = input.bankGl.balance;
    const allocatedToTellers = input.tellerVaultBalances.reduce<number>(
      (sum, balance) => sum + (balance ?? 0),
      0
    );
    return {
      totalAllocated: availableBalance + allocatedToTellers,
      allocatedToTellers,
      availableBalance,
      currency: input.bankGl.currency,
      source: input.bankGl.source,
    };
  }

  const totalAllocated = input.localBankAllocations.reduce((sum, a) => sum + a.amount, 0);
  const allocatedToTellers = input.localTellerAllocations
    .filter(isAllocationFromBank)
    .reduce((sum, a) => sum + a.amount, 0);
  return {
    totalAllocated,
    allocatedToTellers,
    availableBalance: totalAllocated - allocatedToTellers,
    currency: null,
    source: input.hasGlAccount ? "local_fallback" : "local",
  };
}

type TellerForBalance = {
  glAccountId: number | null;
  glAccountCode: string | null;
  glAccountName: string | null;
  cashAllocations?: LocalAllocation[];
};

/**
 * Load and compute a bank's balances. Pass `includeTellerVaults: false` when
 * only the available balance is needed (it skips the per-teller GL lookups).
 */
export async function loadBankBalances(
  bank: {
    glAccountId: number | null;
    allocations: LocalAllocation[];
    tellers: TellerForBalance[];
  },
  options: { includeTellerVaults?: boolean } = {}
): Promise<BankBalances> {
  const includeTellerVaults = options.includeTellerVaults ?? true;

  let bankGl: Parameters<typeof computeBankBalances>[0]["bankGl"] = null;
  if (bank.glAccountId) {
    const r = await getGlAccountBalance(bank.glAccountId);
    if (r.source === "fineract_calculated" || r.source === "fineract_empty") {
      bankGl = { balance: r.balance, currency: r.currency, source: r.source };
    } else {
      console.error(
        `Failed to fetch GL balance for bank GL ${bank.glAccountId}, falling back to local ledger:`,
        r.error
      );
    }
  }

  const tellerVaultBalances =
    bankGl && includeTellerVaults
      ? await Promise.all(
          bank.tellers.map(async (t) => (await getTellerVaultDisplay(t)).vaultBalance)
        )
      : [];

  return computeBankBalances({
    bankGl,
    hasGlAccount: !!bank.glAccountId,
    tellerVaultBalances,
    localBankAllocations: bank.allocations,
    localTellerAllocations: bank.tellers.flatMap((t) => t.cashAllocations ?? []),
  });
}
