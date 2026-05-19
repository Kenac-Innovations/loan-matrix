import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSavingsAccountBalance } from "@/lib/fineract-savings-service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;

    const [facility, lead] = await Promise.all([
      prisma.revolvingCreditFacility.findUnique({
        where: { leadId },
        include: {
          drawdowns: {
            orderBy: { requestedAt: "desc" },
            include: { repayments: { orderBy: { repaidAt: "desc" } } },
          },
        },
      }),
      prisma.lead.findUnique({ where: { id: leadId }, select: { stateMetadata: true } }),
    ]);

    if (!facility) {
      return NextResponse.json({ error: "Facility not found" }, { status: 404 });
    }

    const meta = (lead?.stateMetadata as any) ?? {};
    const tenorMonths: number | null = meta.tenorMonths ?? null;
    const nominalInterestRate: number | null = meta.nominalInterestRate ?? null;

    // available = creditLimit - (totalWithdrawals - totalDeposits), clamped to [0, creditLimit]
    let liveAvailable = facility.availableBalance;
    let liveUtilized = Math.max(0, facility.creditLimit - facility.availableBalance);
    try {
      const balance = await getSavingsAccountBalance(facility.fineractSavingsAccountId);
      const netDrawn = Math.max(0, balance.totalWithdrawals - balance.totalDeposits);
      liveAvailable = Math.max(0, facility.creditLimit - netDrawn);
      liveUtilized = facility.creditLimit - liveAvailable;
      await prisma.revolvingCreditFacility.update({
        where: { id: facility.id },
        data: { availableBalance: liveAvailable },
      });
    } catch {
      // use cached value
    }

    const drawdownCount = facility.drawdowns.length;

    return NextResponse.json({
      ...facility,
      availableBalance: liveAvailable,
      utilizedAmount: liveUtilized,
      drawdownCount,
      canDrawdown: drawdownCount < facility.maxDrawdowns && liveAvailable > 0,
      tenorMonths,
      nominalInterestRate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
