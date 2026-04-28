import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import {
  buildTellerVaultTransactions,
  summarizeTellerVaultTransactions,
} from "@/lib/teller-vault-transactions";

/**
 * GET /api/tellers/[id]/transactions
 * Get all cash allocations (transactions) for a teller vault
 * This includes opening balances, allocations from bank, and settlements
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: tellerId } = params;
    const tenant = await getTenantFromHeaders();

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Try to find teller by database ID first
    let teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

    // If not found, try by Fineract teller ID
    if (!teller && !Number.isNaN(Number(tellerId))) {
      teller = await prisma.teller.findFirst({
        where: { fineractTellerId: Number(tellerId), tenantId: tenant.id },
      });
    }

    if (!teller) {
      return NextResponse.json({ error: "Teller not found" }, { status: 404 });
    }

    // Fetch Fineract users to map user IDs to names
    let userMap: Record<string, string> = {};
    try {
      const fineractService = await getFineractServiceWithSession();
      const users = await fineractService.getUsers();
      users.forEach((user: any) => {
        userMap[user.id.toString()] = user.username || user.displayName || `User ${user.id}`;
      });
    } catch (err) {
      console.error("Error fetching Fineract users:", err);
      // Continue without user names - will fall back to IDs
    }

    // Get all teller-linked allocations so the vault history can include:
    // - direct vault movements (cashierId = null)
    // - cash allocated from the vault to cashier drawers (cashierId != null, shown as outflows)
    const allTellerAllocations = await prisma.cashAllocation.findMany({
      where: {
        tellerId: teller.id,
        tenantId: tenant.id,
      },
      orderBy: { allocatedDate: "asc" }, // Chronological order
    });

    const transactionsWithBalance = buildTellerVaultTransactions(allTellerAllocations).map(
      (tx) => {
        // Get user name from map, or use special labels for system entries
        let allocatedByName = tx.allocatedBy;
        if (tx.allocatedBy === "SYSTEM-IMPORT") {
          allocatedByName = "System Import";
        } else if (userMap[tx.allocatedBy]) {
          allocatedByName = userMap[tx.allocatedBy];
        }

        return {
          ...tx,
          allocatedByName,
        };
      }
    );
    const summary = summarizeTellerVaultTransactions(transactionsWithBalance);
    const transactionsNewestFirst = [...transactionsWithBalance].reverse();

    return NextResponse.json({
      teller: {
        id: teller.id,
        name: teller.name,
        fineractTellerId: teller.fineractTellerId,
      },
      summary,
      transactions: transactionsNewestFirst,
    });
  } catch (error) {
    console.error("Error fetching teller transactions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch teller transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
