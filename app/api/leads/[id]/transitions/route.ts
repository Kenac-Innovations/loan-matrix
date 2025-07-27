import { NextRequest, NextResponse } from "next/server";
import { TeamAwareStateMachineService } from "@/lib/team-state-machine-service";
import { getTenantFromHeaders } from "@/lib/tenant-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || undefined;

    const availableTransitions =
      await TeamAwareStateMachineService.getAvailableTransitionsWithTeams(
        leadId,
        userId
      );

    return NextResponse.json({ availableTransitions });
  } catch (error) {
    console.error("Error fetching available transitions:", error);
    return NextResponse.json(
      { error: "Failed to fetch available transitions" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;
    const body = await request.json();
    const { targetStageId, event, context, triggeredBy } = body;

    if (!targetStageId) {
      return NextResponse.json(
        { error: "targetStageId is required" },
        { status: 400 }
      );
    }

    if (!triggeredBy) {
      return NextResponse.json(
        { error: "triggeredBy is required" },
        { status: 400 }
      );
    }

    const result = await TeamAwareStateMachineService.executeTransition({
      leadId,
      targetStageId,
      event: event || "MANUAL_TRANSITION",
      context,
      triggeredBy,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        lead: result.lead,
        transition: result.transition,
        assignedTeam: result.assignedTeam,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error executing transition:", error);
    return NextResponse.json(
      { error: "Failed to execute transition" },
      { status: 500 }
    );
  }
}
