/**
 * Top-up "take home" = new principal minus outstanding on the loan being closed
 * (net cash to the client). Disbursement % fees should apply to this base, not gross principal.
 */

type ChargeCalcTypeRef = { id?: number; code?: string; value?: string };
type ChargeTimeTypeRef = { id?: number; code?: string; value?: string };

export type ActiveLoanOption = { id: number; loanBalance: number };

export type EditableLoanChargeRow = {
  chargeId: number;
  name: string;
  amount: number;
  dueDate: Date | string;
  originalCharge?: {
    chargeTimeType?: ChargeTimeTypeRef;
    chargeCalculationType?: ChargeCalcTypeRef;
    percentage?: unknown;
    /** Original take-home rate set on first rebase; never overwritten on subsequent recalculations. */
    _takeHomePercentage?: unknown;
    amount?: unknown;
    penalty?: boolean;
  };
};

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof (value as { toString?: () => string })?.toString === "function") {
    const parsed = Number((value as { toString: () => string }).toString());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function roundMoney(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function isLoanDisbursementChargeTime(timeType?: ChargeTimeTypeRef): boolean {
  const code = (timeType?.code || "").toLowerCase();
  const value = (timeType?.value || "").trim();
  if (code.includes("tranche")) return false;
  return (
    timeType?.id === 1 ||
    code === "disbursement" ||
    code.endsWith(".disbursement") ||
    /\bdisbursement\b/i.test(value)
  );
}

export function isSimplePrincipalPercentCalculation(calc?: ChargeCalcTypeRef): boolean {
  const code = (calc?.code || "").toLowerCase();
  if (!code.includes("percent")) return false;
  if (code.includes("percent.of.amount.and.interest")) return false;
  if (code.includes("percent.of.interest")) return false;
  return true;
}

export function shouldRebaseTopupDisbursementCharge(
  originalCharge: EditableLoanChargeRow["originalCharge"]
): boolean {
  if (!originalCharge) return false;
  if (originalCharge.penalty) return false;
  if (!isLoanDisbursementChargeTime(originalCharge.chargeTimeType)) return false;
  return isSimplePrincipalPercentCalculation(originalCharge.chargeCalculationType);
}

/**
 * Fineract applies disbursement % on new principal `P`: fee = `P × p / 100`.
 * To match **`H × r / 100`** (rate `r` on take-home `H` only), set **`p = r × (H / P)`**
 * (if `H = P − B` then **`p = r × (1 − B/P)`**). When `H = P`, this returns `r`.
 */
export function equivalentPrincipalPercentForTakeHomeRate(params: {
  /** Intended percent on take-home only (e.g. 5 means 5%). */
  percentOnTakeHome: number;
  principal: number;
  takeHome: number;
}): number | null {
  const P = toNumber(params.principal);
  const H = toNumber(params.takeHome);
  const r = toNumber(params.percentOnTakeHome);
  if (P == null || P <= 0 || r == null || r <= 0 || H == null || H < 0) return null;
  if (H > P + 1e-6) return null;
  return roundMoney(r * (H / P), 10);
}

/** Take-home `H`: principal minus loan-to-close balance when top-up applies; otherwise full principal. */
export function computeTopupTakeHomeChargeBase(params: {
  principal: number;
  isTopup: boolean;
  loanIdToClose: string;
  activeLoanOptions: ActiveLoanOption[] | null | undefined;
}): number {
  const principal = toNumber(params.principal);
  if (principal == null || principal <= 0) return 0;
  if (!params.isTopup) return principal;
  const idStr = (params.loanIdToClose || "").trim();
  if (!idStr) return principal;
  const match = (params.activeLoanOptions || []).find(
    (o) => String(o.id) === idStr
  );
  const bal = toNumber(match?.loanBalance);
  if (bal == null || bal < 0) return principal;
  return Math.max(0, roundMoney(principal - bal, 6));
}

/** Fineract template principal can be a product minimum (e.g. 100); fee amounts are often computed for the real loan. */
const MAX_PLAUSIBLE_PERCENT_FEE = 100;

function extractPercentRateFromCharge(
  originalCharge: EditableLoanChargeRow["originalCharge"],
  referencePrincipalForRatio: number,
  loanPrincipal: number,
  currentAmount: number
): number | null {
  if (!originalCharge) return null;

  const ref = Math.max(
    1,
    toNumber(referencePrincipalForRatio) ?? 0,
    toNumber(loanPrincipal) ?? 0
  );

  // Prefer the preserved original take-home rate so recalculations always
  // start from the product's configured rate, not a previously rebased value.
  const fromPreserved = toNumber(originalCharge._takeHomePercentage);
  if (fromPreserved != null && fromPreserved > 0 && fromPreserved <= MAX_PLAUSIBLE_PERCENT_FEE) {
    return fromPreserved;
  }

  const fromField = toNumber(originalCharge.percentage);
  if (
    fromField != null &&
    fromField > 0 &&
    fromField <= MAX_PLAUSIBLE_PERCENT_FEE
  ) {
    return fromField;
  }

  if (ref > 0 && Number.isFinite(currentAmount) && currentAmount >= 0) {
    return (currentAmount / ref) * 100;
  }
  return null;
}

export function recomputeTopupAwareDisbursementChargeAmounts(
  charges: EditableLoanChargeRow[],
  params: {
    principal: number;
    isTopup: boolean;
    loanIdToClose: string;
    activeLoanOptions: ActiveLoanOption[] | null | undefined;
    templateDefaultPrincipal: number | null | undefined;
    currencyDecimalPlaces: number;
  }
): EditableLoanChargeRow[] {
  const decimals =
    toNumber(params.currencyDecimalPlaces) != null &&
    Number.isFinite(Number(params.currencyDecimalPlaces))
      ? Math.max(0, Math.min(8, Math.floor(Number(params.currencyDecimalPlaces))))
      : 2;

  const base = computeTopupTakeHomeChargeBase({
    principal: params.principal,
    isTopup: params.isTopup,
    loanIdToClose: params.loanIdToClose,
    activeLoanOptions: params.activeLoanOptions,
  });

  const templatePrincipal = toNumber(params.templateDefaultPrincipal);
  const loanPrincipal = toNumber(params.principal) ?? 0;
  const refPrincipalForRatio = Math.max(
    1,
    templatePrincipal ?? 0,
    loanPrincipal
  );

  return charges.map((charge) => {
    const oc = charge.originalCharge;
    if (!shouldRebaseTopupDisbursementCharge(oc) || !oc) {
      return charge;
    }
    const rate = extractPercentRateFromCharge(
      oc,
      refPrincipalForRatio,
      loanPrincipal,
      charge.amount
    );
    if (rate == null) {
      return charge;
    }

    const P = loanPrincipal;
    const H = base;

    // Fineract only edits % of principal: use p = r×(H/P) so P×p/100 = H×r/100 only when
    // this is a top-up with take-home strictly below principal. Otherwise keep product
    // percentage on the charge row and only set currency amount.
    const useEquivalentPrincipalPercent =
      params.isTopup && P > 0 && H + 1e-9 < P;

    if (useEquivalentPrincipalPercent) {
      const pOnPrincipal = equivalentPrincipalPercentForTakeHomeRate({
        percentOnTakeHome: rate,
        principal: P,
        takeHome: H,
      });
      if (pOnPrincipal == null) {
        return charge;
      }
      const nextAmount = roundMoney((P * pOnPrincipal) / 100, decimals);
      // Preserve the original take-home rate on first rebase; never overwrite on subsequent runs.
      const nextOc = {
        ...oc,
        percentage: pOnPrincipal,
        _takeHomePercentage: oc._takeHomePercentage ?? rate,
      };
      const prevPct = toNumber(oc.percentage);
      if (
        nextAmount === charge.amount &&
        prevPct != null &&
        Math.abs(prevPct - pOnPrincipal) < 1e-6
      ) {
        return charge;
      }
      return { ...charge, amount: nextAmount, originalCharge: nextOc };
    }

    const next = roundMoney((rate / 100) * H, decimals);
    if (next === charge.amount) {
      return charge;
    }
    return { ...charge, amount: next };
  });
}
