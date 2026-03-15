import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

/**
 * GET /api/loans/payout-statuses
 * Get all payout statuses for loans (to display in loans table)
 */
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Fetch all payout records for this tenant
    const payouts = await prisma.loanPayout.findMany({
      where: {
        tenantId: tenant.id,
      },
      select: {
        id: true,
        fineractLoanId: true,
        fineractClientId: true,
        clientName: true,
        loanAccountNo: true,
        status: true,
        paidAt: true,
        paidBy: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json({
      payouts,
      total: payouts.length,
    });
  } catch (error) {
    console.error("Error fetching payout statuses:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch payout statuses",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

