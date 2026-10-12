import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { getOrgDefaultCurrencyCode } from "@/lib/currency-utils";
import { getGlAccountBalance, getTellerVaultDisplay } from "@/lib/gl-balance";
import { computeBankBalances } from "@/lib/bank-balance";
import {
  canAccessOfficeId,
  resolveVisibleOfficeIdsForUser,
} from "@/lib/office-access";

/**
 * GET /api/banks/[id]
 * Get a single bank with full details
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    const [tenant, orgCurrency, session] = await Promise.all([
      getTenantFromHeaders(),
      getOrgDefaultCurrencyCode(),
      getSession(),
    ]);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const visibleOfficeIds = await resolveVisibleOfficeIdsForUser({
      tenantId: tenant.id,
      fineractUserId: session.user.userId,
      sessionOfficeId: session.user.officeId,
      sessionOfficeName: session.user.officeName,
    });

    const bank = await prisma.bank.findFirst({
      where: {
        id,
        tenantId: tenant.id,
      },
      include: {
        allocations: {
          where: { status: "ACTIVE" },
          orderBy: { allocatedDate: "desc" },
        },
        tellers: {
          where: { isActive: true },
          include: {
            cashAllocations: {
              where: { status: "ACTIVE", cashierId: null },
            },
            cashiers: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    if (!bank) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }

    if (!canAccessOfficeId(bank.officeId, visibleOfficeIds)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Per-teller `vaultBalance` is sourced *only* from Fineract GL — `null`
    // when not configured or Fineract is unreachable.
    const tellerVaults = await Promise.all(
      bank.tellers.map((teller) => getTellerVaultDisplay(teller))
    );
    const tellersWithBalances = bank.tellers.map((teller, i) => ({
      id: teller.id,
      name: teller.name,
      fineractTellerId: teller.fineractTellerId,
      officeName: teller.officeName,
      status: teller.status,
      glAccountId: teller.glAccountId,
      glAccountName: teller.glAccountName,
      glAccountCode: teller.glAccountCode,
      vaultBalance: tellerVaults[i].vaultBalance,
      vaultBalanceSource: tellerVaults[i].vaultBalanceSource,
      activeCashiers: teller.cashiers.length,
    }));

    let bankGl: Parameters<typeof computeBankBalances>[0]["bankGl"] = null;
    let glAccountBalance = null;
    if (bank.glAccountId) {
      const r = await getGlAccountBalance(bank.glAccountId);
      if (r.source === "fineract_calculated" || r.source === "fineract_empty") {
        bankGl = { balance: r.balance, currency: r.currency, source: r.source };
        glAccountBalance = {
          balance: r.balance,
          currency: r.currency || orgCurrency,
          source: r.source,
          entryCount: r.entryCount,
        };
      } else {
        console.error("Failed to fetch GL balance from Fineract, falling back to local:", r.error);
        glAccountBalance = {
          source: "local_fallback",
          error: "Failed to fetch from Fineract",
        };
      }
    }

    const balances = computeBankBalances({
      bankGl,
      hasGlAccount: !!bank.glAccountId,
      tellerVaultBalances: tellerVaults.map((v) => v.vaultBalance),
      localBankAllocations: bank.allocations,
      localTellerAllocations: bank.tellers.flatMap((t) => t.cashAllocations),
    });
    const { totalAllocated, allocatedToTellers, availableBalance } = balances;
    const currency =
      balances.currency || bank.allocations[0]?.currency || orgCurrency;

    return NextResponse.json({
      ...bank,
      totalAllocated,
      allocatedToTellers,
      availableBalance,
      currency,
      glAccountBalance,
      tellers: tellersWithBalances,
      allocations: bank.allocations.slice(0, 10), // Return last 10 allocations
    });
  } catch (error) {
    console.error("Error fetching bank:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch bank",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/banks/[id]
 * Update a bank
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, code, description, officeId, officeName, glAccountId, glAccountName, glAccountCode, status, isActive } =
      body;
    const visibleOfficeIds = await resolveVisibleOfficeIdsForUser({
      tenantId: tenant.id,
      fineractUserId: session.user.userId,
      sessionOfficeId: session.user.officeId,
      sessionOfficeName: session.user.officeName,
    });
    const normalizedOfficeId =
      officeId !== undefined && officeId !== null && officeId !== ""
        ? parseInt(officeId, 10)
        : officeId === null
          ? null
          : undefined;

    // Find existing bank
    const existingBank = await prisma.bank.findFirst({
      where: { id, tenantId: tenant.id },
    });

    if (!existingBank) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }

    if (!canAccessOfficeId(existingBank.officeId, visibleOfficeIds)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      normalizedOfficeId !== undefined &&
      !canAccessOfficeId(normalizedOfficeId, visibleOfficeIds)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if code is being changed to an existing code
    if (code && code.toUpperCase() !== existingBank.code) {
      const codeExists = await prisma.bank.findFirst({
        where: {
          tenantId: tenant.id,
          code: code.toUpperCase(),
          id: { not: id },
        },
      });

      if (codeExists) {
        return NextResponse.json(
          { error: `Bank with code "${code}" already exists` },
          { status: 400 }
        );
      }
    }

    // Update bank
    const bank = await prisma.bank.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code: code.toUpperCase() }),
        ...(description !== undefined && { description }),
        ...(normalizedOfficeId !== undefined && {
          officeId: normalizedOfficeId,
        }),
        ...(officeName !== undefined && { officeName }),
        ...(glAccountId !== undefined && { glAccountId }),
        ...(glAccountName !== undefined && { glAccountName }),
        ...(glAccountCode !== undefined && { glAccountCode }),
        ...(status && { status }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(bank);
  } catch (error) {
    console.error("Error updating bank:", error);
    return NextResponse.json(
      {
        error: "Failed to update bank",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/banks/[id]
 * Soft delete a bank (set isActive to false)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    const tenant = await getTenantFromHeaders();
    const session = await getSession();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const visibleOfficeIds = await resolveVisibleOfficeIdsForUser({
      tenantId: tenant.id,
      fineractUserId: session.user.userId,
      sessionOfficeId: session.user.officeId,
      sessionOfficeName: session.user.officeName,
    });

    const existingBank = await prisma.bank.findFirst({
      where: { id, tenantId: tenant.id },
      select: { officeId: true },
    });

    if (!existingBank) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }

    if (!canAccessOfficeId(existingBank.officeId, visibleOfficeIds)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if bank has active tellers
    const activeTellers = await prisma.teller.count({
      where: {
        bankId: id,
        isActive: true,
      },
    });

    if (activeTellers > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete bank with ${activeTellers} active teller(s). Please reassign or deactivate tellers first.`,
        },
        { status: 400 }
      );
    }

    // Soft delete bank
    const bank = await prisma.bank.update({
      where: { id },
      data: {
        isActive: false,
        status: "CLOSED",
      },
    });

    return NextResponse.json({ success: true, bank });
  } catch (error) {
    console.error("Error deleting bank:", error);
    return NextResponse.json(
      {
        error: "Failed to delete bank",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
