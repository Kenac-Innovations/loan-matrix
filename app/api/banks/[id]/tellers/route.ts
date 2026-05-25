import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { getOrgDefaultCurrencyCode } from "@/lib/currency-utils";
import { getTellerVaultDisplay } from "@/lib/gl-balance";
import {
  canAccessOffice,
  getOfficeVisibilityScope,
} from "@/lib/office-access";

/**
 * GET /api/banks/[id]/tellers
 * Get all tellers for a specific bank
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: bankId } = params;
    const [tenant, orgCurrency] = await Promise.all([
      getTenantFromHeaders(),
      getOrgDefaultCurrencyCode(),
    ]);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Find the bank
    const bank = await prisma.bank.findFirst({
      where: { id: bankId, tenantId: tenant.id },
    });

    if (!bank) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }

    // Branch-scope check: a non-admin user cannot list tellers belonging to
    // a bank from another branch.
    const scope = await getOfficeVisibilityScope();
    if (!canAccessOffice(scope, { officeId: bank.officeId })) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }

    // Get tellers with their balances
    const tellers = await prisma.teller.findMany({
      where: {
        bankId,
        tenantId: tenant.id,
        isActive: true,
      },
      include: {
        cashAllocations: {
          where: { status: "ACTIVE", cashierId: null },
        },
        cashiers: {
          where: { isActive: true },
        },
        _count: {
          select: {
            settlements: true,
            cashiers: true,
          },
        },
      },
    });

    // Balances come *only* from the Fineract GL account. When no GL is
    // configured or Fineract is unreachable, vaultBalance/availableBalance
    // are null and the UI renders "—" / NaN.
    const tellersWithBalances = await Promise.all(
      tellers.map(async (teller) => {
        const vaultDisplay = await getTellerVaultDisplay(teller);
        const currency = vaultDisplay.currency || orgCurrency;

        return {
          id: teller.id,
          name: teller.name,
          description: teller.description,
          fineractTellerId: teller.fineractTellerId,
          officeId: teller.officeId,
          officeName: teller.officeName,
          status: teller.status,
          startDate: teller.startDate,
          endDate: teller.endDate,
          glAccountId: teller.glAccountId,
          glAccountName: teller.glAccountName,
          glAccountCode: teller.glAccountCode,
          vaultBalance: vaultDisplay.vaultBalance,
          vaultBalanceSource: vaultDisplay.vaultBalanceSource,
          availableBalance: vaultDisplay.availableBalance,
          currency,
          activeCashiers: teller.cashiers.length,
          settlementCount: teller._count.settlements,
        };
      })
    );

    return NextResponse.json(tellersWithBalances);
  } catch (error) {
    console.error("Error fetching bank tellers:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch tellers",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/banks/[id]/tellers
 * Assign an existing teller to this bank
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: bankId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tellerId } = body;

    if (!tellerId) {
      return NextResponse.json(
        { error: "tellerId is required" },
        { status: 400 }
      );
    }

    // Find the bank
    const bank = await prisma.bank.findFirst({
      where: { id: bankId, tenantId: tenant.id },
    });

    if (!bank) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }

    // Find the teller
    const teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

    if (!teller) {
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    // Assign teller to bank
    const updatedTeller = await prisma.teller.update({
      where: { id: tellerId },
      data: { bankId },
    });

    return NextResponse.json({
      success: true,
      teller: updatedTeller,
    });
  } catch (error) {
    console.error("Error assigning teller to bank:", error);
    return NextResponse.json(
      {
        error: "Failed to assign teller",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/banks/[id]/tellers
 * Remove a teller from this bank (unassign, not delete)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: bankId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tellerId = searchParams.get("tellerId");

    if (!tellerId) {
      return NextResponse.json(
        { error: "tellerId query parameter is required" },
        { status: 400 }
      );
    }

    // Find the teller and verify it belongs to this bank
    const teller = await prisma.teller.findFirst({
      where: {
        id: tellerId,
        bankId,
        tenantId: tenant.id,
      },
    });

    if (!teller) {
      return NextResponse.json(
        { error: "Teller not found in this bank" },
        { status: 404 }
      );
    }

    // Unassign teller from bank
    const updatedTeller = await prisma.teller.update({
      where: { id: tellerId },
      data: { bankId: null },
    });

    return NextResponse.json({
      success: true,
      teller: updatedTeller,
    });
  } catch (error) {
    console.error("Error removing teller from bank:", error);
    return NextResponse.json(
      {
        error: "Failed to remove teller",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

