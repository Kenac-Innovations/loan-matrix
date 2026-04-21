import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getOrgDefaultCurrencyCode, getOrgRawCurrencyCode } from "@/lib/currency-utils";

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

    // Handle fineract-prefixed IDs for teller
    let fineractTellerIdFromPrefix: number | null = null;
    if (tellerId.startsWith("fineract-")) {
      fineractTellerIdFromPrefix = parseInt(tellerId.replace("fineract-", ""));
    }

    // Get teller by database ID or Fineract ID
    let teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

    // Try by Fineract ID if not found
    const fineractTellerIdToSearch = fineractTellerIdFromPrefix || (!isNaN(Number(tellerId)) ? Number(tellerId) : null);
    if (!teller && fineractTellerIdToSearch) {
      teller = await prisma.teller.findFirst({
        where: { fineractTellerId: fineractTellerIdToSearch, tenantId: tenant.id },
      });
    }

    if (!teller || !teller.fineractTellerId) {
      return NextResponse.json(
        { error: "Teller not found or does not have a Fineract ID" },
        { status: 404 }
      );
    }

    // Parse cashierId - could be database ID or Fineract ID
    const cashierIdNum = parseInt(cashierId);
    const isNumericId = !isNaN(cashierIdNum);

    // Try to find cashier by database ID first
    let cashier = await prisma.cashier.findFirst({
      where: { id: cashierId, tellerId: teller.id, tenantId: tenant.id },
    });

    // If not found by database ID and cashierId is numeric, try Fineract ID
    if (!cashier && isNumericId) {
        cashier = await prisma.cashier.findFirst({
          where: {
          fineractCashierId: cashierIdNum,
          tellerId: teller.id,
            tenantId: tenant.id,
          },
        });
    }

    // Get Fineract cashier ID
    let fineractCashierId: number;
    if (cashier?.fineractCashierId) {
      fineractCashierId = cashier.fineractCashierId;
    } else if (isNumericId) {
      fineractCashierId = cashierIdNum;
    } else {
      return NextResponse.json(
        { error: "Cashier not found or invalid cashier ID" },
        { status: 404 }
      );
    }

    // Get currency code and pagination from query params
    const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
    const [rawCurrency, normalizedCurrency] = await Promise.all([
      getOrgRawCurrencyCode(),
      getOrgDefaultCurrencyCode(),
    ]);
    const currencyCode = searchParams.get("currencyCode") || rawCurrency;
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const limit = limitParam ? parseInt(limitParam, 10) : 500;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // Fetch summary and transactions from Fineract.
    // Note: Some Fineract versions don't support offset/limit and may throw. Pass only when explicitly requested.
    const fineractService = await getFineractServiceWithSession();
    const paginationOptions =
      offset > 0 || limit !== 500
        ? { offset, limit: Math.min(limit, 500) }
        : undefined;

    // Dual-fetch: some orgs have repayments stored under both ZMK and ZMW due to historical
    // normalization. Fetch both and merge so nothing is invisible in the UI.
    const needsDualFetch = rawCurrency !== normalizedCurrency;
    const altCurrency = currencyCode === rawCurrency ? normalizedCurrency : rawCurrency;
    const [primaryResult, secondaryResult] = await Promise.all([
      fineractService.getCashierSummaryAndTransactions(
        teller.fineractTellerId,
        fineractCashierId,
        currencyCode,
        paginationOptions
      ),
      needsDualFetch
        ? fineractService
            .getCashierSummaryAndTransactions(
              teller.fineractTellerId,
              fineractCashierId,
              altCurrency,
              paginationOptions
            )
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    // Merge secondary result into primary
    let summaryAndTransactions = primaryResult;
    if (secondaryResult) {
      const primaryItems: unknown[] = Array.isArray(primaryResult?.cashierTransactions?.pageItems)
        ? primaryResult.cashierTransactions.pageItems
        : Array.isArray(primaryResult?.cashierTransactions)
        ? primaryResult.cashierTransactions
        : [];
      const secondaryItems: unknown[] = Array.isArray(secondaryResult?.cashierTransactions?.pageItems)
        ? secondaryResult.cashierTransactions.pageItems
        : Array.isArray(secondaryResult?.cashierTransactions)
        ? secondaryResult.cashierTransactions
        : [];

      // Deduplicate by id — primary takes precedence
      const seen = new Set(primaryItems.map((t: any) => t.id));
      const merged = [...primaryItems, ...secondaryItems.filter((t: any) => !seen.has(t.id))];

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

    // Merge REVERSED loan payouts for this cashier into transaction history (so reversals show as Cash In)
    const dbCashierId = cashier?.id ?? null;
    if (dbCashierId) {
      const reversedPayouts = await prisma.loanPayout.findMany({
        where: {
          tenantId: tenant.id,
          cashierId: dbCashierId,
          status: "REVERSED",
          voidedAt: { not: null },
        },
        orderBy: { voidedAt: "asc" },
      });

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
          _isReversal: true,
        };
      });

      if (reversalTransactions.length > 0) {
        const base = summaryAndTransactions?.cashierTransactions ?? {};
        const pageItems = Array.isArray(base.pageItems) ? base.pageItems : Array.isArray(base) ? base : [];
        const merged = [...pageItems, ...reversalTransactions].sort((a, b) => {
          const dateA = a.txnDate ?? a.createdDate ?? a.transactionDate;
          const dateB = b.txnDate ?? b.createdDate ?? b.transactionDate;
          if (!dateA || !dateB) return 0;
          const arrA = Array.isArray(dateA) ? dateA : [0, 0, 0];
          const arrB = Array.isArray(dateB) ? dateB : [0, 0, 0];
          const tsA = new Date(arrA[0], (arrA[1] ?? 1) - 1, arrA[2] ?? 1).getTime();
          const tsB = new Date(arrB[0], (arrB[1] ?? 1) - 1, arrB[2] ?? 1).getTime();
          return tsB - tsA; // newest first
        });
        if (Array.isArray(base)) {
          (summaryAndTransactions as any).cashierTransactions = merged;
        } else {
          (summaryAndTransactions as any).cashierTransactions = { ...base, pageItems: merged };
        }
      }
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
