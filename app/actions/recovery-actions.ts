"use server";

import {
  registerRecoveryDatatables,
  setupRecoveryReports,
} from "@/lib/fineract-recoveries";

export async function setupRecoveryDatatables(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await registerRecoveryDatatables();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to register recovery datatables",
    };
  }
}

export async function setupRecoveriesReports(): Promise<{
  success: boolean;
  error?: string;
}> {
  return setupRecoveryReports();
}
