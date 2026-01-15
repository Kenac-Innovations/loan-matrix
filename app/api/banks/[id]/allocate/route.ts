import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";

/**
 * POST /api/banks/[id]/allocate
 * Allocate funds to a bank
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: bankId } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, currency, notes } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Find the bank
    const bank = await prisma.bank.findFirst({
      where: { id: bankId, tenantId: tenant.id },
    });

    if (!bank) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }

    if (!bank.isActive || bank.status === "CLOSED") {
      return NextResponse.json(
        { error: "Cannot allocate funds to inactive or closed bank" },
        { status: 400 }
      );
    }

    // Create allocation record
    const allocation = await prisma.bankAllocation.create({
      data: {
        tenantId: tenant.id,
        bankId: bank.id,
        amount: parseFloat(amount),
        currency: currency || "ZMW",
        allocatedBy: session.user.id,
        notes,
        status: "ACTIVE",
      },
    });

    // Get updated bank balance
    const allAllocations = await prisma.bankAllocation.findMany({
      where: {
        bankId: bank.id,
        status: "ACTIVE",
      },
    });

    const totalAllocated = allAllocations.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    return NextResponse.json({
      allocation,
      bankBalance: {
        totalAllocated,
        currency: currency || "ZMW",
      },
    });
  } catch (error) {
    console.error("Error allocating funds to bank:", error);
    return NextResponse.json(
      {
        error: "Failed to allocate funds",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/banks/[id]/allocate
 * Get allocation history for a bank
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: bankId } = params;
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");

    const whereClause: any = {
      bankId,
      tenantId: tenant.id,
    };

    if (status) {
      whereClause.status = status;
    }

    const allocations = await prisma.bankAllocation.findMany({
      where: whereClause,
      orderBy: { allocatedDate: "desc" },
      take: limit,
    });

    // Calculate totals
    const activeAllocations = allocations.filter((a) => a.status === "ACTIVE");
    const totalAllocated = activeAllocations.reduce(
      (sum, alloc) => sum + alloc.amount,
      0
    );

    return NextResponse.json({
      allocations,
      summary: {
        totalAllocated,
        activeCount: activeAllocations.length,
        totalCount: allocations.length,
      },
    });
  } catch (error) {
    console.error("Error fetching bank allocations:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch allocations",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

