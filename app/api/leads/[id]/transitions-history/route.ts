import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;

    const transitions = await prisma.stateTransition.findMany({
      where: { leadId },
      include: {
        fromStage: { select: { id: true, name: true, color: true } },
        toStage: { select: { id: true, name: true, color: true } },
      },
      orderBy: { triggeredAt: "desc" },
    });

    return NextResponse.json(transitions);
  } catch (error) {
    console.error("Error fetching transitions history:", error);
    return NextResponse.json(
      { error: "Failed to fetch transitions history" },
      { status: 500 }
    );
  }
}
