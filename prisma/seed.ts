import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Setting up tenants...");
    const tenants = await setupDefaultTenants();

    for (const tenant of tenants) {
      console.log(`Setting up pipeline stages for ${tenant.slug}...`);
      await setupPipelineStages(tenant.id);

      console.log(`Setting up system roles for ${tenant.slug}...`);
      await setupSystemRoles(tenant.id);
    }

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

async function setupDefaultTenants() {
  const tenantDefinitions = [
    {
      name: "GoodFellow Organization",
      slug: "goodfellow",
      domain: "goodfellow.kenacloanmatrix.com",
    },
    {
      name: "Omama Training",
      slug: "omama-training",
      domain: "omama-training.kenacloanmatrix.com",
    },
  ];

  const tenants = [];

  for (const definition of tenantDefinitions) {
    let tenant = await prisma.tenant.findUnique({
      where: { slug: definition.slug },
    });

    if (!tenant) {
      console.log(`Creating tenant ${definition.slug}...`);
      tenant = await prisma.tenant.create({
        data: {
          name: definition.name,
          slug: definition.slug,
          domain: definition.domain,
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

    tenants.push(tenant);
  }

  return tenants;
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

async function setupSystemRoles(tenantId: string) {
  // Check if roles already exist
  const existingRoles = await prisma.systemRole.findMany({
    where: { tenantId },
  });

  if (existingRoles.length > 0) {
    console.log(
      `System roles already exist (${existingRoles.length} roles), skipping...`
    );
    return existingRoles;
  }

  // Define the system roles based on Mifos/Fineract roles
  const roleData = [
    {
      name: "BRANCH_MANAGER",
      displayName: "Branch Manager",
      description: "Branch manager with full branch access and approvals",
      permissions: [
        "VIEW_LEADS",
        "CREATE_LEADS",
        "EDIT_LEADS",
        "DELETE_LEADS",
        "APPROVE_LEADS",
        "VIEW_CLIENTS",
        "CREATE_CLIENTS",
        "EDIT_CLIENTS",
        "VIEW_LOANS",
        "APPROVE_LOANS",
        "DISBURSE_LOANS",
        "VIEW_REPORTS",
        "MANAGE_BRANCH",
      ],
    },
    {
      name: "LOAN_OFFICER",
      displayName: "Loan Officer",
      description: "Loan officer responsible for processing loan applications",
      permissions: [
        "VIEW_LEADS",
        "CREATE_LEADS",
        "EDIT_LEADS",
        "VIEW_CLIENTS",
        "CREATE_CLIENTS",
        "EDIT_CLIENTS",
        "VIEW_LOANS",
        "CREATE_LOANS",
        "EDIT_LOANS",
        "VIEW_REPORTS",
      ],
    },
    {
      name: "CREDIT_OFFICER",
      displayName: "Credit Officer",
      description: "Credit officer responsible for credit assessment and risk analysis",
      permissions: [
        "VIEW_LEADS",
        "EDIT_LEADS",
        "VIEW_CLIENTS",
        "VIEW_LOANS",
        "ASSESS_CREDIT",
        "VIEW_REPORTS",
        "RECOMMEND_LOANS",
      ],
    },
    {
      name: "COMPLIANCE",
      displayName: "Compliance",
      description: "Compliance officer for regulatory and policy compliance",
      permissions: [
        "VIEW_LEADS",
        "VIEW_CLIENTS",
        "VIEW_LOANS",
        "VIEW_REPORTS",
        "COMPLIANCE_CHECK",
        "VIEW_AUDIT_LOGS",
      ],
    },
    {
      name: "ACCOUNTANT",
      displayName: "Accountant",
      description: "Accountant for financial management and reconciliation",
      permissions: [
        "VIEW_LOANS",
        "VIEW_REPORTS",
        "VIEW_ACCOUNTING",
        "CREATE_JOURNAL_ENTRIES",
        "VIEW_JOURNAL_ENTRIES",
        "RECONCILE_ACCOUNTS",
        "VIEW_TELLERS",
        "VIEW_CASH_MANAGEMENT",
      ],
    },
    {
      name: "AUTHORISER",
      displayName: "Authoriser",
      description: "First level authoriser for loan approvals",
      permissions: [
        "VIEW_LEADS",
        "VIEW_CLIENTS",
        "VIEW_LOANS",
        "AUTHORISE_LOANS_L1",
        "VIEW_REPORTS",
      ],
    },
    {
      name: "AUTHORISER2",
      displayName: "Authoriser Level 2",
      description: "Second level authoriser for higher value loan approvals",
      permissions: [
        "VIEW_LEADS",
        "VIEW_CLIENTS",
        "VIEW_LOANS",
        "AUTHORISE_LOANS_L1",
        "AUTHORISE_LOANS_L2",
        "VIEW_REPORTS",
      ],
    },
  ];

  // Create roles
  console.log("Creating system roles...");
  const roles = await Promise.all(
    roleData.map((role) =>
      prisma.systemRole.create({
        data: {
          tenantId,
          name: role.name,
          displayName: role.displayName,
          description: role.description,
          permissions: role.permissions,
          isActive: true,
        },
      })
    )
  );
  console.log(`Created ${roles.length} system roles`);

  // Log the created roles
  roles.forEach((role) => {
    console.log(`  - ${role.displayName} (${role.name})`);
  });

  return roles;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
