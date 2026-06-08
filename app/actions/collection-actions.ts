"use server";

import { setupCollectionReports } from "@/lib/fineract-collections";

export async function setupBranchCollectionPerformanceReports(): Promise<{
  success: boolean;
  error?: string;
}> {
  return setupCollectionReports();
}
