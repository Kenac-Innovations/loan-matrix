import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

/**
 * GET /api/tellers/[id]
 * Get a specific teller by ID
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

    // Try to get from database first
    const dbTeller = await prisma.teller.findFirst({
      where: {
        id,
        tenantId: tenant.id,
      },
      include: {
        cashAllocations: {
          where: {
            status: "ACTIVE",
            cashierId: null, // Only teller vault allocations
          },
          orderBy: { allocatedDate: "desc" },
          // Remove take: 1 to get ALL vault allocations, not just the latest one
        },
        cashiers: {
          where: { isActive: true },
        },
        settlements: {
          orderBy: { settlementDate: "desc" },
          take: 10,
        },
      },
    });

    if (!dbTeller) {
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    // Calculate vault balance and available balance
    const vaultBalance = dbTeller.cashAllocations.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    // Get all cashier allocations to calculate available balance
    // Exclude variance allocations - variance is tracked separately
    const cashierAllocations = await prisma.cashAllocation.findMany({
      where: {
        tellerId: dbTeller.id,
        tenantId: tenant.id,
        cashierId: { not: null },
        status: "ACTIVE",
        // Exclude variance allocations (those with notes containing "Variance")
        notes: { not: { contains: "Variance" } },
      },
    });

    const allocatedToCashiers = cashierAllocations.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    const availableBalance = vaultBalance - allocatedToCashiers;
    const currency = dbTeller.cashAllocations[0]?.currency || "USD";

    // Prepare base response with database data
    const baseResponse = {
      id: dbTeller.id,
      name: dbTeller.name,
      description: dbTeller.description,
      officeId: dbTeller.officeId,
      officeName: dbTeller.officeName,
      status: dbTeller.status,
      startDate: dbTeller.startDate,
      endDate: dbTeller.endDate,
      currentAllocation: {
        amount: availableBalance, // Show available balance, not vault balance
        currency: currency,
      },
      vaultBalance: vaultBalance,
      availableBalance: availableBalance,
      allocatedToCashiers: allocatedToCashiers,
      activeCashiers: dbTeller.cashiers.length,
      cashAllocations: dbTeller.cashAllocations,
      cashiers: dbTeller.cashiers,
      recentSettlements: dbTeller.settlements,
    };

    // Get latest data from Fineract if available
    if (dbTeller.fineractTellerId) {
      try {
        const fineractService = await getFineractServiceWithSession();
        const fineractTeller = await fineractService.getTeller(
          dbTeller.fineractTellerId
        );

        // Merge Fineract data with database data
        return NextResponse.json({
          ...baseResponse,
          ...fineractTeller,
          // Ensure database ID and related data are preserved
          id: dbTeller.id,
          // Use Fineract data if available, otherwise use database
          startDate: fineractTeller.startDate || dbTeller.startDate,
          endDate: fineractTeller.endDate || dbTeller.endDate,
          officeName: fineractTeller.officeName || dbTeller.officeName,
          status: fineractTeller.status || dbTeller.status,
        });
      } catch (error) {
        console.error("Error fetching from Fineract:", error);
        // Return database data if Fineract fails
        return NextResponse.json(baseResponse);
      }
    }

    // Return database data if no Fineract ID
    return NextResponse.json(baseResponse);
  } catch (error) {
    console.error("Error fetching teller:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch teller",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tellers/[id]
 * Update a teller
 */
export async function PUT(
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

    const body = await request.json();
    const dbTeller = await prisma.teller.findFirst({
      where: { id, tenantId: tenant.id },
    });

    if (!dbTeller) {
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    // Update in Fineract if we have the ID
    if (dbTeller.fineractTellerId) {
      const fineractService = await getFineractServiceWithSession();
      await fineractService.updateTeller(dbTeller.fineractTellerId, body);
    }

    // Update in database
    const updatedTeller = await prisma.teller.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        endDate: body.endDate ? new Date(body.endDate) : null,
        status: body.status,
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
    });

    return NextResponse.json(updatedTeller);
  } catch (error) {
    console.error("Error updating teller:", error);
    return NextResponse.json(
      {
        error: "Failed to update teller",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tellers/[id]
 * Delete a teller
 */
export async function DELETE(
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

    const dbTeller = await prisma.teller.findFirst({
      where: { id, tenantId: tenant.id },
    });

    if (!dbTeller) {
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    // Delete from Fineract if we have the ID
    if (dbTeller.fineractTellerId) {
      try {
        const fineractService = await getFineractServiceWithSession();
        await fineractService.deleteTeller(dbTeller.fineractTellerId);
      } catch (error) {
        console.error("Error deleting from Fineract:", error);
        // Continue with database deletion even if Fineract fails
      }
    }

    // Soft delete in database
    await prisma.teller.update({
      where: { id },
      data: { isActive: false, status: "CLOSED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting teller:", error);
    return NextResponse.json(
      {
        error: "Failed to delete teller",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
