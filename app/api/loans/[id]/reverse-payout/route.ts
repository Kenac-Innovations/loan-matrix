import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { prisma } from "@/lib/prisma";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

function formatDateForFineract(d: Date): string {
  const day = d.getDate();
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${day.toString().padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** POST: Reverse cash payout only (not disbursement). Money returns to cashier; cashier balance increases. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { id: loanIdParam } = await context.params;
    const fineractLoanId = parseInt(loanIdParam, 10);
    if (isNaN(fineractLoanId)) {
      return NextResponse.json({ error: "Invalid loan ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reversedBy =
      (body.reversedBy as string)?.trim() ||
      session.user.name ||
      session.user.email ||
      "Unknown";
    const userReason = (body.reason as string)?.trim();
    const reason = userReason
      ? `Reversed in Fineract; cashier credited (${reversedBy}). ${userReason}`
      : `Reversed in Fineract; cashier credited (${reversedBy})`;

    const payout = await prisma.loanPayout.findFirst({
      where: {
        tenantId: tenant.id,
        fineractLoanId,
      },
    });

    if (!payout) {
      return NextResponse.json(
        { error: "No payout record found for this loan. Nothing to reverse." },
        { status: 404 }
      );
    }

    if (payout.status === "REVERSED" || payout.status === "VOIDED") {
      return NextResponse.json(
        { error: "This payout has already been reversed or voided." },
        { status: 400 }
      );
    }

    if (payout.status !== "PAID") {
      return NextResponse.json(
        {
          error:
            "Only paid payouts can be reversed. Current status: " + payout.status,
        },
        { status: 400 }
      );
    }

    if (!payout.cashierId || !payout.tellerId) {
      return NextResponse.json(
        {
          error:
            "This payout has no cashier linked. Reversal requires the cashier who paid out so their balance can be updated.",
        },
        { status: 400 }
      );
    }

    // Amount to allocate back to cashier = amount paid out for this loan (must be positive)
    const allocationAmount = Number(payout.amount);
    if (!Number.isFinite(allocationAmount) || allocationAmount <= 0) {
      return NextResponse.json(
        {
          error:
            "Payout record has no valid amount. Cannot reverse. Amount paid out for this loan is missing or zero.",
        },
        { status: 400 }
      );
    }

    const cashier = await prisma.cashier.findFirst({
      where: { id: payout.cashierId, tenantId: tenant.id },
      include: { teller: true },
    });
    if (!cashier) {
      return NextResponse.json(
        { error: "Cashier record not found." },
        { status: 404 }
      );
    }
    const teller = cashier.teller;
    if (!teller?.fineractTellerId || cashier.fineractCashierId == null) {
      return NextResponse.json(
        { error: "Cashier or teller is missing Fineract ID. Cannot update cashier balance." },
        { status: 400 }
      );
    }

    const reversedAt = new Date();
    const txnNote = `Reversal - ${reason}`;

    // Send the payout amount to Fineract so net cash increases by that amount
    const txnAmountStr = allocationAmount.toFixed(2);
    console.log("[Reverse payout] Allocating to cashier:", {
      fineractTellerId: teller.fineractTellerId,
      fineractCashierId: cashier.fineractCashierId,
      amount: allocationAmount,
      txnAmount: txnAmountStr,
      currency: payout.currency,
    });

    try {
      const fineractService = await getFineractServiceWithSession();
      const result = await fineractService.allocateCashToCashier(
        teller.fineractTellerId,
        cashier.fineractCashierId,
        {
          txnDate: formatDateForFineract(reversedAt),
          currencyCode: payout.currency,
          txnAmount: txnAmountStr,
          txnNote,
          dateFormat: "dd MMMM yyyy",
          locale: "en",
        }
      );
      const fineractAllocationId = result?.resourceId ?? result?.id ?? null;
      if (fineractAllocationId != null) {
        await prisma.cashAllocation.create({
          data: {
            tenantId: tenant.id,
            tellerId: teller.id,
            cashierId: cashier.id,
            fineractAllocationId,
            amount: allocationAmount,
            currency: payout.currency,
            allocatedBy: session.user.id,
            notes: txnNote,
            status: "ACTIVE",
          },
        });
      }
    } catch (err: unknown) {
      console.error("Fineract allocate (reversal) error:", err);
      const ax = err as { response?: { data?: { defaultUserMessage?: string; errors?: Array<{ defaultUserMessage?: string }> } } };
      const msg = ax.response?.data?.defaultUserMessage ?? ax.response?.data?.errors?.[0]?.defaultUserMessage;
      return NextResponse.json(
        {
          error: "Failed to return cash to cashier in Fineract.",
          details: msg || (err instanceof Error ? (err as Error).message : "Unknown error"),
        },
        { status: 502 }
      );
    }

    await prisma.loanPayout.update({
      where: { id: payout.id },
      data: {
        status: "REVERSED",
        voidedAt: reversedAt,
        voidedBy: reversedBy,
        voidReason: reason,
      },
    });

    return NextResponse.json({
      success: true,
      message:
        "Payout reversed. Cash has been returned to the cashier; their balance and transaction history are updated.",
      payout: {
        id: payout.id,
        fineractLoanId: payout.fineractLoanId,
        clientName: payout.clientName,
        amount: payout.amount,
        currency: payout.currency,
        status: "REVERSED",
        voidedAt: reversedAt.toISOString(),
        voidedBy: reversedBy,
        cashierId: payout.cashierId,
      },
    });
  } catch (error) {
    console.error("Reverse payout error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reverse payout",
      },
      { status: 500 }
    );
  }
}
