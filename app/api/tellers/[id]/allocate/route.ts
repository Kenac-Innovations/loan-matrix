import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";

/**
 * POST /api/tellers/[id]/allocate
 * Allocate cash to a teller
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: tellerId } = params;
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

    // Try to find teller by database ID first
    let teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

    // If not found, try by Fineract teller ID (the ID might be a number)
    if (!teller && !isNaN(Number(tellerId))) {
      teller = await prisma.teller.findFirst({
        where: { fineractTellerId: Number(tellerId), tenantId: tenant.id },
      });
    }

    if (!teller) {
      console.error("Teller not found for ID:", tellerId, "tenant:", tenant.id);
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    // Create allocation record in database only (no Fineract call)
    // This is a local-only operation for teller-level tracking (vault)
    // cashierId is null for teller vault allocations
    const allocation = await prisma.cashAllocation.create({
      data: {
        tenantId: tenant.id,
        tellerId: teller.id, // Use the database ID from the found teller
        cashierId: null, // null = teller vault allocation
        fineractAllocationId: null, // No Fineract allocation for teller-level
        amount: parseFloat(amount),
        currency: currency || "USD",
        allocatedBy: session.user.id,
        notes,
        status: "ACTIVE",
      },
    });

    return NextResponse.json(allocation);
  } catch (error) {
    console.error("Error allocating cash:", error);
    return NextResponse.json(
      {
        error: "Failed to allocate cash",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
