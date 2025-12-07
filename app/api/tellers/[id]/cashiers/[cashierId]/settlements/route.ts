import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

/**
 * GET /api/tellers/[id]/cashiers/[cashierId]/settlements
 * Get settlements for a cashier
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; cashierId: string }> }
) {
  try {
    const params = await context.params;
    const { id: tellerId, cashierId } = params;
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

    // Try to find cashier by database ID first, then by Fineract ID
    let cashier = await prisma.cashier.findFirst({
      where: { id: cashierId, tellerId, tenantId: tenant.id },
    });

    if (!cashier) {
      const fineractCashierId = parseInt(cashierId);
      if (!isNaN(fineractCashierId)) {
        cashier = await prisma.cashier.findFirst({
          where: {
            fineractCashierId,
            tellerId,
            tenantId: tenant.id,
          },
        });
      }
    }

    if (!teller || !cashier) {
      return NextResponse.json(
        { error: "Teller or cashier not found" },
        { status: 404 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "10");
    const latest = searchParams.get("latest") === "true";

    // Build where clause
    const where: any = {
      tellerId,
      cashierId: cashier.id,
      tenantId: tenant.id,
    };

    if (status) {
      where.status = status;
    }

    // Get settlements
    const settlements = await prisma.cashSettlement.findMany({
      where,
      orderBy: { settlementDate: "desc" },
      take: latest ? 1 : limit,
    });

    return NextResponse.json(latest ? settlements[0] || null : settlements);
  } catch (error) {
    console.error("Error fetching settlements:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch settlements",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

