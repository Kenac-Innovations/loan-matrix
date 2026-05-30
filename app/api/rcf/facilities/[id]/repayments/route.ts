import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: facilityId } = await context.params;

    const repayments = await prisma.revolvingCreditRepayment.findMany({
      where: { facilityId },
      orderBy: { repaidAt: "desc" },
      include: { drawdown: { select: { id: true, disbursedAmount: true, disbursedAt: true } } },
    });

    return NextResponse.json(repayments);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
