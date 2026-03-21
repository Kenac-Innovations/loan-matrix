import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTenantBySlug,
  getOrCreateDefaultTenant,
  extractTenantSlugFromRequest,
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

    const totalStages = stages.filter((s) => !s.isFinalState).length;
    const stageMap = new Map(stages.map((s) => [s.id, s]));

    const leads = await prisma.lead.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        currentStageId: true,
        assignedToUserName: true,
        lastModified: true,
        createdAt: true,
      },
    });

    const leadIds2 = leads.map((l) => l.id);
    const transitions = await prisma.stateTransition.findMany({
      where: { leadId: { in: leadIds2 } },
      include: { fromStage: true, toStage: true },
      orderBy: { triggeredAt: "asc" },
    });

    const transitionsByLead = new Map<string, typeof transitions>();
    for (const t of transitions) {
      const arr = transitionsByLead.get(t.leadId) || [];
      arr.push(t);
      transitionsByLead.set(t.leadId, arr);
    }

    const progress: Record<string, any> = {};

    for (const lead of leads) {
      const stage = lead.currentStageId
        ? stageMap.get(lead.currentStageId)
        : null;

      const stageOrder = stage?.order ?? 0;
      const pct =
        totalStages > 0
          ? Math.round((stageOrder / totalStages) * 100)
          : 0;

      const leadTransitions = transitionsByLead.get(lead.id) || [];
      const timeInStage = lead.lastModified
        ? Date.now() - new Date(lead.lastModified).getTime()
        : Date.now() - new Date(lead.createdAt).getTime();

      progress[lead.id] = {
        stageName: stage?.name || "New",
        stageColor: stage?.color || "#94a3b8",
        stageOrder: stage?.order ?? 0,
        totalStages,
        progressPct: Math.min(pct, 100),
        isFinal: stage?.isFinalState ?? false,
        assignedTo: lead.assignedToUserName,
        timeInStageMs: timeInStage,
        transitions: leadTransitions.map((t) => ({
          from: t.fromStage?.name || "—",
          to: t.toStage?.name || "—",
          at: t.triggeredAt,
          by: t.triggeredBy,
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
