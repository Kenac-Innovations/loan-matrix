import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";

/**
 * POST /api/tellers/[id]/cashiers/[cashierId]/reconcile
 * Reconcile cashier end-of-day: return cash to vault, reverse allocations
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; cashierId: string }> }
) {
  try {
    const params = await context.params;
    const { id: tellerIdParam, cashierId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { settlementId, returnedAmount, notes } = body;

    if (!settlementId) {
      return NextResponse.json(
        { error: "settlementId is required" },
        { status: 400 }
      );
    }

    if (returnedAmount === undefined || returnedAmount === null) {
      return NextResponse.json(
        { error: "returnedAmount is required" },
        { status: 400 }
      );
    }

    // Try to find teller by database ID first, then by Fineract ID
    let teller = await prisma.teller.findFirst({
      where: { id: tellerIdParam, tenantId: tenant.id },
    });

    if (!teller) {
      const fineractTellerId = parseInt(tellerIdParam);
      if (!isNaN(fineractTellerId)) {
        teller = await prisma.teller.findFirst({
          where: { fineractTellerId, tenantId: tenant.id },
        });
      }
    }

    const tellerId = teller?.id || tellerIdParam;

    // Try to find cashier by database ID first, then by Fineract ID
    let cashier = await prisma.cashier.findFirst({
      where: { id: cashierId, tellerId, tenantId: tenant.id },
    });

    // If not found by database ID, try Fineract ID
    if (!cashier) {
      const fineractCashierId = parseInt(cashierId);
      if (!isNaN(fineractCashierId)) {
        cashier = await prisma.cashier.findFirst({
          where: {
            fineractCashierId,
            tellerId,
            tenantId: tenant.id,
          },
        });
      }
    }

    if (!teller || !cashier) {
      return NextResponse.json(
        { error: "Teller or cashier not found" },
        { status: 404 }
      );
    }

    // Get the settlement
    const settlement = await prisma.cashSettlement.findFirst({
      where: {
        id: settlementId,
        tellerId,
        cashierId: cashier.id,
        tenantId: tenant.id,
      },
    });

    if (!settlement) {
      return NextResponse.json(
        { error: "Settlement not found" },
        { status: 404 }
      );
    }

    if (settlement.status === "RECONCILED") {
      return NextResponse.json(
        { error: "Settlement already reconciled" },
        { status: 400 }
      );
    }

    // Get all ACTIVE allocations for this cashier (excluding REVERSED)
    const activeAllocations = await prisma.cashAllocation.findMany({
      where: {
        tellerId,
        cashierId: cashier.id,
        tenantId: tenant.id,
        status: "ACTIVE",
      },
      orderBy: { allocatedDate: "desc" },
    });

    const totalAllocated = activeAllocations.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    // Calculate variance
    // returnedAmount should equal closingBalance from session
    // variance = returnedAmount - (allocated + cashIn - cashOut)
    const expectedReturn =
      settlement.openingBalance + settlement.cashIn - settlement.cashOut;
    const variance = parseFloat(returnedAmount) - expectedReturn;

    // Get currency from first allocation or default
    const currency = activeAllocations[0]?.currency || "USD";

    // Calculate balances BEFORE reconciliation to show current state
    // Get current vault balance (before adding returned cash)
    const vaultAllocationsBefore = await prisma.cashAllocation.findMany({
      where: {
        tellerId,
        cashierId: null, // Vault allocations
        tenantId: tenant.id,
        status: "ACTIVE",
      },
    });

    const vaultBalanceBefore = vaultAllocationsBefore.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    // Get allocations to cashiers BEFORE reversing (to calculate available balance)
    const allocatedToCashiersBefore = await prisma.cashAllocation.findMany({
      where: {
        tellerId,
        cashierId: { not: null },
        tenantId: tenant.id,
        status: "ACTIVE",
        // Exclude variance allocations
        notes: { not: { contains: "Variance" } },
      },
    });

    const totalAllocatedToCashiersBefore = allocatedToCashiersBefore.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    // Available balance BEFORE reconciliation = vault - allocated to cashiers
    const availableBalanceBefore =
      vaultBalanceBefore - totalAllocatedToCashiersBefore;

    // Step 1: Reverse all cashier allocations
    const reversedAllocations = await Promise.all(
      activeAllocations.map((alloc) =>
        prisma.cashAllocation.update({
          where: { id: alloc.id },
          data: { status: "REVERSED" },
        })
      )
    );

    console.log(
      `Reversed ${reversedAllocations.length} allocations for cashier ${cashier.id}`
    );

    // Step 2: Create teller vault allocation for returned cash
    const vaultAllocation = await prisma.cashAllocation.create({
      data: {
        tenantId: tenant.id,
        tellerId,
        cashierId: null, // null = teller vault allocation
        fineractAllocationId: null,
        amount: parseFloat(returnedAmount),
        currency,
        allocatedBy: session.user.id,
        notes: `Returned from cashier ${
          cashier.staffName
        } - Settlement ${settlementId} - Session closed on ${
          settlement.settlementDate.toISOString().split("T")[0]
        }`,
        status: "ACTIVE",
      },
    });

    console.log(
      `Created vault allocation: ${vaultAllocation.amount} ${currency}`
    );

    // Step 3: Handle variance (if any) - Track separately, NOT in cashier balance
    // Variance is tracked in the settlement record, not as an allocation
    // This ensures cashier balance is 0 after reconciliation
    let varianceInfo = null;
    if (Math.abs(variance) > 0.01) {
      varianceInfo = {
        amount: variance,
        currency,
        type: variance > 0 ? "surplus" : "shortage",
      };
      console.log(
        `Variance tracked: ${variance} ${currency} (${
          variance > 0 ? "surplus" : "shortage"
        }) - Tracked in settlement, not in cashier balance`
      );
    }

    // Step 4: Update settlement status to RECONCILED
    // If there's a variance, ensure it's marked as unresolved so it appears in resolutions
    const updatedSettlement = await prisma.cashSettlement.update({
      where: { id: settlement.id },
      data: {
        status: "RECONCILED",
        reconciledAt: new Date(),
        reconciledBy: session.user.id,
        reconciliationNotes: notes || "",
        returnedAmount: parseFloat(returnedAmount),
        // If there's a variance, ensure varianceResolved is false so it appears in resolutions
        varianceResolved: Math.abs(variance) < 0.01 ? true : false,
      },
    });

    // Log if a resolution was created
    if (Math.abs(variance) > 0.01) {
      console.log(
        `Resolution created for settlement ${
          settlement.id
        }: Variance of ${variance} ${currency} (${
          variance > 0 ? "surplus" : "shortage"
        }) - Settlement marked as RECONCILED with unresolved variance`
      );
    }

    // Step 5: Verify cashier balance is now 0 (variance is tracked separately in settlement)
    const remainingAllocations = await prisma.cashAllocation.findMany({
      where: {
        tellerId,
        cashierId: cashier.id,
        tenantId: tenant.id,
        status: "ACTIVE",
        // Exclude variance allocations (those with notes containing "Variance")
        notes: { not: { contains: "Variance" } },
      },
    });

    const cashierBalance = remainingAllocations.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    // Calculate vault balance AFTER reconciliation (includes returned cash)
    // Should be: vaultBalanceBefore + returnedAmount
    const vaultAllocations = await prisma.cashAllocation.findMany({
      where: {
        tellerId,
        cashierId: null, // Vault allocations
        tenantId: tenant.id,
        status: "ACTIVE",
      },
    });

    const vaultBalance = vaultAllocations.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    // Verify: vault balance should equal vaultBalanceBefore + returnedAmount
    const expectedVaultBalance =
      vaultBalanceBefore + parseFloat(returnedAmount);
    if (Math.abs(vaultBalance - expectedVaultBalance) > 0.01) {
      console.warn(
        `Vault balance mismatch: Expected ${expectedVaultBalance}, Got ${vaultBalance}. ` +
          `Before: ${vaultBalanceBefore}, Returned: ${returnedAmount}`
      );
    }

    // Calculate allocated to cashiers AFTER reconciliation (excluding reversed)
    const allocatedToCashiers = await prisma.cashAllocation.findMany({
      where: {
        tellerId,
        cashierId: { not: null },
        tenantId: tenant.id,
        status: "ACTIVE",
        // Exclude variance allocations
        notes: { not: { contains: "Variance" } },
      },
    });

    const totalAllocatedToCashiers = allocatedToCashiers.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    // Available balance AFTER reconciliation = vault - allocated to cashiers
    const availableBalance = vaultBalance - totalAllocatedToCashiers;

    return NextResponse.json({
      success: true,
      settlement: updatedSettlement,
      reconciliation: {
        reversedAllocations: reversedAllocations.length,
        vaultAllocation: {
          id: vaultAllocation.id,
          amount: vaultAllocation.amount,
          currency: vaultAllocation.currency,
        },
        variance: varianceInfo
          ? {
              amount: varianceInfo.amount,
              currency: varianceInfo.currency,
              type: varianceInfo.type,
              note: "Variance tracked in settlement record, not in cashier balance",
            }
          : null,
        cashierBalance,
        vaultBalance,
        availableBalance,
        // Include before/after balances for reference
        before: {
          vaultBalance: vaultBalanceBefore,
          allocatedToCashiers: totalAllocatedToCashiersBefore,
          availableBalance: availableBalanceBefore,
        },
        after: {
          vaultBalance,
          allocatedToCashiers: totalAllocatedToCashiers,
          availableBalance,
        },
      },
    });
  } catch (error) {
    console.error("Error reconciling cash:", error);
    return NextResponse.json(
      {
        error: "Failed to reconcile cash",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
