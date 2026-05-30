import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  withdrawFromSavingsAccount,
  getSavingsAccountBalance,
  getDefaultPaymentTypeId,
  formatFineractDate,
} from "@/lib/fineract-savings-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: leadId } = await context.params;
    const { amount, transactionDate, note } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const facility = await prisma.revolvingCreditFacility.findUnique({
      where: { leadId },
      include: { drawdowns: true },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    if (facility.drawdowns.length >= facility.maxDrawdowns) {
      return NextResponse.json(
        { error: `Maximum drawdown limit of ${facility.maxDrawdowns} reached` },
        { status: 400 }
      );
    }

    // Check against our own availableBalance (creditLimit - utilized), not Fineract's negative balance
    if (amount > facility.availableBalance) {
      return NextResponse.json(
        { error: `Amount exceeds available credit of ${facility.availableBalance}` },
        { status: 400 }
      );
    }

    const dateStr = transactionDate
      ? formatFineractDate(new Date(transactionDate))
      : formatFineractDate(new Date());

    const paymentTypeId = await getDefaultPaymentTypeId();
    const { transactionId } = await withdrawFromSavingsAccount(
      facility.fineractSavingsAccountId,
      amount,
      dateStr,
      note,
      paymentTypeId
    );

    // Recompute: available = creditLimit - (totalWithdrawals - totalDeposits)
    const updatedBalance = await getSavingsAccountBalance(facility.fineractSavingsAccountId);
    const netDrawn = Math.max(0, updatedBalance.totalWithdrawals - updatedBalance.totalDeposits);
    const newAvailable = Math.max(0, facility.creditLimit - netDrawn);
    const newUtilized = facility.creditLimit - newAvailable;

    const [drawdown] = await prisma.$transaction([
      prisma.revolvingCreditDrawdown.create({
        data: {
          facilityId: facility.id,
          tenantId: facility.tenantId,
          requestedAmount: amount,
          disbursedAmount: amount,
          status: "DISBURSED",
          requestedByUserId: session.user.id,
          requestedByUserName: session.user.name ?? null,
          disbursedByUserId: session.user.id,
          fineractTransactionId: transactionId,
          note: note ?? null,
          disbursedAt: new Date(),
        },
      }),
      prisma.revolvingCreditFacility.update({
        where: { id: facility.id },
        data: { availableBalance: newAvailable },
      }),
    ]);

    return NextResponse.json({
      success: true,
      drawdown,
      availableBalance: newAvailable,
      utilizedAmount: newUtilized,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
