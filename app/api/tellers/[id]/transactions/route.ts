import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

function getVaultTransactionType(notes: string | null | undefined) {
  const narration = (notes ?? "").toLowerCase();

  if (narration.includes("variance")) {
    return "VARIANCE_ADJUSTMENT";
  }

  if (
    narration.includes("settlement") ||
    narration.includes("returned") ||
    narration.includes("return from") ||
    narration.includes("returned to vault") ||
    narration.includes("session close") ||
    narration.includes("session closed")
  ) {
    return "SETTLEMENT_RETURN";
  }

  if (narration.includes("opening balance")) {
    return "OPENING_BALANCE";
  }

  return "ALLOCATION";
}

function isCashierReturnToVault(notes: string | null | undefined) {
  const narration = (notes ?? "").toLowerCase();
  return (
    narration.includes("return to vault") ||
    narration.includes("returned to vault") ||
    narration.includes("return to safe") ||
    narration.includes("returned to safe") ||
    narration.includes("return from") ||
    narration.includes("settlement")
  );
}

function isTellerToCashierAllocation(allocation: {
  notes: string | null;
  cashierId: string | null;
  amount: number;
  fineractAllocationId: number | null;
}) {
  if (!allocation.cashierId || allocation.amount <= 0) {
    return false;
  }

  const narration = (allocation.notes ?? "").trim().toLowerCase();

  if (narration.length > 0) {
    return narration.includes("float");
  }

  return allocation.fineractAllocationId != null;
}

function shouldIncludeInVaultHistory(allocation: {
  notes: string | null;
  cashierId: string | null;
  amount: number;
  fineractAllocationId: number | null;
}) {
  const narration = (allocation.notes ?? "").toLowerCase();

  if (
    narration.includes("loan disbursement") ||
    narration.includes("disbursement (cash out)")
  ) {
    return false;
  }

  if (!allocation.cashierId) {
    return true;
  }

  if (narration.includes("loan repayment")) {
    return false;
  }

  if (
    narration.includes("loan disbursement") ||
    narration.includes("credit balance refund")
  ) {
    return false;
  }

  if (isTellerToCashierAllocation(allocation)) {
    return true;
  }

  if (narration.includes("session close settlement")) {
    return false;
  }

  return isCashierReturnToVault(allocation.notes);
}

/**
 * GET /api/tellers/[id]/transactions
 * Get all cash allocations (transactions) for a teller vault
 * This includes opening balances, allocations from bank, and settlements
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: tellerId } = params;
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Try to find teller by database ID first
    let teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

    // If not found, try by Fineract teller ID
    if (!teller && !Number.isNaN(Number(tellerId))) {
      teller = await prisma.teller.findFirst({
        where: { fineractTellerId: Number(tellerId), tenantId: tenant.id },
      });
    }

    if (!teller) {
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    // Fetch Fineract users to map user IDs to names
    let userMap: Record<string, string> = {};
    try {
      const fineractService = await getFineractServiceWithSession();
      const users = await fineractService.getUsers();
      users.forEach((user: any) => {
        userMap[user.id.toString()] = user.username || user.displayName || `User ${user.id}`;
      });
    } catch (err) {
      console.error("Error fetching Fineract users:", err);
      // Continue without user names - will fall back to IDs
    }

    // Get all teller-linked allocations so the vault history can include:
    // - direct vault movements (cashierId = null)
    // - cash allocated from the vault to cashier drawers (cashierId != null, shown as outflows)
    const allTellerAllocations = await prisma.cashAllocation.findMany({
      where: {
        tellerId: teller.id,
        tenantId: tenant.id,
      },
      orderBy: { allocatedDate: "asc" }, // Chronological order
    });

    const allocations = allTellerAllocations.filter(shouldIncludeInVaultHistory);

    // Calculate running balance
    let runningBalance = 0;
    const transactionsWithBalance = allocations.map((alloc) => {
      let amount = alloc.amount;
      let transactionType = getVaultTransactionType(alloc.notes);

      if (alloc.cashierId) {
        if (isTellerToCashierAllocation(alloc)) {
          amount = -Math.abs(alloc.amount);
          transactionType = "CASHIER_ALLOCATION";
        } else if (isCashierReturnToVault(alloc.notes)) {
          amount = Math.abs(alloc.amount);
          transactionType = "SETTLEMENT_RETURN";
        }
      }

      runningBalance += amount;

      // Get user name from map, or use special labels for system entries
      let allocatedByName = alloc.allocatedBy;
      if (alloc.allocatedBy === "SYSTEM-IMPORT") {
        allocatedByName = "System Import";
      } else if (userMap[alloc.allocatedBy]) {
        allocatedByName = userMap[alloc.allocatedBy];
      }

      return {
        id: alloc.id,
        date: alloc.allocatedDate,
        amount,
        currency: alloc.currency,
        type: transactionType,
        notes: alloc.notes,
        allocatedBy: alloc.allocatedBy,
        allocatedByName,
        status: alloc.status,
        runningBalance,
      };
    });

    // Summary
    const openingBalance = transactionsWithBalance
      .filter((t) => t.type === "OPENING_BALANCE")
      .reduce((sum, t) => sum + t.amount, 0);

    const allocationsFromBank = transactionsWithBalance
      .filter((t) => t.type === "ALLOCATION")
      .reduce((sum, t) => sum + t.amount, 0);

    const settlementReturns = transactionsWithBalance
      .filter((t) => t.type === "SETTLEMENT_RETURN")
      .reduce((sum, t) => sum + t.amount, 0);

    const tellerToCashierAllocations = transactionsWithBalance
      .filter((t) => t.type === "CASHIER_ALLOCATION")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return NextResponse.json({
      teller: {
        id: teller.id,
        name: teller.name,
        fineractTellerId: teller.fineractTellerId,
      },
      summary: {
        openingBalance,
        allocationsFromBank,
        settlementReturns,
        tellerToCashierAllocations,
        currentBalance: runningBalance,
        transactionCount: transactionsWithBalance.length,
      },
      transactions: transactionsWithBalance,
    });
  } catch (error) {
    console.error("Error fetching teller transactions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch teller transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
