import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import {
  buildMobileMoneyTransactionLedger,
  getConfiguredMobileMoney,
  getTenantMobileMoneySettings,
  summarizeMobileMoneyTransactions,
} from "@/lib/mobile-money-transactions";
import type { TenantSettings } from "@/shared/types/tenant";

export async function GET() {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const rows = await prisma.mobileMoneyTransaction.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
    });

    const ledger = buildMobileMoneyTransactionLedger(rows);
    const summary = summarizeMobileMoneyTransactions(rows);

    return NextResponse.json({
      config: getTenantMobileMoneySettings(tenant.settings as TenantSettings | null),
      configured: getConfiguredMobileMoney(tenant.settings as TenantSettings | null),
      summary,
      transactions: [...ledger].reverse(),
    });
  } catch (error) {
    console.error("Error fetching mobile money transactions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch mobile money transactions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
