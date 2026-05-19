import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: facilityId } = await context.params;

    const drawdowns = await prisma.revolvingCreditDrawdown.findMany({
      where: { facilityId },
      orderBy: { requestedAt: "desc" },
      include: { repayments: { orderBy: { repaidAt: "desc" } } },
    });

    return NextResponse.json(drawdowns);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
