import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";

/**
 * GET /api/banks/[id]
 * Get a single bank with full details
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const bank = await prisma.bank.findFirst({
      where: {
        id,
        tenantId: tenant.id,
      },
      include: {
        allocations: {
          where: { status: "ACTIVE" },
          orderBy: { allocatedDate: "desc" },
        },
        tellers: {
          where: { isActive: true },
          include: {
            cashAllocations: {
              where: { status: "ACTIVE", cashierId: null },
            },
            cashiers: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!bank) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }

    // Calculate bank balance
    const totalAllocated = bank.allocations.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    // Calculate teller allocations
    let allocatedToTellers = 0;
    const tellersWithBalances = bank.tellers.map((teller) => {
      const tellerVaultBalance = teller.cashAllocations.reduce(
        (sum, alloc) => sum + alloc.amount,
        0
      );
      allocatedToTellers += tellerVaultBalance;

      return {
        id: teller.id,
        name: teller.name,
        fineractTellerId: teller.fineractTellerId,
        officeName: teller.officeName,
        status: teller.status,
        vaultBalance: tellerVaultBalance,
        activeCashiers: teller.cashiers.length,
      };
    });

    const availableBalance = totalAllocated - allocatedToTellers;
    const currency = bank.allocations[0]?.currency || "ZMW";

    return NextResponse.json({
      ...bank,
      totalAllocated,
      allocatedToTellers,
      availableBalance,
      currency,
      tellers: tellersWithBalances,
      allocations: bank.allocations.slice(0, 10), // Return last 10 allocations
    });
  } catch (error) {
    console.error("Error fetching bank:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch bank",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/banks/[id]
 * Update a bank
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, code, description, officeId, officeName, status, isActive } =
      body;

    // Find existing bank
    const existingBank = await prisma.bank.findFirst({
      where: { id, tenantId: tenant.id },
    });

    if (!existingBank) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }

    // Check if code is being changed to an existing code
    if (code && code.toUpperCase() !== existingBank.code) {
      const codeExists = await prisma.bank.findFirst({
        where: {
          tenantId: tenant.id,
          code: code.toUpperCase(),
          id: { not: id },
        },
      });

      if (codeExists) {
        return NextResponse.json(
          { error: `Bank with code "${code}" already exists` },
          { status: 400 }
        );
      }
    }

    // Update bank
    const bank = await prisma.bank.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code: code.toUpperCase() }),
        ...(description !== undefined && { description }),
        ...(officeId !== undefined && {
          officeId: officeId ? parseInt(officeId) : null,
        }),
        ...(officeName !== undefined && { officeName }),
        ...(status && { status }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(bank);
  } catch (error) {
    console.error("Error updating bank:", error);
    return NextResponse.json(
      {
        error: "Failed to update bank",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/banks/[id]
 * Soft delete a bank (set isActive to false)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if bank has active tellers
    const activeTellers = await prisma.teller.count({
      where: {
        bankId: id,
        isActive: true,
      },
    });

    if (activeTellers > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete bank with ${activeTellers} active teller(s). Please reassign or deactivate tellers first.`,
        },
        { status: 400 }
      );
    }

    // Soft delete bank
    const bank = await prisma.bank.update({
      where: { id },
      data: {
        isActive: false,
        status: "CLOSED",
      },
    });

    return NextResponse.json({ success: true, bank });
  } catch (error) {
    console.error("Error deleting bank:", error);
    return NextResponse.json(
      {
        error: "Failed to delete bank",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

