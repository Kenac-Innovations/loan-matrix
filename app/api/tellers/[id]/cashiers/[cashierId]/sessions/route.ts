import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

/**
 * GET /api/tellers/[id]/cashiers/[cashierId]/sessions
 * Get session history for a cashier
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
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: any = {
      tellerId,
      cashierId: cashier.id,
      tenantId: tenant.id,
    };

    if (status) {
      where.sessionStatus = status;
    }

    // Get sessions
    const [sessions, total] = await Promise.all([
      prisma.cashierSession.findMany({
        where,
        orderBy: { sessionStartTime: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.cashierSession.count({ where }),
    ]);

    return NextResponse.json({
      sessions,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch sessions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


