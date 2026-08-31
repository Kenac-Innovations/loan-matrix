import { fetchFineractAPI } from "@/lib/api";

import {
  normalizeInventoryBranches,
  type InventoryBranchOption,
} from "./inventory-config";

export async function getInventoryBranches(): Promise<InventoryBranchOption[]> {
  const offices = await fetchFineractAPI("/offices", { authMode: "service" });
  return normalizeInventoryBranches(offices);
}
