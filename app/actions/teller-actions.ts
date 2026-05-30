"use server";

import { PrismaClient } from "@/app/generated/prisma";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getOrgDefaultCurrencyCode } from "@/lib/currency-utils";
import { getTellerVaultDisplay } from "@/lib/gl-balance";
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

    // Vault & available balance come *only* from the Fineract GL account.
    // When the GL is missing or Fineract is unreachable, both values are
    // `null` so the UI renders NaN ("—").
    const orgCurrency = await getOrgDefaultCurrencyCode();
    let vaultBalance: number | null = null;
    let availableBalance: number | null = null;
    let currency = orgCurrency;
    let recentSettlements: any[] = [];
    let vaultBalanceSource: "fineract_gl" | "unavailable" = "unavailable";
    let glUnavailableReason: "not_configured" | "fineract_unreachable" | undefined =
      "not_configured";
    let glAccountInfo: {
      glAccountId: number | null;
      glAccountName: string | null;
      glAccountCode: string | null;
    } = {
      glAccountId: null,
      glAccountName: null,
      glAccountCode: null,
    };
    let bankInfo: {
      bankId: string | null;
      bankName: string | null;
      bankGlAccountId: number | null;
      bankGlAccountCode: string | null;
    } = {
      bankId: null,
      bankName: null,
      bankGlAccountId: null,
      bankGlAccountCode: null,
    };

    try {
      const tenant = await getTenantFromHeaders();

      if (tenant) {
        const dbTeller = await db.teller.findFirst({
          where: {
            fineractTellerId: tellerId,
            tenantId: tenant.id,
          },
          include: {
            bank: {
              select: {
                id: true,
                name: true,
                glAccountId: true,
                glAccountCode: true,
              },
            },
            settlements: {
              orderBy: { settlementDate: "desc" },
              take: 10,
            },
          },
        });

        if (dbTeller) {
          glAccountInfo = {
            glAccountId: dbTeller.glAccountId,
            glAccountName: dbTeller.glAccountName,
            glAccountCode: dbTeller.glAccountCode,
          };

          bankInfo = {
            bankId: dbTeller.bank?.id ?? null,
            bankName: dbTeller.bank?.name ?? null,
            bankGlAccountId: dbTeller.bank?.glAccountId ?? null,
            bankGlAccountCode: dbTeller.bank?.glAccountCode ?? null,
          };

          const vaultDisplay = await getTellerVaultDisplay(dbTeller);
          vaultBalance = vaultDisplay.vaultBalance;
          availableBalance = vaultDisplay.availableBalance;
          vaultBalanceSource = vaultDisplay.vaultBalanceSource;
          glUnavailableReason = vaultDisplay.glUnavailableReason;
          currency = vaultDisplay.currency || orgCurrency;
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
        // Balance data — Fineract GL only; null when unavailable.
        vaultBalance,
        vaultBalanceSource,
        glUnavailableReason,
        availableBalance,
        currency,
        ...glAccountInfo,
        ...bankInfo,
        currentAllocation:
          availableBalance != null
            ? { amount: availableBalance, currency }
            : null,
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
