import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

/**
 * GET /api/tellers
 * Get all tellers, optionally filtered by office
 */
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const officeId = searchParams.get("officeId");

    // Get tellers from Fineract - this is the source of truth
    const fineractService = await getFineractServiceWithSession();
    const fineractTellers = await fineractService.getTellers(
      officeId ? parseInt(officeId) : undefined
    );

    console.log("Fineract tellers count:", fineractTellers.length);

    // Get existing database tellers
    const existingDbTellers = await prisma.teller.findMany({
      where: {
        tenantId: tenant.id,
        fineractTellerId: { not: null },
      },
      select: { fineractTellerId: true, id: true },
    });
    const existingFineractIds = new Set(existingDbTellers.map(t => t.fineractTellerId));

    // Auto-sync: Create database records for any Fineract tellers that don't exist
    const tellersToSync = fineractTellers.filter((ft: any) => !existingFineractIds.has(ft.id));
    
    console.log(`Fineract tellers: ${fineractTellers.length}, Existing in DB: ${existingFineractIds.size}, Need to sync: ${tellersToSync.length}`);
    
    if (tellersToSync.length > 0) {
      console.log(`Auto-syncing ${tellersToSync.length} Fineract tellers to database:`, tellersToSync.map((t: any) => ({ id: t.id, name: t.name })));
      
      for (const ft of tellersToSync) {
        try {
          // Parse status - could be a number (300=ACTIVE) or string
          let statusStr = "ACTIVE";
          if (typeof ft.status === "number") {
            statusStr = ft.status === 300 ? "ACTIVE" : ft.status === 400 ? "INACTIVE" : "PENDING";
          } else if (typeof ft.status === "object" && ft.status?.value) {
            statusStr = ft.status.value;
          } else if (typeof ft.status === "string") {
            statusStr = ft.status;
          }

          const tellerData = {
            tenantId: tenant.id,
            fineractTellerId: ft.id,
            officeId: ft.officeId,
            officeName: ft.officeName || `Office ${ft.officeId}`,
            name: ft.name,
            description: ft.description || "",
            startDate: Array.isArray(ft.startDate) 
              ? new Date(ft.startDate[0], ft.startDate[1] - 1, ft.startDate[2])
              : new Date(ft.startDate || Date.now()),
            endDate: ft.endDate 
              ? (Array.isArray(ft.endDate)
                  ? new Date(ft.endDate[0], ft.endDate[1] - 1, ft.endDate[2])
                  : new Date(ft.endDate))
              : null,
            status: statusStr,
          };
          
          console.log(`Creating teller in DB:`, { fineractTellerId: ft.id, name: ft.name });
          
          const created = await prisma.teller.create({
            data: tellerData,
          });
          
          console.log(`✓ Synced Fineract teller ${ft.id} (${ft.name}) to database, DB ID: ${created.id}`);
        } catch (syncError: any) {
          console.error(`✗ Error syncing teller ${ft.id} (${ft.name}):`, syncError.message);
          // Log full error for debugging
          if (syncError.code) {
            console.error(`  Prisma error code: ${syncError.code}`);
          }
        }
      }
    }

    // Now get all database tellers with enrichment data
    const dbTellers = await prisma.teller.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
      },
      include: {
        bank: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
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
        _count: {
          select: {
            settlements: true,
          },
        },
      },
    });

    // OPTIMIZED: Fetch all cashiers for all tellers in parallel (single batch)
    // This replaces multiple sequential calls with one parallel batch
    const tellerCashiersMap = new Map<number, any[]>();
    
    await Promise.all(
      fineractTellers.map(async (ft: any) => {
        try {
          const cashiers = await fineractService.getCashiers(ft.id);
          tellerCashiersMap.set(ft.id, cashiers);
        } catch (err) {
          console.error(`Error fetching cashiers for teller ${ft.id}:`, err);
          tellerCashiersMap.set(ft.id, []);
        }
      })
    );

    // Calculate balances - use max(Fineract, local) for allocatedToCashiers so we never undercount
    const dbTellerBalances = await Promise.all(
      dbTellers.map(async (dbTeller) => {
        const vaultBalance = dbTeller.cashAllocations.reduce(
          (sum, alloc) => sum + alloc.amount,
          0
        );

        const cashierAllocations = await prisma.cashAllocation.findMany({
          where: {
            tellerId: dbTeller.id,
            tenantId: tenant.id,
            cashierId: { not: null },
            status: "ACTIVE",
            notes: { not: { contains: "Variance" } },
          },
        });
        const localAllocated = (() => {
          const positiveSum = cashierAllocations.reduce(
            (sum, alloc) => sum + (alloc.amount > 0 ? alloc.amount : 0),
            0
          );
          const netSum = cashierAllocations.reduce((sum, alloc) => sum + alloc.amount, 0);
          return Math.max(positiveSum, netSum);
        })();

        let allocatedToCashiers = localAllocated;
        const fineractCashiers = tellerCashiersMap.get(dbTeller.fineractTellerId!) || [];
        if (fineractCashiers.length > 0) {
          const summaries = await Promise.all(
            fineractCashiers.map(async (fc: any) => {
              try {
                const summary = await fineractService.getCashierSummaryAndTransactions(
                  dbTeller.fineractTellerId!,
                  fc.id,
                  "ZMK"
                );
                return Math.max(
                  summary.sumCashAllocation || 0,
                  summary.netCash || 0
                );
              } catch (err) {
                return 0;
              }
            })
          );
          const fineractAllocated = summaries.reduce((sum, val) => sum + val, 0);
          allocatedToCashiers = Math.max(localAllocated, fineractAllocated);
        }

        const availableBalance = vaultBalance - allocatedToCashiers;
        const currency = "ZMK";

        return {
          fineractTellerId: dbTeller.fineractTellerId,
          dbId: dbTeller.id,
          bankId: dbTeller.bankId,
          bank: dbTeller.bank,
          vaultBalance,
          availableBalance,
          allocatedToCashiers,
          currentAllocation: { amount: availableBalance, currency },
          activeCashiers: fineractCashiers.length,
          settlementCount: dbTeller._count.settlements,
        };
      })
    );

    // Use cached cashier data for merging (no duplicate fetch)
    const tellersWithCashiers = fineractTellers.map((ft: any) => {
      const fineractCashiers = tellerCashiersMap.get(ft.id) || [];
      return {
        ...ft,
        fineractCashiers,
        activeCashiers: fineractCashiers.length,
      };
    });

    // Merge Fineract data with database data - all should now have database IDs
    const mergedTellers = tellersWithCashiers.map((ft: any) => {
      const dbData = dbTellerBalances.find((dt) => dt.fineractTellerId === ft.id);
      return {
        ...ft,
        id: dbData?.dbId, // Use database ID
        fineractTellerId: ft.id,
        ...(dbData && {
          bankId: dbData.bankId,
          bank: dbData.bank,
          currentAllocation: dbData.currentAllocation,
          vaultBalance: dbData.vaultBalance,
          availableBalance: dbData.availableBalance,
          allocatedToCashiers: dbData.allocatedToCashiers,
          settlementCount: dbData.settlementCount,
        }),
        // Use Fineract cashier count (already set above)
      };
    }).filter((t: any) => t.id); // Only return tellers with database IDs

    console.log("Returning merged tellers count:", mergedTellers.length);
    return NextResponse.json(mergedTellers);
  } catch (error) {
    console.error("Error fetching tellers:", error);
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
 * POST /api/tellers
 * Create a new teller
 */
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const { officeId, name, description, startDate, endDate, bankId } = body;

    if (!officeId || !name || !startDate) {
      return NextResponse.json(
        { error: "Missing required fields: officeId, name, startDate" },
        { status: 400 }
      );
    }

    // Format date from ISO to Fineract format (dd MMMM yyyy)
    const formatDateForFineract = (dateString: string): string => {
      if (!dateString) return "";
      const date = new Date(dateString);
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      const day = date.getDate().toString().padStart(2, "0");
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    };

    // Create teller in Fineract
    const fineractService = await getFineractServiceWithSession();
    const fineractTeller = await fineractService.createTeller({
      officeId: parseInt(officeId),
      name,
      description: description || "",
      startDate: formatDateForFineract(startDate),
      endDate: endDate ? formatDateForFineract(endDate) : "",
      status: 300, // Active status
      dateFormat: "dd MMMM yyyy",
      locale: "en",
    });

    // Create teller in database
    const dbTeller = await prisma.teller.create({
      data: {
        tenantId: tenant.id,
        fineractTellerId: fineractTeller.resourceId || fineractTeller.id,
        officeId: parseInt(officeId),
        officeName: body.officeName || `Office ${officeId}`,
        name,
        description,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status: "PENDING",
        bankId: bankId || null, // Link to parent bank if provided
      },
    });

    return NextResponse.json({
      ...fineractTeller,
      id: dbTeller.id,
    });
  } catch (error) {
    console.error("Error creating teller:", error);
    return NextResponse.json(
      {
        error: "Failed to create teller",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
