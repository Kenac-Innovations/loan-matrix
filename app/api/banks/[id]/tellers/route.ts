import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";

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
    const tenant = await getTenantFromHeaders();

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

    // Calculate balances for each teller
    const tellersWithBalances = await Promise.all(
      tellers.map(async (teller) => {
        const vaultBalance = teller.cashAllocations.reduce(
          (sum, alloc) => sum + alloc.amount,
          0
        );

        // Get allocations to cashiers
        const cashierAllocations = await prisma.cashAllocation.findMany({
          where: {
            tellerId: teller.id,
            tenantId: tenant.id,
            cashierId: { not: null },
            status: "ACTIVE",
            notes: { not: { contains: "Variance" } },
          },
        });

        const allocatedToCashiers = cashierAllocations.reduce(
          (sum, alloc) => sum + alloc.amount,
          0
        );

        const availableBalance = vaultBalance - allocatedToCashiers;
        const currency = teller.cashAllocations[0]?.currency || "ZMW";

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
          vaultBalance,
          availableBalance,
          allocatedToCashiers,
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

