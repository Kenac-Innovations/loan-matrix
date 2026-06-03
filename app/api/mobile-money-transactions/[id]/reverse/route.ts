import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import {
  createFineractJournalEntry,
  getTenantMobileMoneyConfig,
} from "@/lib/mobile-money-transactions";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await getTenantFromHeaders();
    const session = await getSession();
    const { id } = await context.params;

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason || "").trim() || "Mobile money top-up reversed";
    const reversedBy =
      session.user.name || session.user.email || session.user.id || "Unknown";

    const original = await prisma.mobileMoneyTransaction.findFirst({
      where: {
        id,
        tenantId: tenant.id,
      },
    });

    if (!original) {
      return NextResponse.json(
        { error: "Mobile money transaction not found" },
        { status: 404 }
      );
    }

    if (original.type !== "TOP_UP") {
      return NextResponse.json(
        { error: "Only active top-ups can be reversed from this page" },
        { status: 400 }
      );
    }

    if (original.status === "REVERSED") {
      return NextResponse.json(
        { error: "This top-up has already been reversed" },
        { status: 400 }
      );
    }

    if (!original.sourceGlAccountId) {
      return NextResponse.json(
        { error: "Original source GL account is missing. Cannot reverse." },
        { status: 400 }
      );
    }

    const { configured } = await getTenantMobileMoneyConfig(tenant.id);
    if (!configured) {
      return NextResponse.json(
        { error: "Mobile money configuration is incomplete." },
        { status: 400 }
      );
    }

    const comments = `${reason} (${reversedBy})`;
    const journal = await createFineractJournalEntry({
      officeId: configured.defaultOfficeId,
      currencyCode: original.currency,
      debitGlAccountId: original.sourceGlAccountId,
      creditGlAccountId: configured.glAccountId,
      amount: original.amount,
      comments,
      referenceNumber: `MOMO-TOPUP-REV-${original.id}-${Date.now()}`,
      transactionDate: new Date(),
    });

    const reversal = await prisma.mobileMoneyTransaction.create({
      data: {
        tenantId: tenant.id,
        type: "TOP_UP_REVERSAL",
        amount: original.amount,
        currency: original.currency,
        transactionDate: new Date(),
        notes: `${reason} [Reversal of ${original.id}]`,
        status: "ACTIVE",
        createdBy: reversedBy,
        reversalOfId: original.id,
        fineractJournalEntryId: journal.journalEntryId,
        fineractLoanId: original.fineractLoanId,
        fineractClientId: original.fineractClientId,
        clientName: original.clientName,
        loanAccountNo: original.loanAccountNo,
        sourceGlAccountId: original.sourceGlAccountId,
        sourceGlAccountName: original.sourceGlAccountName,
        sourceGlAccountCode: original.sourceGlAccountCode,
        mobileMoneyGlAccountId: original.mobileMoneyGlAccountId,
        mobileMoneyGlAccountName: original.mobileMoneyGlAccountName,
        mobileMoneyGlAccountCode: original.mobileMoneyGlAccountCode,
      },
    });

    await prisma.mobileMoneyTransaction.update({
      where: { id: original.id },
      data: {
        status: "REVERSED",
        reversedAt: new Date(),
        reversedBy,
        reversalReason: reason,
      },
    });

    return NextResponse.json({
      success: true,
      transaction: reversal,
    });
  } catch (error) {
    console.error("Error reversing mobile money top-up:", error);
    return NextResponse.json(
      {
        error: "Failed to reverse mobile money top-up",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
