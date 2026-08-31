import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import {
  INVENTORY_CURRENCIES,
  INVENTORY_UNITS,
} from "@/lib/inventory/inventory-config";
import { getInventoryBranches } from "@/lib/inventory/inventory-branch-service";
import { getTenantFromHeaders } from "@/lib/tenant-service";

export async function GET() {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const branches = await getInventoryBranches().catch((error) => {
      console.error("Error loading inventory branches:", error);
      return [];
    });

    return NextResponse.json({
      units: INVENTORY_UNITS,
      currencies: INVENTORY_CURRENCIES,
      branches,
    });
  } catch (error) {
    console.error("Error loading inventory config:", error);
    return NextResponse.json(
      {
        error: "Failed to load inventory configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
