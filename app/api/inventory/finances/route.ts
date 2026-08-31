import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getInventoryFinanceSummary } from "@/lib/inventory/inventory-finance-service";
import { parseInventoryFinanceDate } from "@/lib/inventory/inventory-finance-date-range";

export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const currencyCode = String(searchParams.get("currencyCode") ?? "USD").trim().toUpperCase();
    const startDate = parseInventoryFinanceDate(searchParams.get("startDate"), "start");
    const endDate = parseInventoryFinanceDate(searchParams.get("endDate"), "end");

    const summary = await getInventoryFinanceSummary(prisma, {
      tenantId: tenant.id,
      currencyCode,
      startDate,
      endDate,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error fetching inventory finances:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch inventory finances",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
