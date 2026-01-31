import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

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

    // Get all cash allocations for this teller's vault (cashierId = null)
    const allocations = await prisma.cashAllocation.findMany({
      where: {
        tellerId: teller.id,
        tenantId: tenant.id,
        cashierId: null, // Only vault allocations
      },
      orderBy: { allocatedDate: "asc" }, // Chronological order
    });

    // Calculate running balance
    let runningBalance = 0;
    const transactionsWithBalance = allocations.map((alloc) => {
      runningBalance += alloc.amount;
      
      // Determine transaction type based on notes and allocatedBy
      let transactionType = "ALLOCATION";
      if (alloc.notes?.toLowerCase().includes("opening balance") || alloc.allocatedBy === "SYSTEM-IMPORT") {
        transactionType = "OPENING_BALANCE";
      } else if (alloc.notes?.toLowerCase().includes("settlement") || alloc.notes?.toLowerCase().includes("returned")) {
        transactionType = "SETTLEMENT_RETURN";
      } else if (alloc.notes?.toLowerCase().includes("variance")) {
        transactionType = "VARIANCE_ADJUSTMENT";
      }

      return {
        id: alloc.id,
        date: alloc.allocatedDate,
        amount: alloc.amount,
        currency: alloc.currency,
        type: transactionType,
        notes: alloc.notes,
        allocatedBy: alloc.allocatedBy,
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

    const varianceAdjustments = transactionsWithBalance
      .filter((t) => t.type === "VARIANCE_ADJUSTMENT")
      .reduce((sum, t) => sum + t.amount, 0);

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
        varianceAdjustments,
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
