import { PrismaClient } from "@/app/generated/prisma";
import { getOrCreateDefaultTenant } from "./tenant-service";

const prisma = new PrismaClient();

export async function seedDefaultTenant() {
  try {
    console.log("🌱 Seeding default tenant...");

    // Create or get default tenant
    const tenant = await getOrCreateDefaultTenant();
    console.log(
      `✅ Default tenant created/found: ${tenant.name} (${tenant.slug})`
    );

    // Check if pipeline stages already exist
    const existingStages = await prisma.pipelineStage.findMany({
      where: { tenantId: tenant.id },
    });

    if (existingStages.length > 0) {
      console.log(`✅ Pipeline stages already exist for tenant ${tenant.name}`);
      return tenant;
    }

    console.log("🌱 Creating default pipeline stages...");

    // Create default pipeline stages
    const defaultStages = [
      {
        name: "New Lead",
        description: "Initial lead entry point",
        order: 1,
        color: "#3b82f6",
        isInitialState: true,
        allowedTransitions: [], // Will be updated after all stages are created
      },
      {
        name: "Approved",
        description: "Lead has been approved",
        order: 2,
        color: "#10b981",
        allowedTransitions: [],
      },
      {
        name: "Rejected",
        description: "Lead has been rejected",
        order: 3,
        color: "#ef4444",
        isFinalState: true,
        allowedTransitions: [],
      },
      {
        name: "Pending Disbursement",
        description: "Waiting for loan disbursement",
        order: 4,
        color: "#f59e0b",
        allowedTransitions: [],
      },
      {
        name: "Disbursed",
        description: "Loan has been disbursed",
        order: 5,
        color: "#10b981",
        isFinalState: true,
        allowedTransitions: [],
      },
    ];

    // Create stages
    const createdStages = await Promise.all(
      defaultStages.map((stage) =>
        prisma.pipelineStage.create({
          data: {
            ...stage,
            tenantId: tenant.id,
          },
        })
      )
    );

    console.log(`✅ Created ${createdStages.length} pipeline stages`);

    // Update allowed transitions
    const stageMap = new Map(
      createdStages.map((stage) => [stage.name, stage.id])
    );

    const transitions = {
      "New Lead": ["Approved", "Rejected"],
      Approved: ["Pending Disbursement", "Rejected"],
      Rejected: [],
      "Pending Disbursement": ["Disbursed", "Rejected"],
      Disbursed: [],
    };

    // Update each stage with its allowed transitions
    await Promise.all(
      createdStages.map((stage) => {
        const allowedTransitionNames =
          transitions[stage.name as keyof typeof transitions] || [];
        const allowedTransitionIds = allowedTransitionNames
          .map((name) => stageMap.get(name))
          .filter(Boolean) as string[];

        return prisma.pipelineStage.update({
          where: { id: stage.id },
          data: { allowedTransitions: allowedTransitionIds },
        });
      })
    );

    console.log("✅ Updated stage transitions");

    // Create some default validation rules
    const validationRules = [
      {
        name: "Required Fields Check",
        description: "Ensure all required fields are filled",
        conditions: {
          type: "required_fields",
          fields: ["firstname", "lastname", "emailAddress"],
        },
        actions: {
          onFailure: "block_transition",
          message: "Please fill in all required fields",
        },
        severity: "error",
        enabled: true,
        order: 1,
      },
      {
        name: "Email Validation",
        description: "Validate email format",
        conditions: {
          type: "email_format",
          field: "emailAddress",
        },
        actions: {
          onFailure: "show_warning",
          message: "Please enter a valid email address",
        },
        severity: "warning",
        enabled: true,
        order: 2,
      },
    ];

    await Promise.all(
      validationRules.map((rule) =>
        prisma.validationRule.create({
          data: {
            ...rule,
            tenantId: tenant.id,
          },
        })
      )
    );

    console.log(`✅ Created ${validationRules.length} validation rules`);

    // Create default SLA configurations
    const slaConfigs = [
      {
        name: "New Lead Response Time",
        description: "Respond to new leads within 24 hours",
        timeframe: 24,
        timeUnit: "hours",
        escalationRules: {
          levels: [
            {
              after: 12,
              unit: "hours",
              action: "notify_manager",
            },
            {
              after: 24,
              unit: "hours",
              action: "escalate_to_director",
            },
          ],
        },
        notificationRules: {
          channels: ["email", "slack"],
          recipients: ["assigned_user", "team_lead"],
        },
        enabled: true,
        pipelineStageId: createdStages.find((s) => s.name === "New Lead")?.id!,
      },
      {
        name: "Proposal Follow-up",
        description: "Follow up on proposals within 3 days",
        timeframe: 3,
        timeUnit: "days",
        escalationRules: {
          levels: [
            {
              after: 2,
              unit: "days",
              action: "notify_user",
            },
          ],
        },
        notificationRules: {
          channels: ["email"],
          recipients: ["assigned_user"],
        },
        enabled: true,
        pipelineStageId: createdStages.find((s) => s.name === "Proposal")?.id!,
      },
    ];

    await Promise.all(
      slaConfigs.map((sla) =>
        prisma.sLAConfig.create({
          data: {
            ...sla,
            tenantId: tenant.id,
          },
        })
      )
    );

    console.log(`✅ Created ${slaConfigs.length} SLA configurations`);

    console.log("🎉 Default tenant seeding completed successfully!");
    return tenant;
  } catch (error) {
    console.error("❌ Error seeding default tenant:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  seedDefaultTenant()
    .then(() => {
      console.log("✅ Seeding completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seeding failed:", error);
      process.exit(1);
    });
}
