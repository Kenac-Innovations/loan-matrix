import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { getOrgDefaultCurrencyCode } from "@/lib/currency-utils";

/**
 * POST /api/tellers/[id]/cashiers/[cashierId]/settlements/[settlementId]/resolve-variance
 * Resolve variance - creates vault allocation adjustment and marks variance as resolved
 */
export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ id: string; cashierId: string; settlementId: string }>;
  }
) {
  try {
    const params = await context.params;
    const { id: tellerIdParam, cashierId, settlementId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { resolutionNotes } = body;

    if (!resolutionNotes || resolutionNotes.trim().length === 0) {
      return NextResponse.json(
        { error: "Resolution notes are required to explain the variance" },
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
        status: "RECONCILED", // Only resolved settlements can have variance resolved
      },
    });

    if (!settlement) {
      return NextResponse.json(
        { error: "Settlement not found or not reconciled" },
        { status: 404 }
      );
    }

    if (settlement.varianceResolved) {
      return NextResponse.json(
        { error: "Variance already resolved" },
        { status: 400 }
      );
    }

    // Check if there's actually a variance
    if (Math.abs(settlement.difference) < 0.01) {
      return NextResponse.json(
        { error: "No variance to resolve" },
        { status: 400 }
      );
    }

    const variance = settlement.difference;
    const orgCurrency = await getOrgDefaultCurrencyCode();
    const currency = settlement.currency || orgCurrency;

    // Create vault allocation adjustment for the variance
    // Positive variance (surplus) = add to vault
    // Negative variance (shortage) = subtract from vault
    const vaultAllocation = await prisma.cashAllocation.create({
      data: {
        tenantId: tenant.id,
        tellerId,
        cashierId: null, // Vault allocation
        fineractAllocationId: null,
        amount: variance, // Can be positive or negative
        currency,
        allocatedBy: session.user.id,
        notes: `Variance resolution: ${
          variance > 0 ? "Surplus" : "Shortage"
        } of ${Math.abs(variance).toFixed(2)} ${currency} from settlement ${
          settlementId
        }. Resolution: ${resolutionNotes}`,
        status: "ACTIVE",
      },
    });

    console.log(
      `Variance resolved: ${variance} ${currency} - Vault allocation created: ${vaultAllocation.id}`
    );

    // Update settlement to mark variance as resolved
    const updatedSettlement = await prisma.cashSettlement.update({
      where: { id: settlement.id },
      data: {
        varianceResolved: true,
        varianceResolvedAt: new Date(),
        varianceResolvedBy: session.user.id,
        varianceResolutionNotes: resolutionNotes,
      },
    });

    // Calculate updated vault balance
    const vaultAllocations = await prisma.cashAllocation.findMany({
      where: {
        tellerId,
        cashierId: null,
        tenantId: tenant.id,
        status: "ACTIVE",
      },
    });

    const vaultBalance = vaultAllocations.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    return NextResponse.json({
      success: true,
      settlement: updatedSettlement,
      vaultAllocation: {
        id: vaultAllocation.id,
        amount: vaultAllocation.amount,
        currency: vaultAllocation.currency,
      },
      vaultBalance,
    });
  } catch (error) {
    console.error("Error resolving variance:", error);
    return NextResponse.json(
      {
        error: "Failed to resolve variance",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}



