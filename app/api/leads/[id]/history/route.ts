import { NextRequest, NextResponse } from "next/server";
import { leadStateManager } from "@/lib/lead-state-manager";
import { getSession as getCustomSession } from "@/lib/auth";

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

    const history = await leadStateManager.getTransitionHistory(leadId);

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
