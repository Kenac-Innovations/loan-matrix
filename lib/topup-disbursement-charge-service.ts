import { fetchFineractAPI } from "./api";
import { prisma } from "./prisma";

interface ApplyTopupDisbursementChargesParams {
  loanId: number;
  tenantId: string;
  source: "state-transition" | "loan-disburse-route" | "loan-action-route";
  disbursedAmount?: number | null;
}

interface ApplyTopupDisbursementChargesResult {
  attempted: number;
  applied: number;
  skipped: number;
  reason?: string;
}

interface InitialLoanChargePayload {
  chargeId?: unknown;
  [key: string]: unknown;
}

interface FineractTopupDetails {
  topupAmount?: unknown;
  loanBalance?: unknown;
}

interface FineractLoanSnapshot {
  isTopup?: boolean;
  topupDetails?: FineractTopupDetails;
  loanBalance?: unknown;
  principal?: unknown;
  approvedPrincipal?: unknown;
  proposedPrincipal?: unknown;
  currency?: {
    decimalPlaces?: unknown;
  };
}

interface FineractLoanChargeSummary {
  chargeId?: unknown;
  dueDate?: unknown;
  dueAsOfDate?: unknown;
  amount?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  // Prisma Decimal and similar numeric wrappers
  if (typeof (value as { toString?: () => string })?.toString === "function") {
    const parsed = Number((value as { toString: () => string }).toString());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function pickFirstPositive(...values: unknown[]): number | null {
  for (const candidate of values) {
    const value = toNumber(candidate);
    if (value != null && value > 0) {
      return value;
    }
  }
  return null;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatDateForFineract(date: Date): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function toIsoDate(value: unknown): string | null {
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value;
    if (
      typeof year === "number" &&
      typeof month === "number" &&
      typeof day === "number"
    ) {
      return `${year.toString().padStart(4, "0")}-${month
        .toString()
        .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return null;
}

function extractChargeList(payload: unknown): FineractLoanChargeSummary[] {
  if (Array.isArray(payload)) return payload as FineractLoanChargeSummary[];
  if (isRecord(payload) && Array.isArray(payload.pageItems)) {
    return payload.pageItems as FineractLoanChargeSummary[];
  }
  if (isRecord(payload) && Array.isArray(payload.charges)) {
    return payload.charges as FineractLoanChargeSummary[];
  }
  return [];
}

async function getTopupDisbursementChargeProducts(tenantId: string) {
  return prisma.chargeProduct.findMany({
    where: {
      tenantId,
      type: "LOAN",
      chargeTimeType: "DISBURSEMENT",
      active: true,
      syncStatus: "SYNCED",
      fineractChargeId: { not: null },
      fineractChargeTimeType: "SPECIFIED_DUE_DATE",
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function filterInitialLoanChargesForTopup(params: {
  tenantId: string;
  isTopup: boolean;
  charges: InitialLoanChargePayload[];
}): Promise<InitialLoanChargePayload[]> {
  const { tenantId, isTopup, charges } = params;

  if (!isTopup || charges.length === 0) {
    return charges;
  }

  const chargeProducts = await getTopupDisbursementChargeProducts(tenantId);
  if (chargeProducts.length === 0) {
    return charges;
  }

  const topupChargeIds = new Set(
    chargeProducts
      .map((product) => toNumber(product.fineractChargeId))
      .filter((chargeId): chargeId is number => chargeId != null && chargeId > 0)
  );

  if (topupChargeIds.size === 0) {
    return charges;
  }

  return charges.filter((charge) => {
    const chargeId = toNumber(charge?.chargeId);
    return chargeId == null || !topupChargeIds.has(chargeId);
  });
}

function hasExistingChargeForToday(
  existingCharges: FineractLoanChargeSummary[],
  chargeId: number,
  amount: number,
  todayIso: string
): boolean {
  return existingCharges.some((charge: FineractLoanChargeSummary) => {
    const existingChargeId = toNumber(charge?.chargeId);
    if (existingChargeId !== chargeId) return false;

    const dueIso =
      toIsoDate(charge?.dueDate) ??
      toIsoDate(charge?.dueAsOfDate);

    if (!dueIso || dueIso !== todayIso) return false;

    const existingAmount = toNumber(charge?.amount);
    if (existingAmount == null) return false;

    // Loose tolerance for floating conversion differences.
    return Math.abs(existingAmount - amount) < 0.01;
  });
}

export async function applyTopupDisbursementCharges(
  params: ApplyTopupDisbursementChargesParams
): Promise<ApplyTopupDisbursementChargesResult> {
  const { loanId, tenantId, source, disbursedAmount } = params;

  if (!Number.isFinite(loanId) || loanId <= 0) {
    return {
      attempted: 0,
      applied: 0,
      skipped: 0,
      reason: "Invalid loanId",
    };
  }

  const loan = (await fetchFineractAPI(
    `/loans/${loanId}?associations=all&exclude=guarantors,futureSchedule`,
    { method: "GET" }
  )) as FineractLoanSnapshot;

  const isTopup = Boolean(loan?.isTopup || loan?.topupDetails);
  if (!isTopup) {
    return {
      attempted: 0,
      applied: 0,
      skipped: 0,
      reason: "Loan is not topup",
    };
  }

  const previousLoanBalance = pickFirstPositive(
    loan?.topupDetails?.topupAmount,
    loan?.topupDetails?.loanBalance,
    loan?.loanBalance
  );

  const principal = pickFirstPositive(
    loan?.principal,
    loan?.approvedPrincipal,
    loan?.proposedPrincipal,
    disbursedAmount
  );

  if (principal == null || previousLoanBalance == null) {
    console.warn("[TopupDisbursementCharges] Missing required topup values", {
      source,
      loanId,
      principal,
      previousLoanBalance,
      topupDetails: loan?.topupDetails,
    });

    return {
      attempted: 0,
      applied: 0,
      skipped: 0,
      reason: "Missing principal or previous loan balance",
    };
  }

  const remainingAmount = round(principal - previousLoanBalance, 6);
  if (remainingAmount <= 0) {
    return {
      attempted: 0,
      applied: 0,
      skipped: 0,
      reason: "Remaining amount is not positive",
    };
  }

  const chargeProducts = await getTopupDisbursementChargeProducts(tenantId);

  if (chargeProducts.length === 0) {
    return {
      attempted: 0,
      applied: 0,
      skipped: 0,
      reason: "No matching DISBURSEMENT charge products",
    };
  }

  let existingCharges: FineractLoanChargeSummary[] = [];
  try {
    const existingChargesPayload = await fetchFineractAPI(`/loans/${loanId}/charges`, {
      method: "GET",
    });
    existingCharges = extractChargeList(existingChargesPayload);
  } catch (error) {
    // Non-blocking: we can still attempt to apply charges.
    console.warn("[TopupDisbursementCharges] Failed to fetch existing loan charges", {
      source,
      loanId,
      error,
    });
  }

  const today = new Date();
  const todayIso = toIsoDate(today) || "";
  const dueDate = formatDateForFineract(today);
  const currencyDecimals = toNumber(loan?.currency?.decimalPlaces) ?? 2;

  let attempted = 0;
  let applied = 0;
  let skipped = 0;

  for (const product of chargeProducts) {
    const percentage = toNumber(product.amount);
    const chargeId = product.fineractChargeId;

    if (chargeId == null || percentage == null || percentage <= 0) {
      skipped += 1;
      continue;
    }

    attempted += 1;
    const amount = round((percentage / 100) * remainingAmount, currencyDecimals);

    if (amount <= 0) {
      skipped += 1;
      continue;
    }

    if (todayIso && hasExistingChargeForToday(existingCharges, chargeId, amount, todayIso)) {
      skipped += 1;
      continue;
    }

    const payload = {
      chargeId,
      amount,
      dueDate,
      dateFormat: "dd MMMM yyyy",
      locale: "en",
    };

    await fetchFineractAPI(`/loans/${loanId}/charges`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    applied += 1;
  }

  console.info("[TopupDisbursementCharges] Completed", {
    source,
    loanId,
    tenantId,
    principal,
    previousLoanBalance,
    remainingAmount,
    attempted,
    applied,
    skipped,
  });

  return { attempted, applied, skipped };
}
