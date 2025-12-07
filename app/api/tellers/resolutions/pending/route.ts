import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

/**
 * GET /api/tellers/resolutions/pending
 * Get all pending variance resolutions (RECONCILED settlements with unresolved variance)
 */
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Get all settlements with variance that's not resolved
    // Show any settlement with a variance that hasn't been resolved, regardless of status
    const settlements = await prisma.cashSettlement.findMany({
      where: {
        tenantId: tenant.id,
        varianceResolved: false,
        // Only settlements with significant variance (not between -0.01 and 0.01)
        OR: [{ difference: { gt: 0.01 } }, { difference: { lt: -0.01 } }],
      },
      include: {
        cashier: {
          select: {
            staffName: true,
          },
        },
        teller: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { settlementDate: "desc" },
    });

    return NextResponse.json(settlements);
  } catch (error) {
    console.error("Error fetching pending resolutions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch pending resolutions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
