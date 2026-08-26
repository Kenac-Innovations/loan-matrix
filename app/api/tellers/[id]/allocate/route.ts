import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { getOrgDefaultCurrencyCode } from "@/lib/currency-utils";
import { fetchFineractAPI } from "@/lib/api";
import { getGlAccountBalance } from "@/lib/gl-balance";

/**
 * POST /api/tellers/[id]/allocate
 * Allocate cash to a teller from the linked bank GL or a selected source GL.
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
    const { amount, currency, notes, skipBankCheck, sourceGlAccountId } = body;

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

    const hasSourceGlOverride =
      sourceGlAccountId !== undefined &&
      sourceGlAccountId !== null &&
      String(sourceGlAccountId).trim() !== "";
    const parsedSourceGlAccountId = hasSourceGlOverride
      ? Number(sourceGlAccountId)
      : null;

    if (
      hasSourceGlOverride &&
      (parsedSourceGlAccountId === null ||
        !Number.isInteger(parsedSourceGlAccountId) ||
        parsedSourceGlAccountId <= 0)
    ) {
      return NextResponse.json(
        { error: "A valid credit GL account is required" },
        { status: 400 },
      );
    }

    const effectiveSourceGlAccountId =
      parsedSourceGlAccountId ?? teller.bank?.glAccountId ?? null;
    const isSourceGlOverride =
      hasSourceGlOverride &&
      parsedSourceGlAccountId !== teller.bank?.glAccountId;

    if (!effectiveSourceGlAccountId) {
      return NextResponse.json(
        { error: "Select a credit GL account to fund this teller allocation" },
        { status: 400 },
      );
    }

    if (!teller.glAccountId) {
      return NextResponse.json(
        { error: "Teller has no destination GL account configured" },
        { status: 400 },
      );
    }

    if (effectiveSourceGlAccountId === teller.glAccountId) {
      return NextResponse.json(
        { error: "The credit GL account must be different from the teller GL account" },
        { status: 400 },
      );
    }

    let sourceGlAccountName = teller.bank?.glAccountName ?? null;
    let sourceGlAccountCode = teller.bank?.glAccountCode ?? null;

    // Resolve a browser-supplied override in Fineract. The client does not
    // control the source GL name, code, or eligibility for manual posting.
    if (isSourceGlOverride) {
      try {
        const sourceGlAccount = await fetchFineractAPI(
          "/glaccounts/" + effectiveSourceGlAccountId,
        );
        const usageId =
          typeof sourceGlAccount?.usage === "object"
            ? Number(sourceGlAccount.usage?.id)
            : Number(sourceGlAccount?.usage);

        if (
          Number(sourceGlAccount?.id) !== effectiveSourceGlAccountId ||
          sourceGlAccount?.disabled === true ||
          sourceGlAccount?.manualEntriesAllowed !== true ||
          usageId !== 1
        ) {
          return NextResponse.json(
            {
              error:
                "The selected credit GL must be an active detail account that allows manual entries",
            },
            { status: 400 },
          );
        }

        sourceGlAccountName = sourceGlAccount.name ?? null;
        sourceGlAccountCode = sourceGlAccount.glCode ?? null;
      } catch (error) {
        console.error("Unable to validate selected source GL account:", error);
        return NextResponse.json(
          { error: "Unable to validate the selected credit GL account" },
          { status: 502 },
        );
      }
    }

    // The existing bank balance calculation applies only to the default source.
    // A selected override is checked against its own Fineract GL below.
    if (!isSourceGlOverride && teller.bankId && !skipBankCheck) {
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

    if (isSourceGlOverride) {
      const sourceGlBalance = await getGlAccountBalance(effectiveSourceGlAccountId);
      if (
        sourceGlBalance.source !== "fineract_calculated" &&
        sourceGlBalance.source !== "fineract_empty"
      ) {
        return NextResponse.json(
          {
            error: "Unable to verify the selected credit GL balance",
            details: sourceGlBalance.error || "Fineract GL balance is unavailable",
          },
          { status: 502 },
        );
      }

      if (requestedAmount > sourceGlBalance.balance) {
        return NextResponse.json(
          {
            error: "Insufficient balance in the selected credit GL account",
            details:
              "Available balance: " +
              sourceGlBalance.balance.toFixed(2) +
              " " +
              (sourceGlBalance.currency || allocationCurrency) +
              ". Requested: " +
              requestedAmount.toFixed(2) +
              " " +
              allocationCurrency +
              ".",
          },
          { status: 400 },
        );
      }
    }

    // Debit the teller's vault GL and credit the selected funding GL. A local
    // allocation is only written after Fineract confirms the journal entry.
    let journalTransactionId: string | null = null;
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
              { glAccountId: effectiveSourceGlAccountId, amount: requestedAmount },
            ],
            comments: [
              "Allocate to teller " + teller.name,
              "from " +
                (sourceGlAccountCode || effectiveSourceGlAccountId) +
                (sourceGlAccountName ? " (" + sourceGlAccountName + ")" : ""),
              notes || null,
            ]
              .filter(Boolean)
              .join(" - "),
            referenceNumber: `TELLER-ALLOC-${teller.id}-${Date.now()}`,
            locale: "en",
            dateFormat: "dd MMMM yyyy",
          }),
        });
        journalTransactionId =
          journalResult?.transactionId || journalResult?.resourceId || null;
      if (!journalTransactionId) {
        return NextResponse.json(
          { error: "Fineract did not return a journal entry ID" },
          { status: 502 },
        );
      }
    } catch (error) {
      console.error("Failed to post Fineract journal entry for teller allocation:", error);
      return NextResponse.json(
        { error: "Failed to post the teller allocation journal entry in Fineract" },
        { status: 502 },
      );
    }

    // Create allocation record in database for audit/fallback. When the teller has a
    // GL account, the GL is the source of truth; this row stays as a local ledger trail.
    const allocation = await prisma.cashAllocation.create({
      data: {
        tenantId: tenant.id,
        tellerId: teller.id, // Use the database ID from the found teller
        cashierId: null, // null = teller vault allocation
        fineractAllocationId: null, // No Fineract teller-allocation (we post a journal entry instead)
        sourceGlAccountId: effectiveSourceGlAccountId,
        sourceGlAccountName,
        sourceGlAccountCode,
        amount: requestedAmount,
        currency: allocationCurrency,
        allocatedBy: session.user.id,
        notes: [
          notes,
          "[Source GL: " +
            (sourceGlAccountCode || effectiveSourceGlAccountId) +
            (sourceGlAccountName ? " — " + sourceGlAccountName : "") +
            "]",
          journalTransactionId ? "[GL JE: " + journalTransactionId + "]" : null,
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
