import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  try {
    // Create or get default tenant
    console.log("Setting up default tenant...");
    const tenant = await setupDefaultTenant();

    // Setup pipeline stages for the tenant
    console.log("Setting up pipeline stages...");
    await setupPipelineStages(tenant.id);

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

async function setupDefaultTenant() {
  let tenant = await prisma.tenant.findUnique({
    where: { slug: "goodfellow" },
  });

  if (!tenant) {
    console.log("Creating tenant...");
    tenant = await prisma.tenant.create({
      data: {
        name: "GoodFellow Organization",
        slug: "goodfellow",
        settings: {
          theme: "default",
          features: {
            statemachine: true,
            notifications: true,
          },
        },
      },
    });
    console.log(`Tenant created: ${tenant.name} (${tenant.slug})`);
  } else {
    console.log(`Tenant already exists: ${tenant.name} (${tenant.slug})`);
  }

  return tenant;
}

async function setupPipelineStages(tenantId: string) {
  // Check if stages already exist
  const existingStages = await prisma.pipelineStage.findMany({
    where: { tenantId },
  });

  if (existingStages.length > 0) {
    console.log(
      `Pipeline stages already exist (${existingStages.length} stages), skipping...`
    );
    return existingStages;
  }

  const stageData = [
    {
      name: "New Lead",
      description: "Initial lead entry point",
      order: 1,
      color: "#3b82f6",
      isInitialState: true,
      isFinalState: false,
    },
    {
      name: "Approved",
      description: "Lead has been approved",
      order: 2,
      color: "#10b981",
      isInitialState: false,
      isFinalState: false,
    },
    {
      name: "Rejected",
      description: "Lead has been rejected",
      order: 3,
      color: "#ef4444",
      isInitialState: false,
      isFinalState: true,
    },
    {
      name: "Pending Disbursement",
      description: "Waiting for loan disbursement",
      order: 4,
      color: "#f59e0b",
      isInitialState: false,
      isFinalState: false,
    },
    {
      name: "Disbursed",
      description: "Loan has been disbursed",
      order: 5,
      color: "#10b981",
      isInitialState: false,
      isFinalState: true,
    },
  ];

  // Create stages
  console.log("Creating pipeline stages...");
  const stages = await Promise.all(
    stageData.map((stage) =>
      prisma.pipelineStage.create({
        data: {
          ...stage,
          tenantId,
          allowedTransitions: [], // Will be updated after all stages are created
        },
      })
    )
  );
  console.log(`Created ${stages.length} pipeline stages`);

  // Update allowed transitions
  console.log("Configuring stage transitions...");
  const stageMap = new Map(stages.map((stage) => [stage.name, stage.id]));

  const transitions = {
    "New Lead": ["Approved", "Rejected"],
    Approved: ["Pending Disbursement", "Rejected"],
    Rejected: [],
    "Pending Disbursement": ["Disbursed", "Rejected"],
    Disbursed: [],
  };

  await Promise.all(
    stages.map((stage) => {
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

  console.log("Stage transitions configured");

  // Log the created stages
  stages.forEach((stage) => {
    const transitions = stageData.find((s) => s.name === stage.name);
    console.log(`  - ${stage.name} (order: ${stage.order})`);
  });

  return stages;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
