import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getOrgDefaultCurrencyCode, getOrgRawCurrencyCode } from "@/lib/currency-utils";

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
    let { id } = params;
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Handle fineract-prefixed IDs (e.g., "fineract-123")
    let fineractIdFromPrefix: number | null = null;
    if (id.startsWith("fineract-")) {
      fineractIdFromPrefix = parseInt(id.replace("fineract-", ""));
    }

    // Try to get from database first by ID
    let dbTeller = await prisma.teller.findFirst({
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

    // If not found, try by Fineract ID (in case the ID is a number or fineract-prefixed)
    const fineractIdToSearch = fineractIdFromPrefix || (!isNaN(Number(id)) ? Number(id) : null);
    if (!dbTeller && fineractIdToSearch) {
      dbTeller = await prisma.teller.findFirst({
        where: {
          fineractTellerId: fineractIdToSearch,
          tenantId: tenant.id,
        },
        include: {
          cashAllocations: {
            where: {
              status: "ACTIVE",
              cashierId: null,
            },
            orderBy: { allocatedDate: "desc" },
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
    }

    // If still not found but we have a Fineract ID, fetch from Fineract and auto-sync
    if (!dbTeller && fineractIdToSearch) {
      try {
        const fineractService = await getFineractServiceWithSession();
        const fineractTeller = await fineractService.getTeller(fineractIdToSearch);
        
        if (fineractTeller) {
          // Auto-sync: Create the teller in the database
          dbTeller = await prisma.teller.create({
            data: {
              tenantId: tenant.id,
              fineractTellerId: fineractIdToSearch,
              officeId: fineractTeller.officeId,
              officeName: fineractTeller.officeName || `Office ${fineractTeller.officeId}`,
              name: fineractTeller.name,
              description: fineractTeller.description || "",
              startDate: Array.isArray(fineractTeller.startDate) 
                ? new Date(fineractTeller.startDate[0], fineractTeller.startDate[1] - 1, fineractTeller.startDate[2])
                : new Date(fineractTeller.startDate),
              endDate: fineractTeller.endDate 
                ? (Array.isArray(fineractTeller.endDate)
                    ? new Date(fineractTeller.endDate[0], fineractTeller.endDate[1] - 1, fineractTeller.endDate[2])
                    : new Date(fineractTeller.endDate))
                : null,
              status: fineractTeller.status || "ACTIVE",
            },
            include: {
              cashAllocations: {
                where: {
                  status: "ACTIVE",
                  cashierId: null,
                },
                orderBy: { allocatedDate: "desc" },
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
          console.log(`Auto-synced Fineract teller ${fineractIdToSearch} to database as ${dbTeller.id}`);
        }
      } catch (syncError) {
        console.error("Error syncing teller from Fineract:", syncError);
      }
    }

    if (!dbTeller) {
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    // Calculate balances - available must DECREASE when loans are disbursed, and handle deposits
    // allocatedToCashiers = cash currently in cashier tills; use netCash (current balance), not sumCashAllocation (cumulative)
    const currency = await getOrgDefaultCurrencyCode();
    
    const vaultBalance = dbTeller.cashAllocations.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );
    
    // Compute allocatedToCashiers: always include local DB allocations so we never undercount
    // (Fineract may return 0 due to currency/timing; local allocations are source of truth for our allocations)
    const cashierAllocationsForTeller = await prisma.cashAllocation.findMany({
      where: {
        tellerId: dbTeller.id,
        tenantId: tenant.id,
        cashierId: { not: null },
        status: "ACTIVE",
        notes: { not: { contains: "Variance" } },
      },
    });
    const localAllocatedToCashiers = (() => {
      const positiveSum = cashierAllocationsForTeller.reduce(
        (sum, alloc) => sum + (alloc.amount > 0 ? alloc.amount : 0),
        0
      );
      const netSum = cashierAllocationsForTeller.reduce((sum, alloc) => sum + alloc.amount, 0);
      return Math.max(positiveSum, netSum);
    })();

    let allocatedToCashiers = localAllocatedToCashiers;
    if (dbTeller.fineractTellerId) {
      try {
        const fineractService = await getFineractServiceWithSession();
        const fineractCashiers = await fineractService.getCashiers(dbTeller.fineractTellerId);
        let fineractAllocated = 0;
        for (const fc of fineractCashiers) {
          try {
            const rawCurrency = await getOrgRawCurrencyCode();
            const summary = await fineractService.getCashierSummaryAndTransactions(
              dbTeller.fineractTellerId,
              fc.id,
              rawCurrency
            );
            fineractAllocated += summary.netCash ?? summary.sumCashAllocation ?? 0;
          } catch (err) {
            console.error(`Error getting Fineract summary for cashier ${fc.id}:`, err);
          }
        }
        // Use the larger of Fineract or local to avoid undercounting (e.g. when Fineract returns 0)
        allocatedToCashiers = Math.max(localAllocatedToCashiers, fineractAllocated);
      } catch (err) {
        console.error("Error fetching Fineract cashier balances, using local DB:", err);
        // allocatedToCashiers already set from local
      }
    }

    const availableBalance = vaultBalance - allocatedToCashiers;

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

        // Merge Fineract data with database data.
        // Keep our computed balances (vault, allocated, available) so they are not overwritten by Fineract's getTeller response.
        return NextResponse.json({
          ...baseResponse,
          ...fineractTeller,
          id: dbTeller.id,
          startDate: fineractTeller.startDate || dbTeller.startDate,
          endDate: fineractTeller.endDate || dbTeller.endDate,
          officeName: fineractTeller.officeName || dbTeller.officeName,
          status: fineractTeller.status || dbTeller.status,
          vaultBalance: baseResponse.vaultBalance,
          allocatedToCashiers: baseResponse.allocatedToCashiers,
          availableBalance: baseResponse.availableBalance,
          currentAllocation: baseResponse.currentAllocation,
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
    
    // Try to find teller by database ID first
    let dbTeller = await prisma.teller.findFirst({
      where: { id, tenantId: tenant.id },
    });

    // If not found, try by Fineract ID
    if (!dbTeller && !isNaN(Number(id))) {
      dbTeller = await prisma.teller.findFirst({
        where: { fineractTellerId: Number(id), tenantId: tenant.id },
      });
    }

    if (!dbTeller) {
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    // Update in Fineract if we have the ID
    if (dbTeller.fineractTellerId) {
      const fineractService = await getFineractServiceWithSession();
      await fineractService.updateTeller(dbTeller.fineractTellerId, body);
    }

    // Update in database using the actual database ID
    const updatedTeller = await prisma.teller.update({
      where: { id: dbTeller.id },
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

    // Try to find teller by database ID first
    let dbTeller = await prisma.teller.findFirst({
      where: { id, tenantId: tenant.id },
    });

    // If not found, try by Fineract ID
    if (!dbTeller && !isNaN(Number(id))) {
      dbTeller = await prisma.teller.findFirst({
        where: { fineractTellerId: Number(id), tenantId: tenant.id },
      });
    }

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

    // Soft delete in database using the actual database ID
    await prisma.teller.update({
      where: { id: dbTeller.id },
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
