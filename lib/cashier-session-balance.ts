/**
 * Cashier session balance computation from Fineract snapshots.
 *
 * Pure functions (no Prisma) deriving session balance state from Fineract's running
 * cashier summary, which includes cash loan/savings transactions posted by the
 * cashier's own Fineract user. Expected balance = Fineract netCash (the source of truth).
 */

import { toBusinessDateString } from "./cashier-session-enforcement-policy";

/**
 * Snapshot of Fineract cashier summary at a point in time.
 * All numeric fields may arrive as strings/null from Fineract; must be coerced.
 */
export type FineractCashierSummarySnapshot = {
  sumCashAllocation: number;
  sumInwardCash: number;
  sumOutwardCash: number;
  sumCashSettlement: number;
  netCash: number;
  currency: string;
  capturedAt: string; // ISO string
};

/**
 * Convert raw Fineract cashier summary response to a typed snapshot.
 * Coerces numeric fields (Fineract may send strings); returns null when netCash is absent.
 */
export function toCashierSummarySnapshot(
  raw: Record<string, unknown> | null | undefined,
  currency: string,
  capturedAt: Date
): FineractCashierSummarySnapshot | null {
  // Without netCash the response is not a usable summary (e.g. wrong currency code).
  if (!raw || raw.netCash === undefined || raw.netCash === null) return null;
  return {
    sumCashAllocation: Number(raw.sumCashAllocation) || 0,
    sumInwardCash: Number(raw.sumInwardCash) || 0,
    sumOutwardCash: Number(raw.sumOutwardCash) || 0,
    sumCashSettlement: Number(raw.sumCashSettlement) || 0,
    netCash: Number(raw.netCash) || 0,
    currency,
    capturedAt: capturedAt.toISOString(),
  };
}

/**
 * Session balance derived from Fineract, rounded to 2 dp.
 *
 * Fineract netCash is cumulative over the cashier's assignment and the session
 * close does not (yet) post the return-to-vault to Fineract, so absolute netCash
 * carries cash from earlier sessions and historical data issues. Expected cash is
 * therefore measured from a baseline: the Fineract netCash that represented an
 * empty drawer right after this cashier's previous close.
 */
export type SessionBalance = {
  /** Cash in the drawer at session start (opening netCash − baseline), or the local float. */
  openingFloat: number;
  /** Movements since the opening snapshot (0 when no opening snapshot). */
  allocations: number;
  cashIn: number;
  cashOut: number;
  settlements: number;
  /** cashIn − cashOut */
  netCash: number;
  /** Cash the drawer should hold now. */
  expectedBalance: number;
  /**
   * - FINERACT_BASELINE: current netCash − previous-close baseline (reliable)
   * - NO_BASELINE: no earlier close baseline; absolute netCash, not reliable for variances
   * - UNAVAILABLE: Fineract summary unavailable; local opening float only
   */
  source: "FINERACT_BASELINE" | "NO_BASELINE" | "UNAVAILABLE";
};

const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Whether a balance is trustworthy enough to record a short/over against. */
export function isBalanceReliableForVariance(balance: SessionBalance): boolean {
  return balance.source === "FINERACT_BASELINE";
}

/**
 * Compute a session's balance from Fineract cashier summary snapshots.
 * Snapshots and baseline must be in the same (raw Fineract) currency; an
 * opening snapshot in another currency is ignored for the movement breakdown.
 */
export function computeSessionBalance(input: {
  baselineNetCash: number | null;
  opening: FineractCashierSummarySnapshot | null;
  current: FineractCashierSummarySnapshot | null;
  fallbackOpeningFloat: number;
}): SessionBalance {
  const { baselineNetCash, opening, current, fallbackOpeningFloat } = input;

  if (!current) {
    return {
      openingFloat: round2(fallbackOpeningFloat),
      allocations: 0,
      cashIn: 0,
      cashOut: 0,
      settlements: 0,
      netCash: 0,
      expectedBalance: round2(fallbackOpeningFloat),
      source: "UNAVAILABLE",
    };
  }

  const usableOpening = opening && opening.currency === current.currency ? opening : null;
  const movements = usableOpening
    ? {
        allocations: round2(current.sumCashAllocation - usableOpening.sumCashAllocation),
        cashIn: round2(current.sumInwardCash - usableOpening.sumInwardCash),
        cashOut: round2(current.sumOutwardCash - usableOpening.sumOutwardCash),
        settlements: round2(current.sumCashSettlement - usableOpening.sumCashSettlement),
      }
    : { allocations: 0, cashIn: 0, cashOut: 0, settlements: 0 };
  const netCash = round2(movements.cashIn - movements.cashOut);

  if (baselineNetCash === null) {
    return {
      openingFloat: usableOpening ? round2(usableOpening.netCash) : round2(fallbackOpeningFloat),
      ...movements,
      netCash,
      expectedBalance: round2(current.netCash),
      source: "NO_BASELINE",
    };
  }

  return {
    openingFloat: usableOpening
      ? round2(usableOpening.netCash - baselineNetCash)
      : round2(fallbackOpeningFloat),
    ...movements,
    netCash,
    expectedBalance: round2(current.netCash - baselineNetCash),
    source: "FINERACT_BASELINE",
  };
}

/**
 * Fineract netCash that represents an empty drawer after a close. The close
 * currently posts nothing to Fineract, so it is the closing netCash; once the
 * return-to-vault is settled in Fineract, pass that amount as settledToFineract.
 */
export function baselineAfterClose(
  closing: FineractCashierSummarySnapshot,
  settledToFineract = 0
): number {
  return round2(closing.netCash - settledToFineract);
}

/**
 * Build context fields (businessDate, officeId, currency) for a new session.
 */
export function buildSessionContextFields(input: {
  teller: { officeId: number };
  now: Date;
  currency: string;
}): {
  businessDate: Date;
  officeId: number;
  currency: string;
} {
  const { teller, now, currency } = input;
  const businessDateStr = toBusinessDateString(now);
  return {
    businessDate: new Date(`${businessDateStr}T00:00:00.000Z`),
    officeId: teller.officeId,
    currency,
  };
}
