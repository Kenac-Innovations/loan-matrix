import { NextRequest, NextResponse } from "next/server";
import { TeamAwareStateMachineService } from "@/lib/team-state-machine-service";
import { getSession as getCustomSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/leads/[id]/transition
 * Transition a lead to a new stage (by stage name for backward compat, or by stageId)
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
    const { targetStageName, targetStageId, reason, metadata, fineractOverrides } = body;

    if (!targetStageName && !targetStageId) {
      return NextResponse.json(
        { error: "targetStageName or targetStageId is required" },
        { status: 400 }
      );
    }

    let resolvedStageId = targetStageId;

    // Resolve stage name to ID if needed
    if (!resolvedStageId && targetStageName) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { tenantId: true },
      });

      if (!lead) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
      }

      const stage = await prisma.pipelineStage.findFirst({
        where: {
          tenantId: lead.tenantId,
          name: targetStageName,
          isActive: true,
        },
      });

      if (!stage) {
        return NextResponse.json(
          { error: `Stage "${targetStageName}" not found` },
          { status: 404 }
        );
      }

      resolvedStageId = stage.id;
    }

    // Check required documents before allowing transition
    const leadForDocs = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { tenantId: true, fineractClientId: true },
    });

    if (leadForDocs) {
      const requiredDocs = await prisma.requiredDocument.findMany({
        where: { tenantId: leadForDocs.tenantId, isActive: true, isRequired: true },
      });

      if (requiredDocs.length > 0) {
        // Check local LeadDocument records
        const localDocs = await prisma.leadDocument.findMany({
          where: { leadId },
          select: { name: true, category: true },
        });

        // Also check Fineract client documents if client exists
        let fineractDocs: { name: string }[] = [];
        if (leadForDocs.fineractClientId) {
          try {
            const { fetchFineractAPI } = await import("@/lib/api");
            const clientDocs = await fetchFineractAPI(
              `/clients/${leadForDocs.fineractClientId}/documents`
            );
            const docs = Array.isArray(clientDocs) ? clientDocs : clientDocs?.pageItems || [];
            fineractDocs = docs.map((d: any) => ({ name: d.name || d.fileName || "" }));
          } catch {
            // If Fineract is unreachable, just check local docs
          }
        }

        const allDocs = [
          ...localDocs.map((d) => ({ name: d.name, category: d.category })),
          ...fineractDocs.map((d) => ({ name: d.name, category: "" })),
        ];

        const missingDocs = requiredDocs.filter((req) => {
          const target = req.name.toLowerCase();
          return !allDocs.some(
            (d) => d.name.toLowerCase().includes(target)
          );
        });

        if (missingDocs.length > 0) {
          return NextResponse.json(
            {
              success: false,
              message: `Missing required documents: ${missingDocs.map((d) => d.name).join(", ")}`,
              missingDocuments: missingDocs.map((d) => ({
                name: d.name,
                category: d.category,
              })),
            },
            { status: 400 }
          );
        }
      }
    }

    const result = await TeamAwareStateMachineService.executeTransition({
      leadId,
      targetStageId: resolvedStageId,
      event: "MANUAL_TRANSITION",
      triggeredBy: session.user.id,
      reason,
      fineractOverrides,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        newStage: result.lead?.currentStageId,
        stageName: result.lead?.currentStage?.name,
        message: result.message,
        assignedMember: result.assignedMember,
      });
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
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
 * Get available transitions for a lead with team context
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

    const transitions =
      await TeamAwareStateMachineService.getAvailableTransitionsWithTeams(
        leadId,
        session.user.id
      );

    return NextResponse.json({ transitions });
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
