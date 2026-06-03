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

    const loanIds = Array.from(
      new Set(
        rows
          .map((row) => row.fineractLoanId)
          .filter((value): value is number => typeof value === "number")
      )
    );
    const clientIds = Array.from(
      new Set(
        rows
          .map((row) => row.fineractClientId)
          .filter((value): value is number => typeof value === "number")
      )
    );

    const leads =
      loanIds.length > 0 || clientIds.length > 0
        ? await prisma.lead.findMany({
            where: {
              tenantId: tenant.id,
              OR: [
                ...(loanIds.length > 0
                  ? [{ fineractLoanId: { in: loanIds } }]
                  : []),
                ...(clientIds.length > 0
                  ? [{ fineractClientId: { in: clientIds } }]
                  : []),
              ],
            },
            select: {
              fineractLoanId: true,
              fineractClientId: true,
              firstname: true,
              middlename: true,
              lastname: true,
              fullname: true,
              tradingName: true,
              externalId: true,
            },
          })
        : [];
    const payouts =
      loanIds.length > 0
        ? await prisma.loanPayout.findMany({
            where: {
              tenantId: tenant.id,
              fineractLoanId: { in: loanIds },
            },
            select: {
              fineractLoanId: true,
              clientName: true,
            },
          })
        : [];

    const nrcByLoanId = new Map<number, string>();
    const nrcByClientId = new Map<number, string>();
    const clientNameByLoanId = new Map<number, string>();
    const clientNameByClientId = new Map<number, string>();

    for (const lead of leads) {
      const normalizedExternalId = lead.externalId?.trim() || null;
      const normalizedClientName =
        lead.fullname?.trim() ||
        [
          lead.firstname?.trim(),
          lead.middlename?.trim(),
          lead.lastname?.trim(),
        ]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        lead.tradingName?.trim() ||
        null;

      if (normalizedClientName) {
        if (typeof lead.fineractLoanId === "number") {
          clientNameByLoanId.set(lead.fineractLoanId, normalizedClientName);
        }

        if (typeof lead.fineractClientId === "number") {
          clientNameByClientId.set(lead.fineractClientId, normalizedClientName);
        }
      }

      if (!normalizedExternalId) {
        continue;
      }

      if (typeof lead.fineractLoanId === "number") {
        nrcByLoanId.set(lead.fineractLoanId, normalizedExternalId);
      }

      if (typeof lead.fineractClientId === "number") {
        nrcByClientId.set(lead.fineractClientId, normalizedExternalId);
      }
    }

    for (const payout of payouts) {
      const normalizedClientName = payout.clientName?.trim() || null;
      if (
        normalizedClientName &&
        typeof payout.fineractLoanId === "number" &&
        !clientNameByLoanId.has(payout.fineractLoanId)
      ) {
        clientNameByLoanId.set(payout.fineractLoanId, normalizedClientName);
      }
    }

    const ledger = buildMobileMoneyTransactionLedger(rows);
    const summary = summarizeMobileMoneyTransactions(rows);
    const enrichedLedger = ledger.map((row) => ({
      ...row,
      clientName: (() => {
        const fromRow = row.clientName?.trim() || null;
        if (fromRow) return fromRow;
        const fromLoan =
          typeof row.fineractLoanId === "number"
            ? clientNameByLoanId.get(row.fineractLoanId) ?? null
            : null;
        if (fromLoan) return fromLoan;
        return typeof row.fineractClientId === "number"
          ? clientNameByClientId.get(row.fineractClientId) ?? null
          : null;
      })(),
      clientNrc:
        (typeof row.fineractLoanId === "number"
          ? nrcByLoanId.get(row.fineractLoanId)
          : null) ??
        (typeof row.fineractClientId === "number"
          ? nrcByClientId.get(row.fineractClientId)
          : null) ??
        null,
      loanId: row.fineractLoanId ?? null,
    }));

    return NextResponse.json({
      config: getTenantMobileMoneySettings(tenant.settings as TenantSettings | null),
      configured: getConfiguredMobileMoney(tenant.settings as TenantSettings | null),
      summary,
      transactions: [...enrichedLedger].reverse(),
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
