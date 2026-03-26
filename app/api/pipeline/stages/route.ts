import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTenantBySlug,
  getOrCreateDefaultTenant,
  extractTenantSlugFromRequest,
} from "@/lib/tenant-service";

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
        select: { id: true },
      });
      const existingIds = existingStages.map((s) => s.id);

      // Determine which stages to create, update, or delete
      const incomingIds = stages
        .filter((s: any) => !s.id.startsWith("new-"))
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

      // Create or update stages
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const isNew = stage.id.startsWith("new-");

        if (isNew) {
          // Create new stage
          await tx.pipelineStage.create({
            data: {
              tenantId: tenant!.id,
              name: stage.name,
              description: stage.description || "",
              color: stage.color || "#3b82f6",
              order: i + 1,
              isActive: true,
              isInitialState: stage.isInitialState || false,
              isFinalState: stage.isFinalState || false,
              allowedTransitions: stage.allowedTransitions || [],
            },
          });
        } else {
          // Update existing stage
          await tx.pipelineStage.update({
            where: { id: stage.id },
            data: {
              name: stage.name,
              description: stage.description || "",
              color: stage.color || "#3b82f6",
              order: i + 1,
              isInitialState: stage.isInitialState || false,
              isFinalState: stage.isFinalState || false,
              allowedTransitions: stage.allowedTransitions || [],
            },
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
    return NextResponse.json(
      { error: "Failed to update pipeline stages" },
      { status: 500 }
    );
  }
}
