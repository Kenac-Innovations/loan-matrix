import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { getOrgDefaultCurrencyCode } from "@/lib/currency-utils";
import { fetchFineractAPI } from "@/lib/api";

/**
 * POST /api/tellers/[id]/allocate
 * Allocate cash to a teller from the parent bank's available balance
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const { id: tellerId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, currency, notes, skipBankCheck } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 },
      );
    }

    // Try to find teller by database ID first
    let teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
      include: { bank: true },
    });

    // If not found, try by Fineract teller ID (the ID might be a number)
    if (!teller && !isNaN(Number(tellerId))) {
      teller = await prisma.teller.findFirst({
        where: { fineractTellerId: Number(tellerId), tenantId: tenant.id },
        include: { bank: true },
      });
    }

    if (!teller) {
      console.error("Teller not found for ID:", tellerId, "tenant:", tenant.id);
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    const orgCurrency = await getOrgDefaultCurrencyCode();
    const requestedAmount = parseFloat(amount);
    const allocationCurrency = currency || orgCurrency;

    // If teller is linked to a bank, check bank's available balance
    if (teller.bankId && !skipBankCheck) {
      const bank = teller.bank!;

      const bankWithBalances = await prisma.bank.findFirst({
        where: {
          id: teller.bankId,
          tenantId: tenant.id,
        },
        include: {
          allocations: {
            where: { status: "ACTIVE" },
          },
          tellers: {
            where: { isActive: true },
            include: {
              cashAllocations: {
                where: { status: "ACTIVE", cashierId: null },
              },
            },
          },
        },
      });

      if (!bankWithBalances) {
        return NextResponse.json({ error: "Bank not found" }, { status: 404 });
      }

      // Match the bank details page logic exactly so allocation validation
      // uses the same available balance the user sees on the bank screen.
      const isFromBank = (alloc: {
        notes?: string | null;
        allocatedBy?: string | null;
      }) => {
        const n = (alloc.notes ?? "").toLowerCase();
        if (n.includes("opening balance") || alloc.allocatedBy === "SYSTEM-IMPORT") return false;
        if (alloc.allocatedBy === "SYSTEM-REVERSAL") return false;
        if (n.includes("return from") || n.includes("session close") || n.includes("returned to vault")) return false;
        return true;
      };

      const allocatedToTellers = bankWithBalances.tellers.reduce((sum, bankTeller) => {
        const bankAllocationsOnly = bankTeller.cashAllocations
          .filter(isFromBank)
          .reduce((allocSum, alloc) => allocSum + alloc.amount, 0);
        return sum + bankAllocationsOnly;
      }, 0);

      // Use Fineract GL balance when available (consistent with UI display),
      // fall back to local BankAllocation records otherwise.
      let totalAllocated = 0;
      let balanceSource = "local";

      if (bank.glAccountId) {
        try {
          const journalData = await fetchFineractAPI(
            `/journalentries?glAccountId=${bank.glAccountId}&limit=500&orderBy=id&sortOrder=DESC`,
          );

          if (journalData?.pageItems && journalData.pageItems.length > 0) {
            for (const entry of journalData.pageItems) {
              if (entry.entryType?.value === "DEBIT") {
                totalAllocated += entry.amount || 0;
              } else if (entry.entryType?.value === "CREDIT") {
                totalAllocated -= entry.amount || 0;
              }
            }
            balanceSource = "fineract_gl";
          }
        } catch (error) {
          console.error(
            "Failed to fetch GL balance from Fineract, falling back to local:",
            error,
          );
        }
      }

      if (balanceSource === "local") {
        totalAllocated = bankWithBalances.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
      }

      const bankAvailableBalance = totalAllocated - allocatedToTellers;

      if (requestedAmount > bankAvailableBalance) {
        return NextResponse.json(
          {
            error: "Insufficient bank balance",
            details: `Bank available balance: ${bankAvailableBalance.toFixed(
              2,
            )} ${allocationCurrency}. Requested: ${requestedAmount.toFixed(
              2,
            )} ${allocationCurrency}. Please allocate more funds to the bank first.`,
            bankBalance: {
              totalFunds: totalAllocated,
              allocatedToTellers,
              availableBalance: bankAvailableBalance,
              source: balanceSource,
            },
          },
          { status: 400 },
        );
      }
    }

    // If the teller has a GL account, also post a journal entry in Fineract so the
    // GL-sourced vault balance reflects this allocation (debit teller GL, credit bank GL).
    // Falls back gracefully when the bank does not have a GL configured.
    let journalTransactionId: string | null = null;
    if (teller.glAccountId && teller.bankId && teller.bank?.glAccountId) {
      try {
        const today = new Date();
        const monthNames = [
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
        const fineractDate = `${today
          .getDate()
          .toString()
          .padStart(2, "0")} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;

        const journalResult = await fetchFineractAPI("/journalentries", {
          method: "POST",
          body: JSON.stringify({
            officeId: teller.officeId,
            transactionDate: fineractDate,
            currencyCode: allocationCurrency,
            debits: [
              { glAccountId: teller.glAccountId, amount: requestedAmount },
            ],
            credits: [
              { glAccountId: teller.bank.glAccountId, amount: requestedAmount },
            ],
            comments:
              `Allocate to teller ${teller.name} from bank ${teller.bank.name}${
                notes ? ` - ${notes}` : ""
              }`.trim(),
            referenceNumber: `TELLER-ALLOC-${teller.id}-${Date.now()}`,
            locale: "en",
            dateFormat: "dd MMMM yyyy",
          }),
        });
        journalTransactionId =
          journalResult?.transactionId || journalResult?.resourceId || null;
      } catch (err) {
        console.error(
          "Failed to post Fineract journal entry for teller allocation; the local CashAllocation record will still be created, but GL balance will not reflect this:",
          err
        );
      }
    }

    // Create allocation record in database for audit/fallback. When the teller has a
    // GL account, the GL is the source of truth; this row stays as a local ledger trail.
    const allocation = await prisma.cashAllocation.create({
      data: {
        tenantId: tenant.id,
        tellerId: teller.id, // Use the database ID from the found teller
        cashierId: null, // null = teller vault allocation
        fineractAllocationId: null, // No Fineract teller-allocation (we post a journal entry instead)
        amount: requestedAmount,
        currency: allocationCurrency,
        allocatedBy: session.user.id,
        notes: [
          notes,
          teller.bankId ? `[From Bank: ${teller.bank?.name || teller.bankId}]` : null,
          journalTransactionId ? `[GL JE: ${journalTransactionId}]` : null,
        ]
          .filter(Boolean)
          .join(" ")
          .trim(),
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ ...allocation, journalTransactionId });
  } catch (error) {
    console.error("Error allocating cash:", error);
    return NextResponse.json(
      {
        error: "Failed to allocate cash",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
