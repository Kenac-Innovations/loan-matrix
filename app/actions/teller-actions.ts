"use server";

import { PrismaClient } from "@/app/generated/prisma";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { unstable_noStore as noStore } from "next/cache";

const db = prisma as PrismaClient;

export async function getTellerFromFineract(id: string) {
  // Disable caching to always fetch fresh data from Fineract
  noStore();
  
  try {
    // Parse the ID - handle fineract-prefixed IDs, numeric IDs, or database IDs
    let tellerId: number;
    
    if (id.startsWith("fineract-")) {
      tellerId = parseInt(id.replace("fineract-", ""));
    } else if (!isNaN(Number(id))) {
      tellerId = Number(id);
    } else {
      // Try to look up by database ID (CUID format)
      const tenant = await getTenantFromHeaders();
      
      if (tenant) {
        const dbTeller = await db.teller.findFirst({
          where: {
            id: id,
            tenantId: tenant.id,
          },
        });
        
        if (dbTeller?.fineractTellerId) {
          tellerId = dbTeller.fineractTellerId;
        } else {
          console.error("Teller not found in database or has no fineractTellerId:", id);
          throw new Error("Teller not found");
        }
      } else {
        console.error("No tenant found");
        throw new Error("Tenant not found");
      }
    }

    const fineractService = await getFineractServiceWithSession();
    
    // Fetch teller details from Fineract
    const teller = await fineractService.getTeller(tellerId);

    if (!teller) {
      return { success: false, error: "Teller not found in Fineract" };
    }

    // Fetch cashiers for this teller from Fineract
    let cashiers: any[] = [];
    try {
      cashiers = await fineractService.getCashiers(tellerId);
    } catch (cashierError) {
      console.error("Error fetching cashiers:", cashierError);
    }

    // Fetch teller summary if available
    let summary: any = null;
    try {
      summary = await fineractService.getTellerSummary(tellerId);
    } catch (summaryError) {
      console.error("Error fetching teller summary:", summaryError);
    }

    // Fetch local database data for balance information
    let vaultBalance = 0;
    let availableBalance = 0;
    let allocatedToCashiers = 0;
    let currency = "ZMW";
    let recentSettlements: any[] = [];

    try {
      const tenant = await getTenantFromHeaders();
      
      if (tenant) {
        // Find the local database teller by Fineract ID
        const dbTeller = await db.teller.findFirst({
          where: {
            fineractTellerId: tellerId,
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
            settlements: {
              orderBy: { settlementDate: "desc" },
              take: 10,
            },
          },
        });

        if (dbTeller) {
          vaultBalance = dbTeller.cashAllocations.reduce(
            (sum: number, alloc: { amount: number }) => sum + alloc.amount,
            0
          );
          currency = dbTeller.cashAllocations[0]?.currency || "ZMW";

          const cashierAllocations = await db.cashAllocation.findMany({
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
              (sum: number, alloc: { amount: number }) => sum + (alloc.amount > 0 ? alloc.amount : 0),
              0
            );
            const netSum = cashierAllocations.reduce(
              (sum: number, alloc: { amount: number }) => sum + alloc.amount,
              0
            );
            return Math.max(positiveSum, netSum);
          })();

          allocatedToCashiers = localAllocated;
          try {
            const fineractService = await getFineractServiceWithSession();
            const fineractCashiers = await fineractService.getCashiers(tellerId);
            let fineractAllocated = 0;
            for (const fc of fineractCashiers || []) {
              try {
                const summary = await fineractService.getCashierSummaryAndTransactions(
                  tellerId,
                  fc.id,
                  "ZMK"
                );
                fineractAllocated += Math.max(
                  summary.sumCashAllocation || 0,
                  summary.netCash || 0
                );
              } catch (err) {
                console.error(`Error getting Fineract summary for cashier ${fc.id}:`, err);
              }
            }
            allocatedToCashiers = Math.max(localAllocated, fineractAllocated);
          } catch (err) {
            console.error("Error fetching Fineract cashier balances, using local DB:", err);
          }

          availableBalance = vaultBalance - allocatedToCashiers;
          recentSettlements = dbTeller.settlements;
        }
      }
    } catch (dbError) {
      console.error("Error fetching local database data:", dbError);
    }

    return { 
      success: true, 
      data: {
        id: teller.id,
        name: teller.name,
        description: teller.description,
        officeId: teller.officeId,
        officeName: teller.officeName,
        status: teller.status,
        startDate: teller.startDate,
        endDate: teller.endDate,
        cashiers: cashiers || [],
        activeCashiers: (cashiers || []).filter((c: any) => c.isFullDay || c.startTime).length,
        summary: summary,
        // Local database balance data
        vaultBalance,
        availableBalance,
        allocatedToCashiers,
        currency,
        currentAllocation: {
          amount: availableBalance,
          currency,
        },
        recentSettlements,
      }
    };
  } catch (error) {
    console.error("Error fetching teller from Fineract:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to fetch teller from Fineract" 
    };
  }
}

export async function getTellerCashiersFromFineract(tellerId: number) {
  // Disable caching to always fetch fresh data from Fineract
  noStore();
  
  try {
    const fineractService = await getFineractServiceWithSession();
    const cashiers = await fineractService.getCashiers(tellerId);

    return { 
      success: true, 
      data: cashiers || []
    };
  } catch (error) {
    console.error("Error fetching cashiers from Fineract:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to fetch cashiers" 
    };
  }
}
