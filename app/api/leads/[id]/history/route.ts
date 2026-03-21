import { NextRequest, NextResponse } from "next/server";
import { getSession as getCustomSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/leads/[id]/history
 * Get state transition history for a lead
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: leadId } = params;
    const session = await getCustomSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transitions = await prisma.stateTransition.findMany({
      where: { leadId },
      include: { fromStage: true, toStage: true },
      orderBy: { triggeredAt: "desc" },
    });

    const history = transitions.map((t) => ({
      id: t.id,
      fromStage: t.fromStage?.name || null,
      toStage: t.toStage.name,
      event: t.event,
      triggeredBy: t.triggeredBy,
      triggeredAt: t.triggeredAt,
      metadata: t.metadata,
    }));

    return NextResponse.json({ history });
  } catch (error) {
    console.error("Error getting transition history:", error);
    return NextResponse.json(
      {
        error: "Failed to get transition history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
