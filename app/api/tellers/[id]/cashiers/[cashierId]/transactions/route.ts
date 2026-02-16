import { NextRequest, NextResponse } from "next/server";
import { getFineractServiceWithSession } from "@/lib/fineract-api";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";

/**
 * GET /api/tellers/[id]/cashiers/[cashierId]/transactions
 * Get summary and transactions for a cashier
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

    // Handle fineract-prefixed IDs for teller
    let fineractTellerIdFromPrefix: number | null = null;
    if (tellerId.startsWith("fineract-")) {
      fineractTellerIdFromPrefix = parseInt(tellerId.replace("fineract-", ""));
    }

    // Get teller by database ID or Fineract ID
    let teller = await prisma.teller.findFirst({
      where: { id: tellerId, tenantId: tenant.id },
    });

    // Try by Fineract ID if not found
    const fineractTellerIdToSearch = fineractTellerIdFromPrefix || (!isNaN(Number(tellerId)) ? Number(tellerId) : null);
    if (!teller && fineractTellerIdToSearch) {
      teller = await prisma.teller.findFirst({
        where: { fineractTellerId: fineractTellerIdToSearch, tenantId: tenant.id },
      });
    }

    if (!teller || !teller.fineractTellerId) {
      return NextResponse.json(
        { error: "Teller not found or does not have a Fineract ID" },
        { status: 404 }
      );
    }

    // Parse cashierId - could be database ID or Fineract ID
    const cashierIdNum = parseInt(cashierId);
    const isNumericId = !isNaN(cashierIdNum);

    // Try to find cashier by database ID first
    let cashier = await prisma.cashier.findFirst({
      where: { id: cashierId, tellerId: teller.id, tenantId: tenant.id },
    });

    // If not found by database ID and cashierId is numeric, try Fineract ID
    if (!cashier && isNumericId) {
        cashier = await prisma.cashier.findFirst({
          where: {
          fineractCashierId: cashierIdNum,
          tellerId: teller.id,
            tenantId: tenant.id,
          },
        });
    }

    // Get Fineract cashier ID
    let fineractCashierId: number;
    if (cashier?.fineractCashierId) {
      fineractCashierId = cashier.fineractCashierId;
    } else if (isNumericId) {
      fineractCashierId = cashierIdNum;
    } else {
      return NextResponse.json(
        { error: "Cashier not found or invalid cashier ID" },
        { status: 404 }
      );
    }

    // Get currency code and pagination from query params
    const { searchParams } = new URL(request.url);
    const currencyCode = searchParams.get("currencyCode") || "ZMK";
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const limit = limitParam ? parseInt(limitParam, 10) : 500;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // Fetch summary and transactions from Fineract (request up to 500 by default to avoid truncation)
    const fineractService = await getFineractServiceWithSession();
    const summaryAndTransactions = await fineractService.getCashierSummaryAndTransactions(
      teller.fineractTellerId,
      fineractCashierId,
      currencyCode,
      { offset, limit: Math.min(limit, 500) }
    );

    return NextResponse.json(summaryAndTransactions);
  } catch (error) {
    console.error("Error fetching cashier transactions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
