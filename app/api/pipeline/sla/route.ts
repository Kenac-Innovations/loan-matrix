import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTenantBySlug,
  getOrCreateDefaultTenant,
  extractTenantSlugFromRequest,
} from "@/lib/tenant-service";

/**
 * GET /api/pipeline/sla
 * Fetches all SLA configs for the current tenant
 */
export async function GET(request: NextRequest) {
  try {
    const tenantSlug = extractTenantSlugFromRequest(request);
    let tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      tenant = await getOrCreateDefaultTenant();
    }

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Fetch SLA configs with their associated pipeline stages
    const slaConfigs = await prisma.sLAConfig.findMany({
      where: {
        tenantId: tenant.id,
      },
      include: {
        pipelineStage: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by pipeline stage
    const stages = await prisma.pipelineStage.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
      },
      orderBy: { order: "asc" },
    });

    // Transform to the format expected by the frontend
    const stageSLAs = stages.map((stage) => {
      const stageConfigs = slaConfigs.filter(
        (config) => config.pipelineStageId === stage.id
      );

      return {
        id: stage.id,
        stageName: stage.name,
        stageId: stage.id,
        description: stage.description || `SLA for ${stage.name} stage`,
        slaLevels: stageConfigs.map((config) => ({
          id: config.id,
          name: config.name,
          timeframe: config.timeframe,
          timeUnit: config.timeUnit,
          escalation: (config.escalationRules as any)?.enabled || false,
          notifyTeam: (config.notificationRules as any)?.notifyTeam || false,
          notifyManager:
            (config.notificationRules as any)?.notifyManager || false,
          color: "#3b82f6", // Default color
        })),
      };
    });

    return NextResponse.json({ stageSLAs, stages });
  } catch (error) {
    console.error("Error fetching SLA configs:", error);
    return NextResponse.json(
      { error: "Failed to fetch SLA configs" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/pipeline/sla
 * Updates SLA configs for the current tenant
 */
export async function PUT(request: NextRequest) {
  try {
    const { stageSLAs } = await request.json();

    if (!stageSLAs || !Array.isArray(stageSLAs)) {
      return NextResponse.json(
        { error: "stageSLAs array is required" },
        { status: 400 }
      );
    }

    const tenantSlug = extractTenantSlugFromRequest(request);
    let tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      tenant = await getOrCreateDefaultTenant();
    }

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      for (const stageSLA of stageSLAs) {
        // Find the pipeline stage
        const stage = await tx.pipelineStage.findFirst({
          where: {
            tenantId: tenant!.id,
            name: stageSLA.stageName,
          },
        });

        if (!stage) continue;

        // Get existing SLA configs for this stage
        const existingConfigs = await tx.sLAConfig.findMany({
          where: {
            tenantId: tenant!.id,
            pipelineStageId: stage.id,
          },
        });

        const existingIds = existingConfigs.map((c) => c.id);
        const incomingIds = stageSLA.slaLevels
          .filter(
            (l: any) => !l.id.startsWith("new-") && !String(l.id).match(/^\d+$/)
          )
          .map((l: any) => l.id);

        // Delete removed SLA levels
        const toDelete = existingIds.filter((id) => !incomingIds.includes(id));
        if (toDelete.length > 0) {
          await tx.sLAConfig.deleteMany({
            where: { id: { in: toDelete } },
          });
        }

        // Create or update SLA levels
        for (const level of stageSLA.slaLevels) {
          const isNew =
            level.id.startsWith("new-") || String(level.id).match(/^\d+$/);

          const data = {
            tenantId: tenant!.id,
            pipelineStageId: stage.id,
            name: level.name,
            timeframe: level.timeframe,
            timeUnit: level.timeUnit,
            escalationRules: { enabled: level.escalation || false },
            notificationRules: {
              notifyTeam: level.notifyTeam || false,
              notifyManager: level.notifyManager || false,
            },
            enabled: true,
          };

          if (isNew) {
            await tx.sLAConfig.create({ data });
          } else {
            await tx.sLAConfig.update({
              where: { id: level.id },
              data,
            });
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating SLA configs:", error);
    return NextResponse.json(
      { error: "Failed to update SLA configs" },
      { status: 500 }
    );
  }
}
