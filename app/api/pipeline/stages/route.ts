import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTenantBySlug,
  getOrCreateDefaultTenant,
  extractTenantSlugFromRequest,
} from "@/lib/tenant-service";

class PipelineStageRequestError extends Error {}

/**
 * GET /api/pipeline/stages
 * Fetches all pipeline stages for the current tenant
 */
export async function GET(request: NextRequest) {
  try {
    // Get tenant from header or default
    const tenantSlug = extractTenantSlugFromRequest(request);
    let tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      tenant = await getOrCreateDefaultTenant();
    }

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const stages = await prisma.pipelineStage.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ stages });
  } catch (error) {
    console.error("Error fetching pipeline stages:", error);
    return NextResponse.json(
      { error: "Failed to fetch pipeline stages" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/pipeline/stages
 * Updates all pipeline stages for the current tenant
 */
export async function PUT(request: NextRequest) {
  try {
    const { stages } = await request.json();

    if (!stages || !Array.isArray(stages)) {
      return NextResponse.json(
        { error: "Stages array is required" },
        { status: 400 }
      );
    }

    // Get tenant from header or default
    const tenantSlug = extractTenantSlugFromRequest(request);
    let tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      tenant = await getOrCreateDefaultTenant();
    }

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Use a transaction to update all stages
    await prisma.$transaction(async (tx) => {
      // Get existing stage IDs
      const existingStages = await tx.pipelineStage.findMany({
        where: { tenantId: tenant!.id },
        select: { id: true, order: true },
      });
      const existingIds = existingStages.map((s) => s.id);

      const existingIdSet = new Set(existingIds);
      const incomingExistingIds = stages
        .filter((stage: any) => !String(stage.id || "").startsWith("new-"))
        .map((stage: any) => String(stage.id));
      const unknownIncomingIds = incomingExistingIds.filter(
        (id: string) => !existingIdSet.has(id)
      );

      // A tenant with no saved stages is shown the application's starter
      // pipeline. Those starter IDs are not database IDs yet, so save them as
      // new records. For an established tenant, reject stale or cross-tenant
      // IDs before any deletion can occur.
      if (existingStages.length > 0 && unknownIncomingIds.length > 0) {
        throw new PipelineStageRequestError(
          "The pipeline configuration has changed. Refresh the page before saving your changes."
        );
      }
      const isInitialTenantPipeline = existingStages.length === 0;

      // Determine which stages to create, update, or delete
      const incomingIds = stages
        .filter(
          (s: any) =>
            !String(s.id || "").startsWith("new-") && existingIdSet.has(s.id)
        )
        .map((s: any) => s.id);

      const stagesToDelete = existingIds.filter(
        (id) => !incomingIds.includes(id)
      );

      // Delete stages that are no longer present
      if (stagesToDelete.length > 0) {
        // First, update leads that are on these stages to the first stage
        const firstStage = stages[0];
        if (firstStage && !firstStage.id.startsWith("new-")) {
          await tx.lead.updateMany({
            where: {
              tenantId: tenant!.id,
              currentStageId: { in: stagesToDelete },
            },
            data: { currentStageId: firstStage.id },
          });
        }

        // Delete SLA configs for deleted stages
        await tx.sLAConfig.deleteMany({
          where: { pipelineStageId: { in: stagesToDelete } },
        });

        // Delete validation rules for deleted stages
        await tx.validationRule.deleteMany({
          where: { pipelineStageId: { in: stagesToDelete } },
        });

        // Delete stage approvals for deleted stages
        await tx.stageApproval.deleteMany({
          where: { stageId: { in: stagesToDelete } },
        });

        // Delete state transitions referencing deleted stages
        await tx.stateTransition.deleteMany({
          where: {
            OR: [
              { fromStageId: { in: stagesToDelete } },
              { toStageId: { in: stagesToDelete } },
            ],
          },
        });

        // Delete the stages
        await tx.pipelineStage.deleteMany({
          where: { id: { in: stagesToDelete } },
        });
      }

      // Avoid temporary collisions on the unique (tenantId, order) constraint
      // when stages are being reordered or swapped.
      const remainingExistingStages = existingStages.filter(
        (stage) => !stagesToDelete.includes(stage.id)
      );
      const orderOffset = stages.length + remainingExistingStages.length + 10;

      for (const stage of remainingExistingStages) {
        await tx.pipelineStage.update({
          where: { id: stage.id },
          data: { order: stage.order + orderOffset },
        });
      }

      // Create or update stages. During the first save, every displayed
      // starter stage becomes a new tenant-owned record.
      const stageIdMap = new Map<string, string>();
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const sourceId = String(stage.id || "");
        const isNew =
          isInitialTenantPipeline ||
          sourceId.startsWith("new-") ||
          !existingIdSet.has(sourceId);

        if (isNew) {
          const created = await tx.pipelineStage.create({
            data: {
              tenantId: tenant!.id,
              name: stage.name,
              description: stage.description || "",
              color: stage.color || "#3b82f6",
              order: i + 1,
              isActive: true,
              isInitialState: stage.isInitialState || false,
              isFinalState: stage.isFinalState || false,
              allowedTransitions: [],
              fineractStatus: stage.fineractStatus || null,
              fineractAction: stage.fineractAction || null,
              requiredApprovals: stage.requiredApprovals ?? 1,
              skipBelowAmount: stage.skipBelowAmount ?? null,
            },
          });
          stageIdMap.set(sourceId, created.id);
        } else {
          stageIdMap.set(sourceId, sourceId);
          await tx.pipelineStage.update({
            where: { id: stage.id },
            data: {
              name: stage.name,
              description: stage.description || "",
              color: stage.color || "#3b82f6",
              order: i + 1,
              isInitialState: stage.isInitialState || false,
              isFinalState: stage.isFinalState || false,
              allowedTransitions: [],
              fineractStatus: stage.fineractStatus || null,
              fineractAction: stage.fineractAction || null,
              requiredApprovals: stage.requiredApprovals ?? 1,
              skipBelowAmount: stage.skipBelowAmount ?? null,
            },
          });
        }
      }

      // All new IDs are known now, so keep transitions valid when a starter
      // pipeline or newly added stages are saved for the first time.
      for (const stage of stages) {
        const persistedStageId = stageIdMap.get(String(stage.id || ""));
        if (!persistedStageId) continue;

        const allowedTransitions = (stage.allowedTransitions || [])
          .map((id: unknown) => stageIdMap.get(String(id)))
          .filter((id: string | undefined): id is string => Boolean(id));

        await tx.pipelineStage.update({
          where: { id: persistedStageId },
          data: { allowedTransitions },
        });
      }

      // Leads created before a tenant saves its first pipeline do not yet have
      // a persisted stage. Attach only those orphaned leads to the configured
      // initial stage so the normal transition permissions can apply.
      if (isInitialTenantPipeline) {
        const initialStage = stages.find((stage: any) => stage.isInitialState);
        const initialStageId = initialStage
          ? stageIdMap.get(String(initialStage.id || ""))
          : undefined;

        if (initialStageId) {
          await tx.lead.updateMany({
            where: {
              tenantId: tenant!.id,
              currentStageId: null,
            },
            data: { currentStageId: initialStageId },
          });
        }
      }
    });

    // Fetch and return updated stages
    const updatedStages = await prisma.pipelineStage.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({
      success: true,
      stages: updatedStages,
    });
  } catch (error) {
    console.error("Error updating pipeline stages:", error);
    if (error instanceof PipelineStageRequestError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Failed to update pipeline stages" },
      { status: 500 }
    );
  }
}
