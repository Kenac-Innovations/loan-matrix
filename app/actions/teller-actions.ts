"use server";

import { getFineractServiceWithSession } from "@/lib/fineract-api";

export async function getTellerFromFineract(id: string) {
  try {
    // Parse the ID - handle fineract-prefixed IDs or numeric IDs
    let tellerId: number;
    
    if (id.startsWith("fineract-")) {
      tellerId = parseInt(id.replace("fineract-", ""));
    } else if (!isNaN(Number(id))) {
      tellerId = Number(id);
    } else {
      throw new Error("Invalid teller ID format");
    }

    const fineractService = await getFineractServiceWithSession();
    const teller = await fineractService.getTeller(tellerId);

    if (!teller) {
      return { success: false, error: "Teller not found in Fineract" };
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
  try {
    const fineractService = await getFineractServiceWithSession();
    const cashiers = await fineractService.getTellerCashiers(tellerId);

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

