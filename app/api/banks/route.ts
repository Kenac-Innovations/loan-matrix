import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { fetchFineractAPI } from "@/lib/api";

/**
 * GET /api/banks
 * Get all banks with their balances
 */
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const officeId = searchParams.get("officeId");

    // Build where clause
    const whereClause: any = {
      tenantId: tenant.id,
    };

    if (status) {
      whereClause.status = status;
    }

    if (officeId) {
      whereClause.officeId = parseInt(officeId);
    }

    // Get all banks with allocations and teller counts
    const banks = await prisma.bank.findMany({
      where: whereClause,
      include: {
        allocations: {
          where: { status: "ACTIVE" },
          orderBy: { allocatedDate: "desc" },
        },
        tellers: {
          where: { isActive: true },
          select: { id: true },
        },
        _count: {
          select: {
            tellers: true,
            allocations: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Calculate balances for each bank
    const banksWithBalances = await Promise.all(
      banks.map(async (bank) => {
        // Get all teller vault allocations for this bank
        const tellerAllocations = await prisma.cashAllocation.findMany({
          where: {
            tenantId: tenant.id,
            teller: { bankId: bank.id },
            cashierId: null, // Only vault allocations
            status: "ACTIVE",
          },
        });

        // Exclude opening balances from allocatedToTellers
        // Opening balances are existing cash at tellers, not allocations from the bank
        // Opening balances are identified by: notes containing "opening balance" OR allocatedBy = "SYSTEM-IMPORT"
        const allocatedToTellers = tellerAllocations
          .filter((alloc) => 
            !alloc.notes?.toLowerCase().includes("opening balance") && 
            alloc.allocatedBy !== "SYSTEM-IMPORT"
          )
          .reduce((sum, alloc) => sum + alloc.amount, 0);

        // Get bank balance from Fineract GL account if configured
        let totalAllocated = 0;
        let currency = "ZMW";
        let balanceSource = "local";

        if (bank.glAccountId) {
          try {
            // Fetch ALL journal entries and calculate balance manually
            // For ASSET accounts: DEBIT increases balance, CREDIT decreases balance
            const journalData = await fetchFineractAPI(
              `/journalentries?glAccountId=${bank.glAccountId}&limit=500&orderBy=id&sortOrder=DESC`
            );

            if (journalData?.pageItems && journalData.pageItems.length > 0) {
              // Calculate balance from all entries
              let calculatedBalance = 0;
              for (const entry of journalData.pageItems) {
                if (entry.entryType?.value === "DEBIT") {
                  calculatedBalance += entry.amount || 0;
                } else if (entry.entryType?.value === "CREDIT") {
                  calculatedBalance -= entry.amount || 0;
                }
              }
              
              const latestEntry = journalData.pageItems[0];
              totalAllocated = calculatedBalance;
              currency = latestEntry.currency?.code || "ZMW";
              balanceSource = "fineract_calculated";
            }
          } catch (error) {
            console.error(`Failed to fetch GL balance for bank ${bank.id}:`, error);
            // Fallback to local allocations
            totalAllocated = bank.allocations.reduce(
              (sum, alloc) => sum + alloc.amount,
              0
            );
            currency = bank.allocations[0]?.currency || "ZMW";
            balanceSource = "local_fallback";
          }
        } else {
          // No GL account configured, use local allocations
          totalAllocated = bank.allocations.reduce(
            (sum, alloc) => sum + alloc.amount,
            0
          );
          currency = bank.allocations[0]?.currency || "ZMW";
        }

        const availableBalance = totalAllocated - allocatedToTellers;

        return {
          ...bank,
          totalAllocated,
          allocatedToTellers,
          availableBalance,
          currency,
          balanceSource,
          tellerCount: bank._count.tellers,
          activeTellers: bank.tellers.length,
          // Remove internal fields
          allocations: undefined,
          tellers: undefined,
          _count: undefined,
        };
      })
    );

    return NextResponse.json(banksWithBalances);
  } catch (error) {
    console.error("Error fetching banks:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch banks",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/banks
 * Create a new bank
 */
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, code, description, officeId, officeName, glAccountId, glAccountName, glAccountCode } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Missing required fields: name, code" },
        { status: 400 }
      );
    }

    // Check if code already exists
    const existingBank = await prisma.bank.findFirst({
      where: {
        tenantId: tenant.id,
        code: code.toUpperCase(),
      },
    });

    if (existingBank) {
      return NextResponse.json(
        { error: `Bank with code "${code}" already exists` },
        { status: 400 }
      );
    }

    // Create bank in database
    const bank = await prisma.bank.create({
      data: {
        tenantId: tenant.id,
        name,
        code: code.toUpperCase(),
        description,
        officeId: officeId ? parseInt(officeId) : null,
        officeName: officeName || null,
        glAccountId: glAccountId || null,
        glAccountName: glAccountName || null,
        glAccountCode: glAccountCode || null,
        status: "ACTIVE",
        isActive: true,
      },
    });

    return NextResponse.json(bank);
  } catch (error) {
    console.error("Error creating bank:", error);
    return NextResponse.json(
      {
        error: "Failed to create bank",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

