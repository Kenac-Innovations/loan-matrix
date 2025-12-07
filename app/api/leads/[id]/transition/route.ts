import { NextRequest, NextResponse } from "next/server";
import { leadStateManager } from "@/lib/lead-state-manager";
import { getSession as getCustomSession } from "@/lib/auth";

/**
 * POST /api/leads/[id]/transition
 * Manually transition a lead to a new stage
 */
export async function POST(
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

    const body = await request.json();
    const { targetStageName, reason, metadata } = body;

    if (!targetStageName) {
      return NextResponse.json(
        { error: "targetStageName is required" },
        { status: 400 }
      );
    }

    console.log("=== MANUAL TRANSITION REQUEST ===");
    console.log("Lead ID:", leadId);
    console.log("Target Stage:", targetStageName);
    console.log("User ID:", session.user.id);
    console.log("Reason:", reason);

    const result = await leadStateManager.manualTransition(
      leadId,
      targetStageName,
      session.user.id,
      reason,
      metadata
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        newStage: result.newStage,
        stageName: result.stageName,
        message: result.message,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          errors: result.errors,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error in transition endpoint:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to transition lead",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leads/[id]/transition
 * Get available transitions for a lead
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

    const transitions = await leadStateManager.getAvailableTransitions(leadId);

    return NextResponse.json(transitions);
  } catch (error) {
    console.error("Error getting available transitions:", error);
    return NextResponse.json(
      {
        error: "Failed to get available transitions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
