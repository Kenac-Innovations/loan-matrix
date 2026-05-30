import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  extractTenantSlugFromRequest,
  getOrCreateDefaultTenant,
  getTenantBySlug,
} from "@/lib/tenant-service";

export async function GET(request: NextRequest) {
  try {
    const leadIds = request.nextUrl.searchParams.get("leadIds");
    if (!leadIds) {
      return NextResponse.json({ progress: {} });
    }

    const ids = leadIds.split(",").filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ progress: {} });
    }

    const tenantSlug = extractTenantSlugFromRequest(request);
    let tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) tenant = await getOrCreateDefaultTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const stages = await prisma.pipelineStage.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { order: "asc" },
    });

    const nonFinalStages = stages.filter((stage) => !stage.isFinalState);
    const totalStages = nonFinalStages.length;
    const stageMap = new Map(stages.map((stage) => [stage.id, stage]));
    const stagePositionMap = new Map(
      nonFinalStages.map((stage, index) => [stage.id, index])
    );

    const leads = await prisma.lead.findMany({
      where: {
        id: { in: ids },
        tenantId: tenant.id,
      },
      select: {
        id: true,
        currentStageId: true,
        assignedToUserName: true,
        lastModified: true,
        createdAt: true,
      },
    });

    const transitions = await prisma.stateTransition.findMany({
      where: { leadId: { in: leads.map((lead) => lead.id) } },
      include: { fromStage: true, toStage: true },
      orderBy: { triggeredAt: "asc" },
    });

    const transitionsByLead = new Map<string, typeof transitions>();
    for (const transition of transitions) {
      const leadTransitions = transitionsByLead.get(transition.leadId) || [];
      leadTransitions.push(transition);
      transitionsByLead.set(transition.leadId, leadTransitions);
    }

    const progress: Record<string, unknown> = {};

    for (const lead of leads) {
      const stage = lead.currentStageId
        ? stageMap.get(lead.currentStageId)
        : null;

      const stagePosition = stage ? (stagePositionMap.get(stage.id) ?? 0) : 0;
      const progressPct =
        totalStages > 0 ? Math.round((stagePosition / totalStages) * 100) : 0;

      const leadTransitions = transitionsByLead.get(lead.id) || [];
      const timeInStageMs = lead.lastModified
        ? Date.now() - new Date(lead.lastModified).getTime()
        : Date.now() - new Date(lead.createdAt).getTime();

      progress[lead.id] = {
        stageName: stage?.name || "New",
        stageColor: stage?.color || "#94a3b8",
        stageOrder: stage?.order ?? 0,
        totalStages,
        progressPct: Math.min(progressPct, 100),
        isFinal: stage?.isFinalState ?? false,
        assignedTo: lead.assignedToUserName,
        timeInStageMs,
        transitions: leadTransitions.map((transition) => ({
          from: transition.fromStage?.name || "—",
          to: transition.toStage?.name || "—",
          at: transition.triggeredAt,
          by: transition.triggeredBy,
        })),
      };
    }

    return NextResponse.json({ progress });
  } catch (error) {
    console.error("Error fetching pipeline progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch pipeline progress" },
      { status: 500 }
    );
  }
}
