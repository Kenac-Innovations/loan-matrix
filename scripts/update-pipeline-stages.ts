import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

// Configuration - Update this to match your tenant
const TENANT_SLUG = "goodfellow"; // Change this to your tenant slug

const NEW_STAGES = [
  {
    name: "New Lead",
    description: "Initial stage for new leads",
    order: 1,
    color: "#6b7280", // Gray
    isInitialState: true,
    isFinalState: false,
  },
  {
    name: "Approval",
    description: "Lead is pending approval",
    order: 2,
    color: "#3b82f6", // Blue
    isInitialState: false,
    isFinalState: false,
  },
  {
    name: "Disbursement",
    description: "Loan has been disbursed",
    order: 3,
    color: "#22c55e", // Green
    isInitialState: false,
    isFinalState: true,
  },
];

async function updatePipelineStages() {
  console.log(`\n🔄 Updating pipeline stages for tenant: ${TENANT_SLUG}\n`);

  try {
    // Find the tenant
    const tenant = await prisma.tenant.findUnique({
      where: { slug: TENANT_SLUG },
    });

    if (!tenant) {
      console.error(`❌ Tenant with slug "${TENANT_SLUG}" not found!`);
      console.log("\nAvailable tenants:");
      const tenants = await prisma.tenant.findMany({
        select: { id: true, slug: true, name: true },
      });
      tenants.forEach((t) => console.log(`  - ${t.slug} (${t.name})`));
      return;
    }

    console.log(`✅ Found tenant: ${tenant.name} (ID: ${tenant.id})\n`);

    // Get existing stages
    const existingStages = await prisma.pipelineStage.findMany({
      where: { tenantId: tenant.id },
      orderBy: { order: "asc" },
    });

    console.log(`📋 Existing stages (${existingStages.length}):`);
    existingStages.forEach((s) => console.log(`  - ${s.name} (order: ${s.order})`));

    // Start transaction
    await prisma.$transaction(async (tx) => {
      // Step 1: Delete SLA configs for existing stages
      const deletedSlaConfigs = await tx.sLAConfig.deleteMany({
        where: {
          pipelineStageId: {
            in: existingStages.map((s) => s.id),
          },
        },
      });
      console.log(`\n🗑️  Deleted ${deletedSlaConfigs.count} SLA configs`);

      // Step 2: Delete validation rules for existing stages
      const deletedValidationRules = await tx.validationRule.deleteMany({
        where: {
          pipelineStageId: {
            in: existingStages.map((s) => s.id),
          },
        },
      });
      console.log(`🗑️  Deleted ${deletedValidationRules.count} validation rules`);

      // Step 3: Delete state transitions for leads in this tenant
      const leadsInTenant = await tx.lead.findMany({
        where: { tenantId: tenant.id },
        select: { id: true },
      });
      const leadIds = leadsInTenant.map((l) => l.id);

      if (leadIds.length > 0) {
        const deletedTransitions = await tx.stateTransition.deleteMany({
          where: {
            leadId: {
              in: leadIds,
            },
          },
        });
        console.log(`🗑️  Deleted ${deletedTransitions.count} state transitions`);
      }

      // Step 4: Update leads to have no current stage temporarily
      const updatedLeads = await tx.lead.updateMany({
        where: { tenantId: tenant.id },
        data: { currentStageId: null },
      });
      console.log(`📝 Updated ${updatedLeads.count} leads (removed stage reference)`);

      // Step 5: Delete existing pipeline stages
      const deletedStages = await tx.pipelineStage.deleteMany({
        where: { tenantId: tenant.id },
      });
      console.log(`🗑️  Deleted ${deletedStages.count} pipeline stages`);

      // Step 6: Create new pipeline stages
      console.log(`\n✨ Creating new pipeline stages...`);
      const createdStages = [];

      for (const stageData of NEW_STAGES) {
        const stage = await tx.pipelineStage.create({
          data: {
            tenantId: tenant.id,
            name: stageData.name,
            description: stageData.description,
            order: stageData.order,
            color: stageData.color,
            isActive: true,
            isInitialState: stageData.isInitialState,
            isFinalState: stageData.isFinalState,
            allowedTransitions: [],
          },
        });
        createdStages.push(stage);
        console.log(`  ✅ Created: ${stage.name} (ID: ${stage.id})`);
      }

      // Step 7: Update allowed transitions
      const newLeadStage = createdStages.find((s) => s.name === "New Lead");
      const approvalStage = createdStages.find((s) => s.name === "Approval");
      const disbursementStage = createdStages.find((s) => s.name === "Disbursement");

      if (newLeadStage && approvalStage) {
        await tx.pipelineStage.update({
          where: { id: newLeadStage.id },
          data: { allowedTransitions: [approvalStage.id] },
        });
        console.log(`  🔗 New Lead → Approval`);
      }

      if (approvalStage && disbursementStage) {
        await tx.pipelineStage.update({
          where: { id: approvalStage.id },
          data: { allowedTransitions: [disbursementStage.id] },
        });
        console.log(`  🔗 Approval → Disbursement`);
      }

      // Step 8: Set all leads to the initial stage (New Lead)
      if (newLeadStage && leadIds.length > 0) {
        const resetLeads = await tx.lead.updateMany({
          where: { tenantId: tenant.id },
          data: { currentStageId: newLeadStage.id },
        });
        console.log(`\n📝 Reset ${resetLeads.count} leads to "New Lead" stage`);
      }

      // Step 9: Create default SLA configs for each stage
      console.log(`\n⏱️  Creating default SLA configs...`);
      for (const stage of createdStages) {
        await tx.sLAConfig.create({
          data: {
            tenantId: tenant.id,
            pipelineStageId: stage.id,
            name: `${stage.name} SLA`,
            description: `Default SLA for ${stage.name} stage`,
            timeframe: 72, // 72 hours = 3 days
            timeUnit: "hours",
            escalationRules: {},
            notificationRules: {},
            enabled: true,
          },
        });
        console.log(`  ✅ Created SLA for: ${stage.name} (72 hours)`);
      }
    });

    console.log(`\n🎉 Pipeline stages updated successfully!\n`);

    // Show final result
    const finalStages = await prisma.pipelineStage.findMany({
      where: { tenantId: tenant.id },
      include: {
        slaConfigs: true,
      },
      orderBy: { order: "asc" },
    });

    console.log("📋 Final pipeline configuration:");
    finalStages.forEach((s) => {
      const sla = s.slaConfigs[0];
      console.log(
        `  ${s.order}. ${s.name} ${s.isInitialState ? "(Initial)" : ""} ${s.isFinalState ? "(Final)" : ""}`
      );
      console.log(`     Color: ${s.color}`);
      console.log(`     SLA: ${sla ? `${sla.timeframe} ${sla.timeUnit}` : "None"}`);
      console.log(`     Transitions to: ${s.allowedTransitions.length > 0 ? s.allowedTransitions.join(", ") : "None"}`);
    });

  } catch (error) {
    console.error("❌ Error updating pipeline stages:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
updatePipelineStages();
