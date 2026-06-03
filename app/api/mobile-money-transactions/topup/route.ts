import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { getOrgDefaultCurrencyCode } from "@/lib/currency-utils";
import {
  createFineractJournalEntry,
  getTenantMobileMoneyConfig,
} from "@/lib/mobile-money-transactions";

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
    const amount = Number(body?.amount);
    const officeId = Number(body?.officeId);
    const sourceGlAccountId = Number(body?.sourceGlAccountId);
    const sourceGlAccountName = String(body?.sourceGlAccountName || "");
    const sourceGlAccountCode = String(body?.sourceGlAccountCode || "");
    const transactionDate = body?.transactionDate
      ? new Date(body.transactionDate)
      : new Date();
    const notes = String(body?.notes || "").trim();
    const referenceNumber = String(body?.referenceNumber || "").trim();
    const currency = String(
      body?.currency || (await getOrgDefaultCurrencyCode()) || "ZMW"
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(officeId) || officeId <= 0) {
      return NextResponse.json(
        { error: "A valid office is required" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(sourceGlAccountId) || sourceGlAccountId <= 0) {
      return NextResponse.json(
        { error: "A valid source GL account is required" },
        { status: 400 }
      );
    }

    const { configured } = await getTenantMobileMoneyConfig(tenant.id);
    if (!configured) {
      return NextResponse.json(
        {
          error:
            "Mobile money configuration is incomplete. Please configure the mobile money GL account, payout clearing GL account, and office first.",
        },
        { status: 400 }
      );
    }

    const comments = notes || `Mobile money top-up from ${sourceGlAccountCode || "source GL"}`;
    const journal = await createFineractJournalEntry({
      officeId,
      currencyCode: currency,
      debitGlAccountId: configured.glAccountId,
      creditGlAccountId: sourceGlAccountId,
      amount,
      comments,
      referenceNumber:
        referenceNumber || `MOMO-TOPUP-${tenant.slug}-${Date.now()}`,
      transactionDate,
    });

    const createdBy =
      session.user.name || session.user.email || session.user.id || "Unknown";

    const transaction = await prisma.mobileMoneyTransaction.create({
      data: {
        tenantId: tenant.id,
        type: "TOP_UP",
        amount,
        currency,
        transactionDate,
        notes,
        status: "ACTIVE",
        createdBy,
        fineractJournalEntryId: journal.journalEntryId,
        sourceGlAccountId,
        sourceGlAccountName,
        sourceGlAccountCode,
        mobileMoneyGlAccountId: configured.glAccountId,
        mobileMoneyGlAccountName: configured.glAccountName,
        mobileMoneyGlAccountCode: configured.glAccountCode,
      },
    });

    return NextResponse.json({
      success: true,
      transaction,
      journalEntryId: journal.journalEntryId,
    });
  } catch (error) {
    console.error("Error topping up mobile money:", error);
    return NextResponse.json(
      {
        error: "Failed to top up mobile money",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
