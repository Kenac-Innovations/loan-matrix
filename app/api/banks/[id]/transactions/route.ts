import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import {
  buildBankVaultTransactions,
  summarizeBankVaultTransactions,
} from "@/lib/bank-vault-transactions";
import { getSession } from "@/lib/auth";
import {
  canAccessOfficeId,
  resolveVisibleOfficeIdsForUser,
} from "@/lib/office-access";

interface FineractUserSummary {
  id: number;
  username?: string | null;
  displayName?: string | null;
}

/**
 * GET /api/banks/[id]/transactions
 * Get all cash movements for a bank vault.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: bankId } = params;
    const [tenant, session] = await Promise.all([
      getTenantFromHeaders(),
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
        id: bankId,
        tenantId: tenant.id,
      },
    });

    if (!bank) {
      return NextResponse.json({ error: "Bank not found" }, { status: 404 });
    }

    if (!canAccessOfficeId(bank.officeId, visibleOfficeIds)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userMap: Record<string, string> = {};
    try {
      const fineractService = await getFineractServiceWithSession();
      const users = await fineractService.getUsers();
      (users as FineractUserSummary[]).forEach((user) => {
        userMap[user.id.toString()] =
          user.username || user.displayName || `User ${user.id}`;
      });
    } catch (err) {
      console.error("Error fetching Fineract users:", err);
    }

    const [bankAllocations, tellerAllocations] = await Promise.all([
      prisma.bankAllocation.findMany({
        where: {
          bankId: bank.id,
          tenantId: tenant.id,
        },
        orderBy: { allocatedDate: "asc" },
      }),
      prisma.cashAllocation.findMany({
        where: {
          tenantId: tenant.id,
          teller: {
            bankId: bank.id,
            tenantId: tenant.id,
          },
        },
        orderBy: { allocatedDate: "asc" },
      }),
    ]);

    const transactionsWithBalance = buildBankVaultTransactions(
      bankAllocations,
      tellerAllocations
    ).map((tx) => {
      let allocatedByName = tx.allocatedBy;
      if (tx.allocatedBy === "SYSTEM-IMPORT") {
        allocatedByName = "System Import";
      } else if (tx.allocatedBy === "SYSTEM-REVERSAL") {
        allocatedByName = "System Reversal";
      } else if (userMap[tx.allocatedBy]) {
        allocatedByName = userMap[tx.allocatedBy];
      }

      return {
        ...tx,
        allocatedByName,
      };
    });

    const summary = summarizeBankVaultTransactions(transactionsWithBalance);
    const transactionsNewestFirst = [...transactionsWithBalance].reverse();

    return NextResponse.json({
      bank: {
        id: bank.id,
        name: bank.name,
        code: bank.code,
      },
      summary,
      transactions: transactionsNewestFirst,
    });
  } catch (error) {
    console.error("Error fetching bank transactions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch bank transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
