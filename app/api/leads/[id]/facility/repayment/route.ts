import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  depositToSavingsAccount,
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
      include: {
        drawdowns: {
          where: { status: "DISBURSED" },
          orderBy: { disbursedAt: "asc" },
          take: 1,
        },
      },
    });

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const targetDrawdown = facility.drawdowns[0];
    if (!targetDrawdown) {
      return NextResponse.json(
        { error: "No disbursed drawdown found to repay against" },
        { status: 400 }
      );
    }

    // Guard: can't repay more than has been utilized (available = creditLimit - utilized)
    const utilizedAmount = facility.creditLimit - facility.availableBalance;
    if (amount > utilizedAmount) {
      return NextResponse.json(
        { error: `Repayment amount exceeds utilized balance of ${utilizedAmount}` },
        { status: 400 }
      );
    }

    const dateStr = transactionDate
      ? formatFineractDate(new Date(transactionDate))
      : formatFineractDate(new Date());

    const paymentTypeId = await getDefaultPaymentTypeId();
    const { transactionId } = await depositToSavingsAccount(
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

    await prisma.$transaction([
      prisma.revolvingCreditRepayment.create({
        data: {
          drawdownId: targetDrawdown.id,
          facilityId: facility.id,
          tenantId: facility.tenantId,
          amount,
          recordedByUserId: session.user.id,
          recordedByUserName: session.user.name ?? null,
          fineractTransactionId: transactionId,
          note: note ?? null,
          repaidAt: transactionDate ? new Date(transactionDate) : new Date(),
        },
      }),
      prisma.revolvingCreditFacility.update({
        where: { id: facility.id },
        data: { availableBalance: newAvailable },
      }),
    ]);

    return NextResponse.json({
      success: true,
      availableBalance: newAvailable,
      utilizedAmount: newUtilized,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
