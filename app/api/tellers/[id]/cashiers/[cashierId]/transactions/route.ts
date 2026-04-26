import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getOrgDefaultCurrencyCode, getOrgRawCurrencyCode } from "@/lib/currency-utils";
import { getSession } from "@/lib/auth";
import { returnAllocationFromCashierToTeller } from "@/lib/cash-repayment-teller";

type TellerRow = NonNullable<Awaited<ReturnType<typeof prisma.teller.findFirst>>>;
type CashierRow = NonNullable<Awaited<ReturnType<typeof prisma.cashier.findFirst>>>;

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
    const limit = limitParam ? parseInt(limitParam, 10) : 500;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

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
        (summaryAndTransactions as any).cashierTransactions = merged;
      } else {
        (summaryAndTransactions as any).cashierTransactions = { ...base, pageItems: merged };
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

const LOAN_REVERSAL_HINT =
  "Disbursement and repayment till movements must be reversed from the loan in Fineract / Loan Matrix (undo loan transaction, undo disbursal, etc.). This endpoint only returns **allocated** cash from the cashier back to the teller.";

/**
 * POST /api/tellers/[id]/cashiers/[cashierId]/transactions
 * Only **allocation** return: Fineract settle moves cash from cashier back to the teller.
 * Repayment and disbursement are not reversed here — use loan-side reversal.
 *
 * Body: { command: "reverseAllocation", amount, currencyCode, transactionDate?, notes? }
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

    if (command !== "reverseAllocation") {
      return NextResponse.json(
        {
          error: "Unsupported command",
          details: `Use command: "reverseAllocation" with amount, currencyCode, optional transactionDate (yyyy-MM-dd), notes. ${LOAN_REVERSAL_HINT}`,
        },
        { status: 400 }
      );
    }

    const sourceType = String(body.sourceTransactionType ?? "").toLowerCase();
    if (
      sourceType.includes("repayment") ||
      sourceType.includes("disbursement") ||
      sourceType.includes("disburs")
    ) {
      return NextResponse.json(
        {
          error: "Repayment and disbursement must be reversed from the loan",
          details: LOAN_REVERSAL_HINT,
        },
        { status: 400 }
      );
    }

    if (body.fineractLoanId != null) {
      return NextResponse.json(
        {
          error: "Do not send fineractLoanId for allocation return",
          details:
            "This operation is for vault→cashier allocation only. Loan-linked reversals belong on the loan transaction APIs.",
        },
        { status: 400 }
      );
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

    let activeSession = await prisma.cashierSession.findFirst({
      where: {
        tellerId: teller.id,
        cashierId: cashier.id,
        tenantId: tenant.id,
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
              tenantId: tenant.id,
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
        console.error("Error syncing Fineract session for reversal:", e);
      }
    }

    if (!activeSession) {
      const closedSession = await prisma.cashierSession.findFirst({
        where: {
          tellerId: teller.id,
          cashierId: cashier.id,
          tenantId: tenant.id,
          sessionStatus: "CLOSED",
        },
        orderBy: { sessionEndTime: "desc" },
      });
      if (!closedSession) {
        return NextResponse.json(
          {
            error: "Session required",
            details:
              "Cashier must have an active session (or a recent closed session) before returning allocation to the teller.",
          },
          { status: 400 }
        );
      }
    }

    const transactionDate =
      typeof body.transactionDate === "string" && body.transactionDate.length >= 8
        ? body.transactionDate
        : new Date().toISOString().split("T")[0];

    const notes = typeof body.notes === "string" ? body.notes : undefined;

    const result = await returnAllocationFromCashierToTeller({
      fineractTellerId: teller.fineractTellerId,
      fineractCashierId,
      amount,
      currencyCode,
      transactionDate,
      notes,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Fineract settle failed" },
        { status: 502 }
      );
    }

    const settlementNotes =
      notes?.trim() || "Allocation reversed — funds returned to teller";

    const settlement = await prisma.cashAllocation.create({
      data: {
        tenantId: tenant.id,
        tellerId: teller.id,
        cashierId: cashier.id,
        fineractAllocationId: result.fineractSettlementId ?? undefined,
        amount: -Math.abs(amount),
        currency: String(currencyCode).toUpperCase() === "ZMK" ? "ZMW" : currencyCode,
        allocatedBy: session.user.id,
        notes: settlementNotes,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      command: "reverseAllocation",
      transaction: settlement,
      fineractSettlementId: result.fineractSettlementId,
    });
  } catch (error) {
    console.error("Error posting allocation return to teller:", error);
    return NextResponse.json(
      {
        error: "Failed to post reversal",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
