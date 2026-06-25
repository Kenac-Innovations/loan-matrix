import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getOrgDefaultCurrencyCode, getOrgRawCurrencyCode } from "@/lib/currency-utils";
import { getSession } from "@/lib/auth";
import {
  returnAllocationFromCashierToTeller,
  allocateCashierCounterAfterCashOut,
} from "@/lib/cash-repayment-teller";
import {
  isCashierCounterEntryBlockedByLoanContext,
} from "@/lib/cashier-txn-reversal-eligibility";

type TellerRow = NonNullable<Awaited<ReturnType<typeof prisma.teller.findFirst>>>;
type CashierRow = NonNullable<Awaited<ReturnType<typeof prisma.cashier.findFirst>>>;
type RepaymentCashLinkDelegate = {
  findMany: (args: {
    where: {
      tenantId: string;
      fineractTransactionId: { in: number[] };
    };
    select: {
      fineractTransactionId: true;
      loanId: true;
    };
  }) => Promise<Array<{ fineractTransactionId: number; loanId: number }>>;
};
type CashierTransaction = {
  id: number | string;
  txnType?: string | { id?: number; code?: string; value?: string };
  transactionType?: { id?: number; code?: string; value?: string };
  txnAmount?: number;
  amount?: number;
  txnDate?: string | number[];
  createdDate?: string | number[];
  transactionDate?: string | number[];
  txnNote?: string;
  notes?: string;
  currency?: { code?: string; name?: string };
  currencyCode?: string;
  _isReversal?: boolean;
  [key: string]: unknown;
};
type CashierSummaryPayload = {
  currency?: { code?: string };
  currencyCode?: string;
  netCash?: number;
  sumCashAllocation?: number;
  sumCashSettlement?: number;
  sumOutwardCash?: number;
  cashierTransactions?:
    | {
        totalFilteredRecords?: number;
        pageItems?: CashierTransaction[];
      }
    | CashierTransaction[];
  [key: string]: unknown;
};

const DEFAULT_CASHIER_PAGE_SIZE = 500;

function extractCashierTransactions(
  payload: CashierSummaryPayload | null | undefined
): CashierTransaction[] {
  const cashierTransactions = payload?.cashierTransactions;
  if (Array.isArray(cashierTransactions?.pageItems)) {
    return cashierTransactions.pageItems;
  }
  if (Array.isArray(cashierTransactions)) {
    return cashierTransactions;
  }
  return [];
}

async function fetchAllCashierSummaryAndTransactions(
  fineractService: {
    getCashierSummaryAndTransactions: (
      tellerId: number,
      cashierId: number,
      currencyCode: string,
      options?: { offset?: number; limit?: number }
    ) => Promise<CashierSummaryPayload>;
  },
  tellerId: number,
  cashierId: number,
  currencyCode: string,
  options?: { offset?: number; limit?: number }
): Promise<CashierSummaryPayload> {
  const requestedOffset = options?.offset ?? 0;
  const requestedLimit = options?.limit;

  if (requestedLimit != null || requestedOffset > 0) {
    return fineractService.getCashierSummaryAndTransactions(
      tellerId,
      cashierId,
      currencyCode,
      options
    );
  }

  const firstPage = await fineractService.getCashierSummaryAndTransactions(
    tellerId,
    cashierId,
    currencyCode,
    { offset: 0, limit: DEFAULT_CASHIER_PAGE_SIZE }
  );

  const firstItems = extractCashierTransactions(firstPage);
  const totalFilteredRecords =
    typeof firstPage?.cashierTransactions === "object" &&
    firstPage?.cashierTransactions &&
    "totalFilteredRecords" in firstPage.cashierTransactions
      ? Number(firstPage.cashierTransactions.totalFilteredRecords ?? firstItems.length)
      : firstItems.length;

  if (!Number.isFinite(totalFilteredRecords) || firstItems.length >= totalFilteredRecords) {
    return firstPage;
  }

  const mergedItems = [...firstItems];
  let nextOffset = DEFAULT_CASHIER_PAGE_SIZE;

  while (nextOffset < totalFilteredRecords) {
    const nextPage = await fineractService.getCashierSummaryAndTransactions(
      tellerId,
      cashierId,
      currencyCode,
      { offset: nextOffset, limit: DEFAULT_CASHIER_PAGE_SIZE }
    );
    const nextItems = extractCashierTransactions(nextPage);
    if (nextItems.length === 0) {
      break;
    }
    mergedItems.push(...nextItems);
    if (nextItems.length < DEFAULT_CASHIER_PAGE_SIZE) {
      break;
    }
    nextOffset += DEFAULT_CASHIER_PAGE_SIZE;
  }

  return {
    ...firstPage,
    cashierTransactions: {
      ...(typeof firstPage.cashierTransactions === "object" && !Array.isArray(firstPage.cashierTransactions)
        ? firstPage.cashierTransactions
        : {}),
      pageItems: mergedItems,
      totalFilteredRecords: mergedItems.length,
    },
  };
}

