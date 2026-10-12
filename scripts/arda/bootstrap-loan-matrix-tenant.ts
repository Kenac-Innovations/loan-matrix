#!/usr/bin/env tsx

import { prisma } from "@/lib/prisma";
import {
  ARDA_TENANT_SLUG,
  buildArdaTenantBootstrapPlan,
} from "@/lib/arda-tenant-bootstrap-plan";

const APPLY_FLAG = "--apply";

async function main() {
  const apply = process.argv.includes(APPLY_FLAG);
  const plan = buildArdaTenantBootstrapPlan();

  if (!apply) {
    console.log(JSON.stringify(plan, null, 2));
    console.log("Dry run only. Re-run with --apply to create the ARDA tenant.");
    return;
  }

  const existing = await prisma.tenant.findUnique({
    where: { slug: ARDA_TENANT_SLUG },
    include: {
      pipelineStages: {
        orderBy: { order: "asc" },
        select: { name: true },
      },
      _count: { select: { leads: true, inventoryItems: true } },
    },
  });

  if (existing) {
    const existingStageNames = existing.pipelineStages.map((stage) => stage.name);
    const plannedStageNames = plan.stages.map((stage) => stage.name);

    if (
      existing.name !== plan.tenant.name ||
      existing.domain !== plan.tenant.domain ||
      JSON.stringify(existingStageNames) !== JSON.stringify(plannedStageNames)
    ) {
      throw new Error(
        `Existing ARDA tenant does not match the approved fresh configuration. ` +
          `No records were changed. Existing leads: ${existing._count.leads}; inventory items: ${existing._count.inventoryItems}.`,
      );
    }

    console.log("ARDA Loan Matrix tenant already matches the approved configuration.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        ...plan.tenant,
        isActive: true,
        settings: {
          theme: "default",
          features: {
            statemachine: true,
            notifications: true,
          },
        },
      },
      select: { id: true },
    });

    const createdStages = await Promise.all(
      plan.stages.map((stage) =>
        tx.pipelineStage.create({
          data: {
            ...stage,
            tenantId: tenant.id,
            allowedTransitions: [],
          },
          select: { id: true, name: true },
        }),
      ),
    );

    const stageIds = new Map(createdStages.map((stage) => [stage.name, stage.id]));
    await Promise.all(
      createdStages.map((stage) =>
        tx.pipelineStage.update({
          where: { id: stage.id },
          data: {
            allowedTransitions: (plan.transitions[stage.name] || []).map(
              (name) => {
                const id = stageIds.get(name);
                if (!id) throw new Error(`Missing ARDA stage: ${name}`);
                return id;
              },
            ),
          },
        }),
      ),
    );
  });

  console.log("Created the fresh ARDA Loan Matrix tenant and workflow.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
