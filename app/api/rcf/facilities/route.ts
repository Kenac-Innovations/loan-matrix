import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSavingsAccountBalance } from "@/lib/fineract-savings-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const fineractSavingsAccountId = searchParams.get("fineractSavingsAccountId");

    if (!fineractSavingsAccountId) {
      return NextResponse.json({ error: "fineractSavingsAccountId is required" }, { status: 400 });
    }

    const accountIdInt = parseInt(fineractSavingsAccountId, 10);
    if (isNaN(accountIdInt)) {
      return NextResponse.json({ error: "Invalid fineractSavingsAccountId" }, { status: 400 });
    }

    const facility = await prisma.revolvingCreditFacility.findFirst({
      where: { fineractSavingsAccountId: accountIdInt },
      include: {
        drawdowns: {
          orderBy: { requestedAt: "desc" },
          include: { repayments: { orderBy: { repaidAt: "desc" } } },
        },
      },
    });

    if (!facility) {
      return NextResponse.json(null);
    }

    let liveAvailable = facility.availableBalance;
    let liveUtilized = Math.max(0, facility.creditLimit - facility.availableBalance);
    try {
      const balance = await getSavingsAccountBalance(accountIdInt);
      const netDrawn = Math.max(0, balance.totalWithdrawals - balance.totalDeposits);
      liveAvailable = Math.max(0, facility.creditLimit - netDrawn);
      liveUtilized = facility.creditLimit - liveAvailable;
      await prisma.revolvingCreditFacility.update({
        where: { id: facility.id },
        data: { availableBalance: liveAvailable },
      });
    } catch {
      // use cached
    }

    const drawdowns = (facility as any).drawdowns ?? [];

    return NextResponse.json({
      ...facility,
      availableBalance: liveAvailable,
      utilizedAmount: liveUtilized,
      drawdownCount: drawdowns.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