const LOAN_REPAYMENT_NOTE_REGEX = /loan repayment\s*#\s*(\d+)/i;

function extractLoanIdFromNotes(notes: string | null | undefined): number | null {
  if (!notes) return null;
  const match = notes.match(LOAN_REPAYMENT_NOTE_REGEX);
  if (!match) return null;
  const loanId = Number(match[1]);
  return Number.isFinite(loanId) ? loanId : null;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function getTransactionDate(value: unknown): Date | null {
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value;
    if (
      typeof year === "number" &&
      typeof month === "number" &&
      typeof day === "number"
    ) {
      return new Date(year, month - 1, day);
    }
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function isSameCalendarDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildLeadFullName(lead: {
  fullname?: string | null;
  firstname?: string | null;
  middlename?: string | null;
  lastname?: string | null;
}) {
  const explicit = lead.fullname?.trim();
  if (explicit) return explicit;

  const joined = [lead.firstname, lead.middlename, lead.lastname]
    .filter(Boolean)
    .join(" ")
    .trim();

  return joined || null;
}

function matchLoanPayoutForTransaction(
  tx: CashierTransaction,
  payouts: Array<{
    id: string;
    fineractLoanId: number;
    fineractClientId: number;
    clientName: string;
    loanAccountNo: string;
    amount: number;
    paidAt: Date | null;
    voidedAt: Date | null;
    createdAt: Date;
  }>
) {
  const note = String(tx?.txnNote ?? tx?.notes ?? "");
  const noteLower = normalizeText(note);
  const looksLoanRelated =
    noteLower.includes("loan disbursement") ||
    noteLower.includes("payout") ||
    noteLower.includes("credit balance refund");

  if (!looksLoanRelated) {
    return null;
  }

  const amount = Math.abs(Number(tx?.txnAmount ?? tx?.amount ?? 0));
  const txDate = getTransactionDate(
    tx?.txnDate ?? tx?.transactionDate ?? tx?.createdDate
  );

  let candidates = payouts.filter(
    (payout) => Math.abs(Math.abs(payout.amount) - amount) < 0.01
  );

  if (txDate) {
    const sameDay = candidates.filter((payout) =>
      isSameCalendarDay(txDate, payout.paidAt ?? payout.voidedAt ?? payout.createdAt)
    );
    if (sameDay.length > 0) {
      candidates = sameDay;
    }
  }

  const byNarration = candidates.filter((payout) => {
    const clientName = normalizeText(payout.clientName);
    const accountNo = normalizeText(payout.loanAccountNo);
    return (
      (!!clientName && noteLower.includes(clientName)) ||
      (!!accountNo && noteLower.includes(accountNo))
    );
  });

  return byNarration[0] ?? candidates[0] ?? null;
}

function getTransactionTypeValue(tx: CashierTransaction): string {
  if (typeof tx?.txnType === "object") {
    return tx.txnType?.value || tx.txnType?.code || "";
  }

  if (typeof tx?.transactionType === "object") {
    return tx.transactionType?.value || tx.transactionType?.code || "";
  }

  return String(tx?.txnType ?? tx?.transactionType ?? "");
}

function normalizeTransactionText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function transactionDateKey(tx: CashierTransaction): string {
  const date = getTransactionDate(tx?.txnDate ?? tx?.transactionDate ?? tx?.createdDate);
  if (!date) return "unknown";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function getTransactionAmount(tx: CashierTransaction): number {
  return Math.abs(Number(tx?.txnAmount ?? tx?.amount ?? 0));
}

function getTransactionCurrencyCode(
  tx: CashierTransaction,
  fallbackCurrencyCode?: string
): string {
  return (tx?.currency?.code || tx?.currencyCode || fallbackCurrencyCode || "").toUpperCase();
}

function getDeduplicationKey(
  tx: CashierTransaction,
  fallbackCurrencyCode?: string
): string {
  const amount = getTransactionAmount(tx).toFixed(2);
  const currency = getTransactionCurrencyCode(tx, fallbackCurrencyCode);
  const direction = getSignedCashierTransactionAmount(tx) >= 0 ? "in" : "out";

  return [transactionDateKey(tx), amount, currency, direction].join("|");
}

function getSignedCashierTransactionAmount(tx: CashierTransaction): number {
  const rawAmount = Number(tx?.txnAmount ?? tx?.amount ?? 0);
  const amount = Math.abs(rawAmount);
  const txnTypeValue = normalizeTransactionText(getTransactionTypeValue(tx));
  const isReversal =
    txnTypeValue.includes("reversal") || Boolean((tx as { _isReversal?: boolean })._isReversal);
  const isAllocate =
    txnTypeValue.includes("allocate") ||
    txnTypeValue.includes("credit") ||
    txnTypeValue.includes("deposit");
  const isSettle =
    txnTypeValue.includes("settle") ||
    txnTypeValue.includes("debit") ||
    txnTypeValue.includes("withdrawal") ||
    txnTypeValue.includes("expense");

  if (isReversal || isAllocate) return amount;
  if (isSettle) return -amount;
  return rawAmount;
}

function isGenericLoanRepayment(tx: CashierTransaction): boolean {
  const note = normalizeText(tx?.txnNote ?? tx?.notes);
  const type = normalizeTransactionText(getTransactionTypeValue(tx));

  return (
    note === "loan repayment" &&
    getTransactionAmount(tx) > 0 &&
    getSignedCashierTransactionAmount(tx) > 0 &&
    (type.includes("allocate") || type.includes("deposit") || type.includes("cash"))
  );
}

function isEnrichedLoanRepayment(tx: CashierTransaction): boolean {
  const note = normalizeTransactionText(tx?.txnNote ?? tx?.notes);

  return (
    getTransactionAmount(tx) > 0 &&
    getSignedCashierTransactionAmount(tx) > 0 &&
    (
      Boolean((tx as { linkedLoanId?: number | null }).linkedLoanId) ||
      Boolean((tx as { linkedClientId?: number | null }).linkedClientId) ||
      Boolean((tx as { linkedFullName?: string | null }).linkedFullName) ||
      note.startsWith("repayment") ||
      note.includes("loan repayment")
    )
  );
}

function removeGenericRepaymentDuplicates(
  txns: CashierTransaction[],
  fallbackCurrencyCode?: string
): CashierTransaction[] {
  const enrichedCountsByKey = new Map<string, number>();

  for (const tx of txns) {
    if (!isEnrichedLoanRepayment(tx)) continue;
    const key = getDeduplicationKey(tx, fallbackCurrencyCode);
    enrichedCountsByKey.set(key, (enrichedCountsByKey.get(key) ?? 0) + 1);
  }

  const removedGenericCountsByKey = new Map<string, number>();

  return txns.filter((tx) => {
    if (!isGenericLoanRepayment(tx)) return true;

    const key = getDeduplicationKey(tx, fallbackCurrencyCode);
    const enrichedCount = enrichedCountsByKey.get(key) ?? 0;
    const removedCount = removedGenericCountsByKey.get(key) ?? 0;

    if (removedCount >= enrichedCount) return true;

    removedGenericCountsByKey.set(key, removedCount + 1);
    return false;
  });
}

function isDuplicateFineractAllocationError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002" &&
    "meta" in error &&
    Array.isArray((error as { meta?: { target?: unknown } }).meta?.target) &&
    ((error as { meta?: { target?: unknown[] } }).meta?.target ?? []).includes(
      "fineractAllocationId"
    )
  );
}

async function createCashAllocationWithDuplicateFallback(data: {
  tenantId: string;
  tellerId: string;
  cashierId: string;
  fineractAllocationId?: number | null;
  amount: number;
  currency: string;
  allocatedBy: string;
  notes: string;
  status: string;
}) {
  try {
    return await prisma.cashAllocation.create({
      data: {
        ...data,
        fineractAllocationId: data.fineractAllocationId ?? null,
      },
    });
  } catch (error) {
    if (!isDuplicateFineractAllocationError(error)) {
      throw error;
    }

    const fineractIdNote =
      data.fineractAllocationId != null
        ? ` [Fineract ID: ${data.fineractAllocationId} - duplicate handled]`
        : "";

    return prisma.cashAllocation.create({
      data: {
        ...data,
        fineractAllocationId: null,
        notes: `${data.notes}${fineractIdNote}`,
      },
    });
  }
}

type ResolveResult =
  | {
      ok: true;
      teller: TellerRow;
      /** Null when the cashier exists only in Fineract (numeric id); GET still works, POST requires a row */
      cashier: CashierRow | null;
      fineractCashierId: number;
    }
  | { ok: false; status: number; error: string };

async function resolveTellerCashierForTenant(
  tellerIdParam: string,
  cashierIdParam: string,
  tenantId: string,
  opts?: { requireDbCashier?: boolean }
): Promise<ResolveResult> {
  let fineractTellerIdFromPrefix: number | null = null;
  if (tellerIdParam.startsWith("fineract-")) {
    fineractTellerIdFromPrefix = parseInt(tellerIdParam.replace("fineract-", ""), 10);
  }

  let teller = await prisma.teller.findFirst({
    where: { id: tellerIdParam, tenantId },
  });

  const fineractTellerIdToSearch =
    fineractTellerIdFromPrefix ||
    (!isNaN(Number(tellerIdParam)) ? Number(tellerIdParam) : null);
  if (!teller && fineractTellerIdToSearch) {
    teller = await prisma.teller.findFirst({
      where: { fineractTellerId: fineractTellerIdToSearch, tenantId },
    });
  }

  if (!teller || !teller.fineractTellerId) {
    return {
      ok: false,
      status: 404,
      error: "Teller not found or does not have a Fineract ID",
    };
  }

  const cashierIdNum = parseInt(cashierIdParam, 10);
  const isNumericId = !isNaN(cashierIdNum);

  let cashier = await prisma.cashier.findFirst({
    where: { id: cashierIdParam, tellerId: teller.id, tenantId },
  });

  if (!cashier && isNumericId) {
    cashier = await prisma.cashier.findFirst({
      where: {
        fineractCashierId: cashierIdNum,
        tellerId: teller.id,
        tenantId,
      },
    });
  }

  let fineractCashierId: number;
  if (cashier?.fineractCashierId) {
    fineractCashierId = cashier.fineractCashierId;
  } else if (isNumericId) {
    fineractCashierId = cashierIdNum;
  } else {
    return {
      ok: false,
      status: 404,
      error: "Cashier not found or invalid cashier ID",
    };
  }

  if (!cashier && opts?.requireDbCashier) {
    return {
      ok: false,
      status: 404,
      error:
        "Cashier must exist in Loan Matrix to post a reversal offset (sync cashiers from Fineract if needed)",
    };
  }

  return { ok: true, teller, cashier, fineractCashierId };
}

/**
 * GET /api/tellers/[id]/cashiers/[cashierId]/transactions
 * Get summary and transactions for a cashier
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; cashierId: string }> }
) {
  try {
    const params = await context.params;
    const { id: tellerId, cashierId } = params;
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const resolved = await resolveTellerCashierForTenant(
      tellerId,
      cashierId,
      tenant.id
    );
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const { teller, cashier, fineractCashierId } = resolved;

    const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
    const [rawCurrency, normalizedCurrency] = await Promise.all([
      getOrgRawCurrencyCode(),
      getOrgDefaultCurrencyCode(),
    ]);
    const currencyCode = searchParams.get("currencyCode") || rawCurrency;
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_CASHIER_PAGE_SIZE;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    const fineractService = await getFineractServiceWithSession();
    const paginationOptions =
      offset > 0 || limit !== DEFAULT_CASHIER_PAGE_SIZE
        ? { offset, limit: Math.min(limit, DEFAULT_CASHIER_PAGE_SIZE) }
        : undefined;

    // Dual-fetch: some orgs have repayments stored under both ZMK and ZMW due to historical
    // normalization. Fetch both and merge so nothing is invisible in the UI.
    const needsDualFetch = rawCurrency !== normalizedCurrency;
    const altCurrency = currencyCode === rawCurrency ? normalizedCurrency : rawCurrency;
    const [primaryResult, secondaryResult] = await Promise.all([
      fetchAllCashierSummaryAndTransactions(
        fineractService,
        teller.fineractTellerId,
        fineractCashierId,
        currencyCode,
        paginationOptions
      ),
      needsDualFetch
        ? fetchAllCashierSummaryAndTransactions(
            fineractService,
              teller.fineractTellerId,
              fineractCashierId,
              altCurrency,
              paginationOptions
            )
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    // Merge secondary result into primary
    let summaryAndTransactions: CashierSummaryPayload = primaryResult;
    if (secondaryResult) {
      const primaryItems: CashierTransaction[] = Array.isArray(primaryResult?.cashierTransactions?.pageItems)
        ? primaryResult.cashierTransactions.pageItems
        : Array.isArray(primaryResult?.cashierTransactions)
        ? primaryResult.cashierTransactions
        : [];
      const secondaryItems: CashierTransaction[] = Array.isArray(secondaryResult?.cashierTransactions?.pageItems)
        ? secondaryResult.cashierTransactions.pageItems
        : Array.isArray(secondaryResult?.cashierTransactions)
        ? secondaryResult.cashierTransactions
        : [];

      // Deduplicate by id — primary takes precedence
      const seen = new Set(primaryItems.map((t) => t.id));
      const merged = [...primaryItems, ...secondaryItems.filter((t) => !seen.has(t.id))];

      summaryAndTransactions = {
        ...primaryResult,
        netCash: (primaryResult?.netCash ?? 0) + (secondaryResult?.netCash ?? 0),
        sumCashAllocation: (primaryResult?.sumCashAllocation ?? 0) + (secondaryResult?.sumCashAllocation ?? 0),
        sumCashSettlement: (primaryResult?.sumCashSettlement ?? 0) + (secondaryResult?.sumCashSettlement ?? 0),
        sumOutwardCash: (primaryResult?.sumOutwardCash ?? 0) + (secondaryResult?.sumOutwardCash ?? 0),
        cashierTransactions: {
          ...(primaryResult?.cashierTransactions ?? {}),
          pageItems: merged,
          totalFilteredRecords: merged.length,
        },
      };
    }

    const dbCashierId = cashier?.id ?? null;
    const reversedPayouts =
      dbCashierId != null
        ? await prisma.loanPayout.findMany({
            where: {
              tenantId: tenant.id,
              cashierId: dbCashierId,
              status: "REVERSED",
              voidedAt: { not: null },
            },
            orderBy: { voidedAt: "asc" },
          })
        : [];

    const reversalTransactions = reversedPayouts.map((p) => {
      const d = p.voidedAt!;
      return {
        id: `reversal-${p.id}`,
        txnType: { value: "Reversal", code: "REVERSAL" },
        transactionType: { value: "Reversal", code: "REVERSAL" },
        txnAmount: p.amount,
        amount: p.amount,
        txnDate: [d.getFullYear(), d.getMonth() + 1, d.getDate()] as number[],
        createdDate: [d.getFullYear(), d.getMonth() + 1, d.getDate()] as number[],
        transactionDate: [d.getFullYear(), d.getMonth() + 1, d.getDate()] as number[],
        txnNote: `Reversal - ${p.voidReason ?? "Payout reversed"}`,
        notes: p.voidReason ?? undefined,
        currencyCode,
        _isReversal: true,
      };
    });

    if (reversalTransactions.length > 0) {
      const base = summaryAndTransactions?.cashierTransactions ?? {};
      const pageItems = Array.isArray(base.pageItems)
        ? base.pageItems
        : Array.isArray(base)
          ? base
          : [];
      const merged = [...pageItems, ...reversalTransactions].sort((a, b) => {
        const dateA = a.txnDate ?? a.createdDate ?? a.transactionDate;
        const dateB = b.txnDate ?? b.createdDate ?? b.transactionDate;
        if (!dateA || !dateB) return 0;
        const arrA = Array.isArray(dateA) ? dateA : [0, 0, 0];
        const arrB = Array.isArray(dateB) ? dateB : [0, 0, 0];
        const tsA = new Date(arrA[0], (arrA[1] ?? 1) - 1, arrA[2] ?? 1).getTime();
        const tsB = new Date(arrB[0], (arrB[1] ?? 1) - 1, arrB[2] ?? 1).getTime();
        return tsB - tsA;
      });
      if (Array.isArray(base)) {
        summaryAndTransactions.cashierTransactions = merged;
      } else {
        summaryAndTransactions.cashierTransactions = { ...base, pageItems: merged };
      }
    }

    const cashierTransactions = summaryAndTransactions?.cashierTransactions;
    const responseCurrencyCode =
      summaryAndTransactions?.currency?.code ||
      summaryAndTransactions?.currencyCode ||
      currencyCode;

    const pageItems = Array.isArray(cashierTransactions?.pageItems)
      ? cashierTransactions.pageItems
      : Array.isArray(cashierTransactions)
      ? cashierTransactions
      : [];

    const normalizedItems: CashierTransaction[] = pageItems.map((tx) => ({
      ...tx,
      currencyCode: tx?.currency?.code || tx?.currencyCode || responseCurrencyCode,
    }));

    const numericTransactionIds = normalizedItems
      .map((tx) => (typeof tx?.id === "number" ? tx.id : null))
      .filter((id: number | null): id is number => id != null);

    const repaymentCashLinkDelegate = (
      prisma as typeof prisma & {
        repaymentCashLink?: RepaymentCashLinkDelegate;
      }
    ).repaymentCashLink;

    const [repaymentLinks, loanPayouts] = await Promise.all([
      numericTransactionIds.length > 0 && repaymentCashLinkDelegate
        ? repaymentCashLinkDelegate.findMany({
            where: {
              tenantId: tenant.id,
              fineractTransactionId: { in: numericTransactionIds },
            },
            select: {
              fineractTransactionId: true,
              loanId: true,
            },
          })
        : Promise.resolve([]),
      dbCashierId
        ? prisma.loanPayout.findMany({
            where: {
              tenantId: tenant.id,
              cashierId: dbCashierId,
            },
            select: {
              id: true,
              fineractLoanId: true,
              fineractClientId: true,
              clientName: true,
              loanAccountNo: true,
              amount: true,
              paidAt: true,
              voidedAt: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const repaymentLinkByTxId = new Map(
      repaymentLinks.map((link) => [link.fineractTransactionId, link.loanId])
    );
    const payoutById = new Map(loanPayouts.map((payout) => [payout.id, payout]));

    const candidateLoanIds = new Set<number>();
    for (const tx of normalizedItems) {
      const noteLoanId = extractLoanIdFromNotes(tx?.txnNote ?? tx?.notes);
      if (noteLoanId != null) {
        candidateLoanIds.add(noteLoanId);
      }

      if (typeof tx?.id === "number") {
        const linkedLoanId = repaymentLinkByTxId.get(tx.id);
        if (linkedLoanId != null) {
          candidateLoanIds.add(linkedLoanId);
        }
      }

      if (typeof tx?.id === "string" && tx.id.startsWith("reversal-")) {
        const payout = payoutById.get(tx.id.replace("reversal-", ""));
        if (payout?.fineractLoanId != null) {
          candidateLoanIds.add(payout.fineractLoanId);
        }
      }

      const payoutMatch = matchLoanPayoutForTransaction(tx, loanPayouts);
      if (payoutMatch?.fineractLoanId != null) {
        candidateLoanIds.add(payoutMatch.fineractLoanId);
      }
    }

    const leads = candidateLoanIds.size
      ? await prisma.lead.findMany({
          where: {
            tenantId: tenant.id,
            fineractLoanId: { in: Array.from(candidateLoanIds) },
          },
          select: {
            id: true,
            fineractLoanId: true,
            fineractClientId: true,
            externalId: true,
            fullname: true,
            firstname: true,
            middlename: true,
            lastname: true,
          },
        })
      : [];

    const leadByLoanId = new Map(
      leads
        .filter((lead) => lead.fineractLoanId != null)
        .map((lead) => [lead.fineractLoanId as number, lead])
    );

    const enrichedItems = normalizedItems.map((tx) => {
      const noteLoanId = extractLoanIdFromNotes(tx?.txnNote ?? tx?.notes);
      const repaymentLoanId =
        typeof tx?.id === "number" ? repaymentLinkByTxId.get(tx.id) ?? null : null;

      let payoutMatch =
        typeof tx?.id === "string" && tx.id.startsWith("reversal-")
          ? payoutById.get(tx.id.replace("reversal-", "")) ?? null
          : null;

      if (!payoutMatch) {
        payoutMatch = matchLoanPayoutForTransaction(tx, loanPayouts);
      }

      const linkedLoanId =
        noteLoanId ?? repaymentLoanId ?? payoutMatch?.fineractLoanId ?? null;
      const lead = linkedLoanId != null ? leadByLoanId.get(linkedLoanId) ?? null : null;
      const linkedClientId =
        lead?.fineractClientId ?? payoutMatch?.fineractClientId ?? null;
      const linkedFullName =
        buildLeadFullName(lead ?? {}) ?? payoutMatch?.clientName ?? null;
      const loanDetailHref =
        linkedLoanId != null && linkedClientId != null
          ? `/clients/${linkedClientId}/loans/${linkedLoanId}`
          : lead?.id
          ? `/leads/${lead.id}`
          : null;

      return {
        ...tx,
        linkedLoanId,
        linkedClientId,
        linkedLeadId: lead?.id ?? null,
        linkedNrc: lead?.externalId ?? null,
        linkedFullName,
        loanDetailHref,
      };
    });

    const dedupedItems = removeGenericRepaymentDuplicates(
      enrichedItems,
      responseCurrencyCode
    );

    if (Array.isArray(cashierTransactions?.pageItems)) {
      cashierTransactions.pageItems = dedupedItems;
      cashierTransactions.totalFilteredRecords = dedupedItems.length;
    } else if (Array.isArray(cashierTransactions)) {
      summaryAndTransactions.cashierTransactions = dedupedItems;
    }

    return NextResponse.json(summaryAndTransactions);
  } catch (error) {
    console.error("Error fetching cashier transactions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

const LOAN_REVERSAL_HINT =
  "Loan repayment and disbursement on the till must be reversed from the loan in Fineract / Loan Matrix (transaction Undo, Undo disbursal, etc.). This endpoint only posts an opposing **cashier** entry (settle or allocate) — it does not change the loan.";

async function ensureCashierSessionForCounterEntry(
  tenantId: string,
  teller: TellerRow,
  cashier: CashierRow,
  fineractCashierId: number
): Promise<NextResponse | null> {
  let activeSession = await prisma.cashierSession.findFirst({
    where: {
      tellerId: teller.id,
      cashierId: cashier.id,
      tenantId,
      sessionStatus: "ACTIVE",
    },
  });

  if (!activeSession) {
    try {
      const fineractService = await getFineractServiceWithSession();
      const fineractCashierData = await fineractService.getCashier(
        teller.fineractTellerId,
        fineractCashierId
      );
      if (fineractCashierData?.isRunning) {
        activeSession = await prisma.cashierSession.create({
          data: {
            tenantId,
            tellerId: teller.id,
            cashierId: cashier.id,
            fineractSessionId: fineractCashierData.id || 0,
            sessionStatus: "ACTIVE",
            sessionStartTime: new Date(),
            allocatedBalance: 0,
            availableBalance: 0,
            openingFloat: 0,
            cashIn: 0,
            cashOut: 0,
            netCash: 0,
          },
        });
      }
    } catch (e) {
      console.error("Error syncing Fineract session for cashier counter-entry:", e);
    }
  }

  if (!activeSession) {
    const closedSession = await prisma.cashierSession.findFirst({
      where: {
        tellerId: teller.id,
        cashierId: cashier.id,
        tenantId,
        sessionStatus: "CLOSED",
      },
      orderBy: { sessionEndTime: "desc" },
    });
    if (!closedSession) {
      return NextResponse.json(
        {
          error: "Session required",
          details:
            "Cashier must have an active session (or a recent closed session) before posting a counter-entry.",
        },
        { status: 400 }
      );
    }
  }
  return null;
}

/**
 * POST /api/tellers/[id]/cashiers/[cashierId]/transactions
 *
 * - `reverseAllocation` (legacy): same as reverseCashierEntry with originalCashDirection=cashIn.
 * - `reverseCashierEntry`: opposing cashier-only movement — cashIn → settle to teller; cashOut → allocate from teller.
 * Loan repayment / disbursement patterns are rejected.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; cashierId: string }> }
) {
  try {
    const params = await context.params;
    const { id: tellerId, cashierId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const command = body?.command as string | undefined;

    if (command === "repaymentReversalOffset") {
      return NextResponse.json(
        {
          error: "Repayment and disbursement reversals are not supported on this endpoint",
          details: LOAN_REVERSAL_HINT,
        },
        { status: 400 }
      );
    }

    const isReverseAllocation = command === "reverseAllocation";
    const isReverseCashierEntry = command === "reverseCashierEntry";
    if (!isReverseAllocation && !isReverseCashierEntry) {
      return NextResponse.json(
        {
          error: "Unsupported command",
          details: `Use command: "reverseCashierEntry" with originalCashDirection ("cashIn" | "cashOut"), amount, currencyCode, optional transactionDate, notes, and optional sourceTxnTypeCode/sourceTxnTypeValue/sourceNotes from the row. Legacy: "reverseAllocation" (cash-in only). ${LOAN_REVERSAL_HINT}`,
        },
        { status: 400 }
      );
    }

    if (
      isCashierCounterEntryBlockedByLoanContext({
        sourceTxnTypeCode: body.sourceTxnTypeCode,
        sourceTxnTypeValue: body.sourceTxnTypeValue,
        sourceNotes: body.sourceNotes,
        notes: body.notes,
        sourceTransactionType: body.sourceTransactionType,
      })
    ) {
      return NextResponse.json(
        {
          error: "Repayment or disbursement must be reversed from the loan",
          details: LOAN_REVERSAL_HINT,
        },
        { status: 400 }
      );
    }

    if (isReverseAllocation && body.fineractLoanId != null) {
      return NextResponse.json(
        {
          error: "Do not send fineractLoanId for cashier-only reversal",
          details: LOAN_REVERSAL_HINT,
        },
        { status: 400 }
      );
    }

    let originalCashDirection: "cashIn" | "cashOut";
    if (isReverseAllocation) {
      originalCashDirection = "cashIn";
    } else {
      const d = body.originalCashDirection as string | undefined;
      if (d !== "cashIn" && d !== "cashOut") {
        return NextResponse.json(
          {
            error: "originalCashDirection is required",
            details: 'Set to "cashIn" to reverse a cash-in on the till (posts settle), or "cashOut" to reverse a cash-out (posts allocate).',
          },
          { status: 400 }
        );
      }
      originalCashDirection = d;
    }

    const amount = Number(body.amount);
    const currencyCode = body.currencyCode as string | undefined;
    if (!amount || amount <= 0 || !currencyCode) {
      return NextResponse.json(
        { error: "amount and currencyCode are required; amount must be > 0" },
        { status: 400 }
      );
    }

    const resolved = await resolveTellerCashierForTenant(tellerId, cashierId, tenant.id, {
      requireDbCashier: true,
    });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const { teller, cashier, fineractCashierId } = resolved;
    if (!cashier) {
      return NextResponse.json({ error: "Cashier not found" }, { status: 404 });
    }

    const sessionErr = await ensureCashierSessionForCounterEntry(
      tenant.id,
      teller,
      cashier,
      fineractCashierId
    );
    if (sessionErr) return sessionErr;

    const transactionDate =
      typeof body.transactionDate === "string" && body.transactionDate.length >= 8
        ? body.transactionDate
        : new Date().toISOString().split("T")[0];

    const srcId =
      body.sourceFineractTransactionId != null
        ? String(body.sourceFineractTransactionId)
        : "";
    const noteSuffix = srcId ? ` (counter for cashier txn #${srcId})` : "";

    const cashierTxnCurrencyCode = String(currencyCode).trim().toUpperCase();

    if (originalCashDirection === "cashIn") {
      const result = await returnAllocationFromCashierToTeller({
        fineractTellerId: teller.fineractTellerId,
        fineractCashierId,
        amount,
        currencyCode,
        transactionDate,
        notes: `Settlement return to vault - cashier counter-entry (reverse cash-in)${noteSuffix}`,
      });

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || "Fineract settle failed" },
          { status: 502 }
        );
      }

      const settlementNotes = isReverseAllocation
        ? `Allocation reversed - returned to vault${noteSuffix}`
        : `Settlement return to vault - cashier counter-entry (reverse cash-in)${noteSuffix}`;

      const settlement = await createCashAllocationWithDuplicateFallback({
        tenantId: tenant.id,
        tellerId: teller.id,
        cashierId: cashier.id,
        fineractAllocationId: result.fineractSettlementId ?? null,
        amount: -Math.abs(amount),
        currency: cashierTxnCurrencyCode,
        allocatedBy: session.user.id,
        notes: settlementNotes,
        status: "ACTIVE",
      });

      return NextResponse.json({
        success: true,
        command: isReverseAllocation ? "reverseAllocation" : "reverseCashierEntry",
        opposingMovement: "settle",
        transaction: settlement,
        fineractSettlementId: result.fineractSettlementId,
      });
    }

    const allocResult = await allocateCashierCounterAfterCashOut({
      fineractTellerId: teller.fineractTellerId,
      fineractCashierId,
      amount,
      currencyCode,
      transactionDate,
      notes: `Cashier allocation correction - reverse cash-out${noteSuffix}`,
    });

    if (!allocResult.success) {
      return NextResponse.json(
        { error: allocResult.error || "Fineract allocate failed" },
        { status: 502 }
      );
    }

    const allocNotes = `Cashier allocation correction - reverse cash-out${noteSuffix}`;

    const allocation = await createCashAllocationWithDuplicateFallback({
      tenantId: tenant.id,
      tellerId: teller.id,
      cashierId: cashier.id,
      fineractAllocationId: allocResult.fineractResourceId ?? null,
      amount: Math.abs(amount),
      currency: cashierTxnCurrencyCode,
      allocatedBy: session.user.id,
      notes: allocNotes,
      status: "ACTIVE",
    });

    return NextResponse.json({
      success: true,
      command: "reverseCashierEntry",
      opposingMovement: "allocate",
      transaction: allocation,
      fineractResourceId: allocResult.fineractResourceId,
    });
  } catch (error) {
    console.error("Error posting cashier counter-entry:", error);
    return NextResponse.json(
      {
        error: "Failed to post cashier counter-entry",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
