import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";

/**
 * POST /api/tellers/[id]/cashiers/[cashierId]/settle
 * Settle cash for a cashier
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
    const { closingBalance, notes } = body;

    if (closingBalance === undefined || closingBalance === null) {
      return NextResponse.json(
        { error: "closingBalance is required" },
        { status: 400 }
      );
    }

    // Get teller and cashier
    const teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

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

    // Get the most recent closed session - use its recorded values instead of recalculating
    const closedSession = await prisma.cashierSession.findFirst({
      where: {
        tellerId,
        cashierId: cashier.id,
        tenantId: tenant.id,
        sessionStatus: "CLOSED",
      },
      orderBy: { sessionEndTime: "desc" },
    });

    if (!closedSession) {
      return NextResponse.json(
        { error: "No closed session found. Please close the session first." },
        { status: 404 }
      );
    }

    // Use values from the closed session instead of recalculating
    const openingBalance =
      closedSession.allocatedBalance || closedSession.openingFloat || 0;
    const cashIn = closedSession.cashIn || 0;
    const cashOut = closedSession.cashOut || 0;
    const expectedBalance =
      closedSession.expectedBalance || openingBalance + cashIn - cashOut;
    // Use countedCashAmount or closingBalance from session, or the provided closingBalance
    const actualBalance = closedSession.countedCashAmount
      ? parseFloat(closedSession.countedCashAmount.toString())
      : closedSession.closingBalance
      ? parseFloat(closedSession.closingBalance.toString())
      : parseFloat(closingBalance);
    const difference =
      closedSession.difference !== null
        ? closedSession.difference
        : actualBalance - expectedBalance;

    // Settle in Fineract
    let fineractSettlementId: number | undefined;
    if (teller.fineractTellerId && cashier.fineractCashierId) {
      try {
        const fineractService = await getFineractServiceWithSession();
        const result = await fineractService.settleCashForCashier(
          teller.fineractTellerId,
          cashier.fineractCashierId,
          {
            closingBalance: actualBalance,
            notes,
          }
        );
        fineractSettlementId = result.resourceId || result.id;
      } catch (error) {
        console.error("Error settling in Fineract:", error);
        // Continue with database settlement even if Fineract fails
      }
    }

    // closedSession is already fetched above

    // Create settlement record - this recognizes and persists the variance for reconciliation
    // Use all values from the closed session
    const settlement = await prisma.cashSettlement.create({
      data: {
        tenantId: tenant.id,
        tellerId,
        cashierId: cashier.id,
        fineractSettlementId,
        settlementDate: closedSession.sessionEndTime || new Date(), // Use session end time
        openingBalance,
        closingBalance: actualBalance,
        cashIn,
        cashOut,
        expectedBalance,
        actualBalance,
        difference,
        notes:
          notes ||
          `Settlement recognizing variance: ${
            difference > 0 ? "Surplus" : "Shortage"
          } of ${Math.abs(difference).toFixed(2)}. ${
            closedSession.comments || ""
          }`,
        status: "PENDING", // Pending reconciliation - variance is recognized but not yet reconciled
        settledBy: session.user.id,
      },
    });

    // Mark variance allocations as recognized (but keep them active for tracking)
    // The variance remains in cashier's balance until reconciliation
    if (Math.abs(difference) > 0.01) {
      // Find variance allocations (those with notes containing "Variance")
      const varianceAllocations = await prisma.cashAllocation.findMany({
        where: {
          tellerId,
          cashierId: cashier.id,
          tenantId: tenant.id,
          notes: { contains: "Variance" },
          status: "ACTIVE",
        },
        orderBy: { allocatedDate: "desc" },
        take: 1, // Get most recent variance
      });

      if (varianceAllocations.length > 0) {
        // Update the variance allocation note to indicate it's been settled
        await prisma.cashAllocation.update({
          where: { id: varianceAllocations[0].id },
          data: {
            notes: `${varianceAllocations[0].notes} [Settled on ${
              new Date().toISOString().split("T")[0]
            }]`,
          },
        });
      }
    }

    // Note: Settlement doesn't close the cashier permanently
    // It just records the end-of-day reconciliation and recognizes the variance
    // The variance remains in cashier's balance pending reconciliation

    return NextResponse.json(settlement);
  } catch (error) {
    console.error("Error settling cash:", error);
    return NextResponse.json(
      {
        error: "Failed to settle cash",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
