import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { getOrgDefaultCurrencyCode } from "@/lib/currency-utils";
import { loadBankBalances } from "@/lib/bank-balance";
import {
  canAccessOfficeId,
  resolveVisibleOfficeIdsForUser,
} from "@/lib/office-access";

/**
 * GET /api/banks
 * Get all banks with their balances
 */
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgCurrency = await getOrgDefaultCurrencyCode();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const officeId = searchParams.get("officeId");
    const visibleOfficeIds = await resolveVisibleOfficeIdsForUser({
      tenantId: tenant.id,
      fineractUserId: session.user.userId,
      sessionOfficeId: session.user.officeId,
      sessionOfficeName: session.user.officeName,
    });

    // Build where clause
    const whereClause: Prisma.BankWhereInput = {
      tenantId: tenant.id,
    };

    if (status) {
      whereClause.status = status;
    }

    if (officeId) {
      const requestedOfficeId = parseInt(officeId, 10);

      if (!canAccessOfficeId(requestedOfficeId, visibleOfficeIds)) {
        return NextResponse.json([]);
      }

      whereClause.officeId = requestedOfficeId;
    } else if (visibleOfficeIds !== null) {
      whereClause.officeId = {
        in: visibleOfficeIds,
      };
    }

    // Get all banks with allocations and teller counts
    const banks = await prisma.bank.findMany({
      where: whereClause,
      include: {
        allocations: {
          where: { status: "ACTIVE" },
          orderBy: { allocatedDate: "desc" },
        },
        tellers: {
          where: { isActive: true },
          select: {
            id: true,
            glAccountId: true,
            glAccountCode: true,
            glAccountName: true,
            cashAllocations: {
              where: { status: "ACTIVE", cashierId: null },
            },
          },
        },
        _count: {
          select: {
            tellers: true,
            allocations: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Calculate balances for each bank
    const banksWithBalances = await Promise.all(
      banks.map(async (bank) => {
        const balances = await loadBankBalances(bank);
        const { totalAllocated, allocatedToTellers, availableBalance } = balances;
        const currency =
          balances.currency || bank.allocations[0]?.currency || orgCurrency;
        const balanceSource = balances.source;

        return {
          ...bank,
          totalAllocated,
          allocatedToTellers,
          availableBalance,
          currency,
          balanceSource,
          tellerCount: bank._count.tellers,
          activeTellers: bank.tellers.length,
          // Remove internal fields
          allocations: undefined,
          tellers: undefined,
          _count: undefined,
        };
      })
    );

    return NextResponse.json(banksWithBalances);
  } catch (error) {
    console.error("Error fetching banks:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch banks",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/banks
 * Create a new bank
 */
export async function POST(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, code, description, officeId, officeName, glAccountId, glAccountName, glAccountCode } = body;
    const normalizedOfficeId = officeId ? parseInt(officeId, 10) : null;
    const visibleOfficeIds = await resolveVisibleOfficeIdsForUser({
      tenantId: tenant.id,
      fineractUserId: session.user.userId,
      sessionOfficeId: session.user.officeId,
      sessionOfficeName: session.user.officeName,
    });

    if (!name || !code) {
      return NextResponse.json(
        { error: "Missing required fields: name, code" },
        { status: 400 }
      );
    }

    if (!canAccessOfficeId(normalizedOfficeId, visibleOfficeIds)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if code already exists
    const existingBank = await prisma.bank.findFirst({
      where: {
        tenantId: tenant.id,
        code: code.toUpperCase(),
      },
    });

    if (existingBank) {
      return NextResponse.json(
        { error: `Bank with code "${code}" already exists` },
        { status: 400 }
      );
    }

    // Create bank in database
    const bank = await prisma.bank.create({
      data: {
        tenantId: tenant.id,
        name,
        code: code.toUpperCase(),
        description,
        officeId: normalizedOfficeId,
        officeName: officeName || null,
        glAccountId: glAccountId || null,
        glAccountName: glAccountName || null,
        glAccountCode: glAccountCode || null,
        status: "ACTIVE",
        isActive: true,
      },
    });

    return NextResponse.json(bank);
  } catch (error) {
    console.error("Error creating bank:", error);
    return NextResponse.json(
      {
        error: "Failed to create bank",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
