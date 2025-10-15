import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  try {
    // Seed lookup tables first
    console.log("Seeding lookup tables...");
    await seedLookupTables();

    // Create or get default tenant
    console.log("Setting up default tenant...");
    const tenant = await setupDefaultTenant();

    // Setup pipeline stages for the tenant
    console.log("Setting up pipeline stages...");
    const stages = await setupPipelineStages(tenant.id);

    // Setup teams and team members
    console.log("Setting up teams...");
    const teams = await setupTeams(tenant.id, stages);

    // Setup SLA configurations
    console.log("Setting up SLA configurations...");
    await setupSLAConfigs(tenant.id, stages);

    // Setup validation rules
    console.log("Setting up validation rules...");
    await setupValidationRules(tenant.id, stages);

    // Seed sample leads
    console.log("Seeding sample leads...");
    const leads = await seedSampleLeads(tenant.id, stages, teams);

    // Seed sample documents
    console.log("Seeding sample documents...");
    await seedSampleDocuments(tenant.id, leads);

    // Seed sample communications
    console.log("Seeding sample communications...");
    await seedSampleCommunications(tenant.id, leads);

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

async function seedLookupTables() {
  // Seed offices
  await Promise.all([
    prisma.$executeRaw`INSERT INTO "Office" (name, description, "createdAt", "updatedAt") VALUES ('Head Office', 'Main headquarters', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    prisma.$executeRaw`INSERT INTO "Office" (name, description, "createdAt", "updatedAt") VALUES ('Branch Office', 'Branch location', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    prisma.$executeRaw`INSERT INTO "Office" (name, description, "createdAt", "updatedAt") VALUES ('Regional Office', 'Regional headquarters', NOW(), NOW()) ON CONFLICT DO NOTHING`,
  ]);

  // Seed legal forms
  await Promise.all([
    prisma.$executeRaw`INSERT INTO "LegalForm" (name, description, "createdAt", "updatedAt") VALUES ('Individual', 'Individual person', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    prisma.$executeRaw`INSERT INTO "LegalForm" (name, description, "createdAt", "updatedAt") VALUES ('Corporate', 'Corporate entity', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    prisma.$executeRaw`INSERT INTO "LegalForm" (name, description, "createdAt", "updatedAt") VALUES ('Partnership', 'Business partnership', NOW(), NOW()) ON CONFLICT DO NOTHING`,
  ]);

  // Seed genders
  await Promise.all([
    prisma.$executeRaw`INSERT INTO "Gender" (name, description, "createdAt", "updatedAt") VALUES ('Male', 'Male gender', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    prisma.$executeRaw`INSERT INTO "Gender" (name, description, "createdAt", "updatedAt") VALUES ('Female', 'Female gender', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    prisma.$executeRaw`INSERT INTO "Gender" (name, description, "createdAt", "updatedAt") VALUES ('Other', 'Other gender', NOW(), NOW()) ON CONFLICT DO NOTHING`,
  ]);

  // Seed client types
  await Promise.all([
    prisma.$executeRaw`INSERT INTO "ClientType" (name, description, "createdAt", "updatedAt") VALUES ('Individual', 'Individual client', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    prisma.$executeRaw`INSERT INTO "ClientType" (name, description, "createdAt", "updatedAt") VALUES ('Corporate', 'Corporate client', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    prisma.$executeRaw`INSERT INTO "ClientType" (name, description, "createdAt", "updatedAt") VALUES ('Group', 'Group client', NOW(), NOW()) ON CONFLICT DO NOTHING`,
  ]);

  // Seed client classifications
  await Promise.all([
    prisma.$executeRaw`INSERT INTO "ClientClassification" (name, description, "createdAt", "updatedAt") VALUES ('Standard', 'Standard client', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    prisma.$executeRaw`INSERT INTO "ClientClassification" (name, description, "createdAt", "updatedAt") VALUES ('Premium', 'Premium client', NOW(), NOW()) ON CONFLICT DO NOTHING`,
    prisma.$executeRaw`INSERT INTO "ClientClassification" (name, description, "createdAt", "updatedAt") VALUES ('VIP', 'VIP client', NOW(), NOW()) ON CONFLICT DO NOTHING`,
  ]);

  // Seed savings products
  await Promise.all([
    prisma.$executeRaw`INSERT INTO "SavingsProduct" (name, description, "interestRate", "minBalance", "createdAt", "updatedAt") VALUES ('Basic Savings', 'Basic savings account', 0.5, 0, NOW(), NOW()) ON CONFLICT DO NOTHING`,
    prisma.$executeRaw`INSERT INTO "SavingsProduct" (name, description, "interestRate", "minBalance", "createdAt", "updatedAt") VALUES ('Premium Savings', 'Premium savings account with higher interest', 1.5, 1000, NOW(), NOW()) ON CONFLICT DO NOTHING`,
    prisma.$executeRaw`INSERT INTO "SavingsProduct" (name, description, "interestRate", "minBalance", "createdAt", "updatedAt") VALUES ('Fixed Deposit', 'Fixed deposit account', 3.0, 5000, NOW(), NOW()) ON CONFLICT DO NOTHING`,
  ]);
}

async function setupDefaultTenant() {
  let tenant = await prisma.tenant.findUnique({
    where: { slug: "default" },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Default Organization",
        slug: "default",
        settings: {
          theme: "default",
          features: {
            statemachine: true,
            notifications: true,
          },
        },
      },
    });
  }

  return tenant;
}

async function setupPipelineStages(tenantId: string) {
  // Check if stages already exist
  const existingStages = await prisma.pipelineStage.findMany({
    where: { tenantId },
  });

  if (existingStages.length > 0) {
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
      name: "Qualification",
      description: "Lead qualification and assessment",
      order: 2,
      color: "#8b5cf6",
      isInitialState: false,
      isFinalState: false,
    },
    {
      name: "Proposal",
      description: "Proposal preparation and presentation",
      order: 3,
      color: "#ec4899",
      isInitialState: false,
      isFinalState: false,
    },
    {
      name: "Negotiation",
      description: "Terms negotiation and finalization",
      order: 4,
      color: "#f59e0b",
      isInitialState: false,
      isFinalState: false,
    },
    {
      name: "Closed Won",
      description: "Successfully closed deal",
      order: 5,
      color: "#10b981",
      isInitialState: false,
      isFinalState: true,
    },
    {
      name: "Closed Lost",
      description: "Deal lost or cancelled",
      order: 6,
      color: "#ef4444",
      isInitialState: false,
      isFinalState: true,
    },
  ];

  // Create stages
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

  // Update allowed transitions
  const stageMap = new Map(stages.map((stage) => [stage.name, stage.id]));

  const transitions = {
    "New Lead": ["Qualification", "Closed Lost"],
    Qualification: ["Proposal", "Closed Lost"],
    Proposal: ["Negotiation", "Closed Lost"],
    Negotiation: ["Closed Won", "Closed Lost"],
    "Closed Won": [],
    "Closed Lost": [],
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

  return stages;
}

async function setupTeams(tenantId: string, stages: any[]) {
  // Check if teams already exist
  const existingTeams = await prisma.team.findMany({
    where: { tenantId },
  });

  if (existingTeams.length > 0) {
    return existingTeams;
  }

  const teamsData = [
    {
      name: "Sales Team",
      description: "Responsible for new leads and qualification",
      pipelineStageIds: [
        stages.find((s) => s.name === "New Lead")?.id,
        stages.find((s) => s.name === "Qualification")?.id,
      ].filter(Boolean),
    },
    {
      name: "Business Development Team",
      description: "Handles proposals and presentations",
      pipelineStageIds: [stages.find((s) => s.name === "Proposal")?.id].filter(
        Boolean
      ),
    },
    {
      name: "Account Management Team",
      description: "Manages negotiations and deal closure",
      pipelineStageIds: [
        stages.find((s) => s.name === "Negotiation")?.id,
      ].filter(Boolean),
    },
    {
      name: "Management Team",
      description: "Oversees final stages and deal outcomes",
      pipelineStageIds: [
        stages.find((s) => s.name === "Closed Won")?.id,
        stages.find((s) => s.name === "Closed Lost")?.id,
      ].filter(Boolean),
    },
  ];

  const teams = await Promise.all(
    teamsData.map((team) =>
      prisma.team.create({
        data: {
          ...team,
          tenantId,
        },
      })
    )
  );

  // Create team members
  const teamMembersData = [
    {
      teamId: teams[0].id,
      userId: "user1",
      name: "Tendai Mukamuri",
      email: "tendai.mukamuri@company.com",
      role: "Sales Rep",
    },
    {
      teamId: teams[0].id,
      userId: "user2",
      name: "Chipo Nyamande",
      email: "chipo.nyamande@company.com",
      role: "Senior Sales Rep",
    },
    {
      teamId: teams[1].id,
      userId: "user3",
      name: "Blessing Chikwanha",
      email: "blessing.chikwanha@company.com",
      role: "Operations Specialist",
    },
    {
      teamId: teams[1].id,
      userId: "user4",
      name: "Rutendo Madziva",
      email: "rutendo.madziva@company.com",
      role: "Document Processor",
    },
    {
      teamId: teams[2].id,
      userId: "user5",
      name: "Takudzwa Moyo",
      email: "takudzwa.moyo@company.com",
      role: "Credit Analyst",
    },
    {
      teamId: teams[2].id,
      userId: "user6",
      name: "Vimbai Sibanda",
      email: "vimbai.sibanda@company.com",
      role: "Senior Credit Analyst",
    },
    {
      teamId: teams[3].id,
      userId: "user7",
      name: "Tinashe Dube",
      email: "tinashe.dube@company.com",
      role: "Manager",
    },
    {
      teamId: teams[3].id,
      userId: "user8",
      name: "Nyasha Gumbo",
      email: "nyasha.gumbo@company.com",
      role: "Director",
    },
  ];

  await Promise.all(
    teamMembersData.map((member) =>
      prisma.teamMember.create({
        data: member,
      })
    )
  );

  return teams;
}

async function setupSLAConfigs(tenantId: string, stages: any[]) {
  // Check if SLA configs already exist
  const existingSLAs = await prisma.sLAConfig.findMany({
    where: { tenantId },
  });

  if (existingSLAs.length > 0) {
    return existingSLAs;
  }

  const slaData = [
    {
      pipelineStageId: stages.find((s) => s.name === "New Lead")?.id,
      name: "New Lead Response SLA",
      description: "Time limit for initial lead response",
      timeframe: 24,
      timeUnit: "hours",
      escalationRules: { escalateAfter: "12h", escalateTo: "manager" },
      notificationRules: {
        notifyAt: ["6h", "12h"],
        notifyWho: ["assignee", "manager"],
      },
    },
    {
      pipelineStageId: stages.find((s) => s.name === "Qualification")?.id,
      name: "Qualification SLA",
      description: "Time limit for lead qualification",
      timeframe: 2,
      timeUnit: "days",
      escalationRules: { escalateAfter: "1.5d", escalateTo: "manager" },
      notificationRules: {
        notifyAt: ["1d", "1.5d"],
        notifyWho: ["assignee", "manager"],
      },
    },
    {
      pipelineStageId: stages.find((s) => s.name === "Proposal")?.id,
      name: "Proposal SLA",
      description: "Time limit for proposal preparation",
      timeframe: 3,
      timeUnit: "days",
      escalationRules: { escalateAfter: "2.5d", escalateTo: "manager" },
      notificationRules: {
        notifyAt: ["2d", "2.5d"],
        notifyWho: ["assignee", "manager"],
      },
    },
    {
      pipelineStageId: stages.find((s) => s.name === "Negotiation")?.id,
      name: "Negotiation SLA",
      description: "Time limit for negotiation completion",
      timeframe: 5,
      timeUnit: "days",
      escalationRules: { escalateAfter: "4d", escalateTo: "director" },
      notificationRules: {
        notifyAt: ["3d", "4d"],
        notifyWho: ["assignee", "director"],
      },
    },
  ].filter((sla) => sla.pipelineStageId); // Filter out any undefined stage IDs

  return await Promise.all(
    slaData.map((sla) =>
      prisma.sLAConfig.create({
        data: {
          ...sla,
          tenantId,
        },
      })
    )
  );
}

async function setupValidationRules(tenantId: string, stages: any[]) {
  // Check if validation rules already exist
  const existingRules = await prisma.validationRule.findMany({
    where: { tenantId },
  });

  if (existingRules.length > 0) {
    return existingRules;
  }

  const validationRulesData = [
    // Global validation rules (apply to all stages)
    {
      name: "Required Personal Information",
      description: "Ensures basic personal information is complete",
      conditions: {
        type: "AND",
        rules: [
          { field: "firstname", operator: "isNotEmpty" },
          { field: "lastname", operator: "isNotEmpty" },
          { field: "emailAddress", operator: "isNotEmpty" },
        ],
      },
      actions: {
        onPass: { message: "Personal information is complete" },
        onFail: {
          message: "Missing required personal information",
          suggestedAction: "Update Personal Information",
          actionUrl: "/edit?section=personal",
        },
      },
      severity: "error",
      enabled: true,
      order: 1,
      pipelineStageId: null, // Global rule
    },
    {
      name: "Contact Information Validation",
      description: "Validates contact information format and completeness",
      conditions: {
        type: "AND",
        rules: [
          { field: "mobileNo", operator: "isNotEmpty" },
          { field: "emailAddress", operator: "isValidEmail" },
        ],
      },
      actions: {
        onPass: { message: "Contact information is valid" },
        onFail: {
          message: "Invalid or missing contact information",
          suggestedAction: "Update Contact Information",
          actionUrl: "/edit?section=contact",
        },
      },
      severity: "error",
      enabled: true,
      order: 2,
      pipelineStageId: null, // Global rule
    },

    // New Lead stage specific rules
    {
      name: "Initial Lead Completeness",
      description:
        "Checks if lead has minimum required information for processing",
      conditions: {
        type: "AND",
        rules: [
          { field: "firstname", operator: "isNotEmpty" },
          { field: "lastname", operator: "isNotEmpty" },
          { field: "emailAddress", operator: "isNotEmpty" },
          { field: "mobileNo", operator: "isNotEmpty" },
        ],
      },
      actions: {
        onPass: { message: "Lead has minimum required information" },
        onFail: {
          message: "Lead is missing basic information required for processing",
          suggestedAction: "Complete Basic Information",
          actionUrl: "/edit?section=basic",
        },
      },
      severity: "error",
      enabled: true,
      order: 1,
      pipelineStageId: stages.find((s) => s.name === "New Lead")?.id,
    },

    // Qualification stage specific rules
    {
      name: "Financial Information Assessment",
      description: "Validates financial information for qualification",
      conditions: {
        type: "OR",
        rules: [
          { field: "monthlyIncome", operator: "isNotEmpty" },
          { field: "annualIncome", operator: "isNotEmpty" },
        ],
      },
      actions: {
        onPass: {
          message: "Financial information is available for assessment",
        },
        onFail: {
          message: "Financial information is required for qualification",
          suggestedAction: "Add Financial Information",
          actionUrl: "/edit?section=financial",
        },
      },
      severity: "warning",
      enabled: true,
      order: 1,
      pipelineStageId: stages.find((s) => s.name === "Qualification")?.id,
    },
    {
      name: "Employment Verification",
      description: "Validates employment information",
      conditions: {
        type: "AND",
        rules: [
          { field: "employmentStatus", operator: "isNotEmpty" },
          { field: "employerName", operator: "isNotEmpty" },
        ],
      },
      actions: {
        onPass: { message: "Employment information is complete" },
        onFail: {
          message: "Employment information is incomplete",
          suggestedAction: "Update Employment Details",
          actionUrl: "/edit?section=employment",
        },
      },
      severity: "warning",
      enabled: true,
      order: 2,
      pipelineStageId: stages.find((s) => s.name === "Qualification")?.id,
    },

    // Proposal stage specific rules
    {
      name: "Loan Request Completeness",
      description: "Validates loan request information",
      conditions: {
        type: "AND",
        rules: [
          { field: "requestedAmount", operator: "isNotEmpty" },
          { field: "loanPurpose", operator: "isNotEmpty" },
          { field: "loanTerm", operator: "isNotEmpty" },
        ],
      },
      actions: {
        onPass: { message: "Loan request information is complete" },
        onFail: {
          message: "Loan request information is incomplete",
          suggestedAction: "Complete Loan Request",
          actionUrl: "/edit?section=loan",
        },
      },
      severity: "error",
      enabled: true,
      order: 1,
      pipelineStageId: stages.find((s) => s.name === "Proposal")?.id,
    },
    {
      name: "Document Verification",
      description: "Ensures required documents are uploaded and verified",
      conditions: {
        type: "AND",
        rules: [{ field: "documents", operator: "hasMinimumCount", value: 1 }],
      },
      actions: {
        onPass: { message: "Required documents are available" },
        onFail: {
          message: "Required documents are missing",
          suggestedAction: "Upload Required Documents",
          actionUrl: "/documents",
        },
      },
      severity: "error",
      enabled: true,
      order: 2,
      pipelineStageId: stages.find((s) => s.name === "Proposal")?.id,
    },

    // Negotiation stage specific rules
    {
      name: "Credit Score Assessment",
      description: "Validates credit score meets minimum requirements",
      conditions: {
        type: "AND",
        rules: [
          { field: "creditScore", operator: "isNotEmpty" },
          { field: "creditScore", operator: "greaterThanOrEqual", value: 550 },
        ],
      },
      actions: {
        onPass: { message: "Credit score meets minimum requirements" },
        onFail: {
          message: "Credit score is below minimum requirement (550)",
          suggestedAction: "Review Credit Assessment",
          actionUrl: "?tab=risk",
        },
      },
      severity: "error",
      enabled: true,
      order: 1,
      pipelineStageId: stages.find((s) => s.name === "Negotiation")?.id,
    },
    {
      name: "Debt-to-Income Ratio Check",
      description: "Validates debt-to-income ratio is within acceptable limits",
      conditions: {
        type: "AND",
        rules: [
          { field: "monthlyIncome", operator: "isNotEmpty" },
          { field: "totalDebt", operator: "isNotEmpty" },
          {
            field: "debtToIncomeRatio",
            operator: "lessThanOrEqual",
            value: 0.4,
          },
        ],
      },
      actions: {
        onPass: { message: "Debt-to-income ratio is within acceptable limits" },
        onFail: {
          message: "Debt-to-income ratio exceeds recommended maximum (40%)",
          suggestedAction: "Review Financial Terms",
          actionUrl: "?tab=financials",
        },
      },
      severity: "warning",
      enabled: true,
      order: 2,
      pipelineStageId: stages.find((s) => s.name === "Negotiation")?.id,
    },
    {
      name: "Collateral Adequacy",
      description: "Validates collateral value is adequate for loan amount",
      conditions: {
        type: "AND",
        rules: [
          { field: "collateralValue", operator: "isNotEmpty" },
          { field: "requestedAmount", operator: "isNotEmpty" },
          {
            field: "collateralRatio",
            operator: "greaterThanOrEqual",
            value: 1.2,
          },
        ],
      },
      actions: {
        onPass: { message: "Collateral value is adequate" },
        onFail: {
          message:
            "Collateral value may be insufficient for requested loan amount",
          suggestedAction: "Review Collateral Assessment",
          actionUrl: "?tab=collateral",
        },
      },
      severity: "warning",
      enabled: true,
      order: 3,
      pipelineStageId: stages.find((s) => s.name === "Negotiation")?.id,
    },
  ].filter((rule) => rule.pipelineStageId !== undefined); // Filter out rules with undefined stage IDs

  const rules = await Promise.all(
    validationRulesData.map((rule) =>
      prisma.validationRule.create({
        data: {
          ...rule,
          tenantId,
        },
      })
    )
  );

  return rules;
}

async function seedSampleLeads(tenantId: string, stages: any[], teams: any[]) {
  // Check if leads already exist
  const existingLeads = await prisma.lead.findMany({
    where: { tenantId },
  });

  if (existingLeads.length > 0) {
    return existingLeads;
  }

  const sampleLeads = [
    // New Lead Stage (12 leads)
    {
      firstname: "Tendai",
      lastname: "Mukamuri",
      emailAddress: "tendai.mukamuri@email.com",
      mobileNo: "771234567",
      countryCode: "+263",
      dateOfBirth: new Date("1985-03-15"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user1",
      // Financial Information
      creditScore: 720,
      annualIncome: 45000,
      monthlyIncome: 3750,
      monthlyExpenses: 2800,
      employmentStatus: "EMPLOYED",
      employerName: "ABC Corporation",
      yearsEmployed: 3.5,
      bankName: "Standard Bank",
      existingLoans: 1,
      totalDebt: 15000,
      // Loan Request
      requestedAmount: 25000,
      loanPurpose: "Business expansion",
      loanTerm: 36,
      collateralType: "Property",
      collateralValue: 50000,
      // Risk Assessment
      riskScore: 35,
      riskCategory: "LOW",
      riskFactors: [
        "Stable employment",
        "Good credit history",
        "Adequate collateral",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Chipo",
      lastname: "Nyamande",
      emailAddress: "chipo.nyamande@email.com",
      mobileNo: "772345678",
      countryCode: "+263",
      dateOfBirth: new Date("1987-08-20"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user1",
      // Financial Information
      creditScore: 680,
      annualIncome: 38000,
      monthlyIncome: 3167,
      monthlyExpenses: 2400,
      employmentStatus: "EMPLOYED",
      employerName: "Ministry of Education",
      yearsEmployed: 5.2,
      bankName: "CBZ Bank",
      existingLoans: 0,
      totalDebt: 8000,
      // Loan Request
      requestedAmount: 15000,
      loanPurpose: "Home improvement",
      loanTerm: 24,
      collateralType: "Salary",
      collateralValue: 38000,
      // Risk Assessment
      riskScore: 25,
      riskCategory: "LOW",
      riskFactors: ["Government employee", "Stable income", "Low debt ratio"],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Blessing",
      lastname: "Chikwanha",
      emailAddress: "blessing.chikwanha@email.com",
      mobileNo: "773456789",
      countryCode: "+263",
      dateOfBirth: new Date("1979-12-05"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user2",
      // Financial Information
      creditScore: 750,
      annualIncome: 65000,
      monthlyIncome: 5417,
      monthlyExpenses: 3800,
      employmentStatus: "SELF_EMPLOYED",
      employerName: "Chikwanha Construction",
      yearsEmployed: 8.0,
      bankName: "FBC Bank",
      existingLoans: 2,
      totalDebt: 35000,
      // Loan Request
      requestedAmount: 80000,
      loanPurpose: "Business expansion",
      loanTerm: 60,
      collateralType: "Property",
      collateralValue: 120000,
      // Risk Assessment
      riskScore: 40,
      riskCategory: "MEDIUM",
      riskFactors: [
        "Self-employed",
        "Multiple existing loans",
        "Good collateral coverage",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Rutendo",
      lastname: "Madziva",
      emailAddress: "rutendo.madziva@email.com",
      mobileNo: "774567890",
      countryCode: "+263",
      dateOfBirth: new Date("1991-04-18"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user1",
      // Financial Information
      creditScore: 620,
      annualIncome: 28000,
      monthlyIncome: 2333,
      monthlyExpenses: 1900,
      employmentStatus: "EMPLOYED",
      employerName: "Delta Corporation",
      yearsEmployed: 2.5,
      bankName: "Steward Bank",
      existingLoans: 1,
      totalDebt: 12000,
      // Loan Request
      requestedAmount: 20000,
      loanPurpose: "Education",
      loanTerm: 36,
      collateralType: "Guarantor",
      collateralValue: 30000,
      // Risk Assessment
      riskScore: 55,
      riskCategory: "MEDIUM",
      riskFactors: [
        "Young professional",
        "Limited credit history",
        "Stable employment",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Takudzwa",
      lastname: "Moyo",
      emailAddress: "takudzwa.moyo@email.com",
      mobileNo: "775678901",
      countryCode: "+263",
      dateOfBirth: new Date("1983-06-12"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user2",
      // Financial Information
      creditScore: 700,
      annualIncome: 52000,
      monthlyIncome: 4333,
      monthlyExpenses: 3200,
      employmentStatus: "EMPLOYED",
      employerName: "Econet Wireless",
      yearsEmployed: 6.5,
      bankName: "Standard Chartered",
      existingLoans: 1,
      totalDebt: 18000,
      // Loan Request
      requestedAmount: 35000,
      loanPurpose: "Vehicle purchase",
      loanTerm: 48,
      collateralType: "Vehicle",
      collateralValue: 45000,
      // Risk Assessment
      riskScore: 30,
      riskCategory: "LOW",
      riskFactors: [
        "Established professional",
        "Good credit history",
        "Asset-backed loan",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Vimbai",
      lastname: "Sibanda",
      emailAddress: "vimbai.sibanda@email.com",
      mobileNo: "776789012",
      countryCode: "+263",
      dateOfBirth: new Date("1989-10-25"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user1",
      // Financial Information
      creditScore: 590,
      annualIncome: 24000,
      monthlyIncome: 2000,
      monthlyExpenses: 1600,
      employmentStatus: "EMPLOYED",
      employerName: "OK Zimbabwe",
      yearsEmployed: 1.8,
      bankName: "CABS",
      existingLoans: 0,
      totalDebt: 5000,
      // Loan Request
      requestedAmount: 10000,
      loanPurpose: "Medical expenses",
      loanTerm: 18,
      collateralType: "Salary",
      collateralValue: 24000,
      // Risk Assessment
      riskScore: 65,
      riskCategory: "MEDIUM",
      riskFactors: ["New employee", "Limited savings", "Medical emergency"],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Tinashe",
      lastname: "Dube",
      emailAddress: "tinashe.dube@email.com",
      mobileNo: "777890123",
      countryCode: "+263",
      dateOfBirth: new Date("1976-02-14"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user2",
      // Financial Information
      creditScore: 780,
      annualIncome: 85000,
      monthlyIncome: 7083,
      monthlyExpenses: 4500,
      employmentStatus: "EMPLOYED",
      employerName: "Reserve Bank of Zimbabwe",
      yearsEmployed: 12.0,
      bankName: "Standard Bank",
      existingLoans: 1,
      totalDebt: 25000,
      // Loan Request
      requestedAmount: 100000,
      loanPurpose: "Property investment",
      loanTerm: 84,
      collateralType: "Property",
      collateralValue: 180000,
      // Risk Assessment
      riskScore: 15,
      riskCategory: "LOW",
      riskFactors: [
        "Senior banker",
        "Excellent credit",
        "High-value collateral",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Nyasha",
      lastname: "Gumbo",
      emailAddress: "nyasha.gumbo@email.com",
      mobileNo: "778901234",
      countryCode: "+263",
      dateOfBirth: new Date("1993-07-08"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user1",
      // Financial Information
      creditScore: 640,
      annualIncome: 32000,
      monthlyIncome: 2667,
      monthlyExpenses: 2100,
      employmentStatus: "EMPLOYED",
      employerName: "Zimpapers",
      yearsEmployed: 3.0,
      bankName: "NMB Bank",
      existingLoans: 0,
      totalDebt: 6000,
      // Loan Request
      requestedAmount: 18000,
      loanPurpose: "Wedding expenses",
      loanTerm: 30,
      collateralType: "Salary",
      collateralValue: 32000,
      // Risk Assessment
      riskScore: 50,
      riskCategory: "MEDIUM",
      riskFactors: ["Young professional", "First-time borrower", "Stable job"],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Farai",
      lastname: "Mutasa",
      emailAddress: "farai.mutasa@email.com",
      mobileNo: "779012345",
      countryCode: "+263",
      dateOfBirth: new Date("1988-11-22"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user2",
      // Financial Information
      creditScore: 710,
      annualIncome: 48000,
      monthlyIncome: 4000,
      monthlyExpenses: 3000,
      employmentStatus: "EMPLOYED",
      employerName: "Zimplats",
      yearsEmployed: 4.5,
      bankName: "Barclays Bank",
      existingLoans: 1,
      totalDebt: 22000,
      // Loan Request
      requestedAmount: 40000,
      loanPurpose: "Home purchase",
      loanTerm: 72,
      collateralType: "Property",
      collateralValue: 65000,
      // Risk Assessment
      riskScore: 35,
      riskCategory: "LOW",
      riskFactors: ["Mining sector employee", "Good income", "Property-backed"],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Tariro",
      lastname: "Ncube",
      emailAddress: "tariro.ncube@email.com",
      mobileNo: "780123456",
      countryCode: "+263",
      dateOfBirth: new Date("1992-05-30"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user1",
      // Financial Information
      creditScore: 600,
      annualIncome: 26000,
      monthlyIncome: 2167,
      monthlyExpenses: 1800,
      employmentStatus: "EMPLOYED",
      employerName: "Telecel Zimbabwe",
      yearsEmployed: 2.0,
      bankName: "Ecobank",
      existingLoans: 0,
      totalDebt: 4000,
      // Loan Request
      requestedAmount: 12000,
      loanPurpose: "Business startup",
      loanTerm: 24,
      collateralType: "Guarantor",
      collateralValue: 20000,
      // Risk Assessment
      riskScore: 60,
      riskCategory: "MEDIUM",
      riskFactors: [
        "New business venture",
        "Limited credit history",
        "Young entrepreneur",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Munyaradzi",
      lastname: "Chigumba",
      emailAddress: "munyaradzi.chigumba@email.com",
      mobileNo: "781234567",
      countryCode: "+263",
      dateOfBirth: new Date("1984-09-17"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user2",
      // Financial Information
      creditScore: 690,
      annualIncome: 42000,
      monthlyIncome: 3500,
      monthlyExpenses: 2600,
      employmentStatus: "EMPLOYED",
      employerName: "ZESA Holdings",
      yearsEmployed: 7.0,
      bankName: "ZB Bank",
      existingLoans: 1,
      totalDebt: 16000,
      // Loan Request
      requestedAmount: 28000,
      loanPurpose: "Debt consolidation",
      loanTerm: 42,
      collateralType: "Salary",
      collateralValue: 42000,
      // Risk Assessment
      riskScore: 40,
      riskCategory: "MEDIUM",
      riskFactors: [
        "Utility sector employee",
        "Debt consolidation purpose",
        "Stable income",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Chiedza",
      lastname: "Mapfumo",
      emailAddress: "chiedza.mapfumo@email.com",
      mobileNo: "782345678",
      countryCode: "+263",
      dateOfBirth: new Date("1990-01-12"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user1",
      // Financial Information
      creditScore: 660,
      annualIncome: 35000,
      monthlyIncome: 2917,
      monthlyExpenses: 2200,
      employmentStatus: "EMPLOYED",
      employerName: "University of Zimbabwe",
      yearsEmployed: 4.0,
      bankName: "POSB",
      existingLoans: 0,
      totalDebt: 7000,
      // Loan Request
      requestedAmount: 22000,
      loanPurpose: "Further education",
      loanTerm: 36,
      collateralType: "Salary",
      collateralValue: 35000,
      // Risk Assessment
      riskScore: 45,
      riskCategory: "MEDIUM",
      riskFactors: [
        "Academic sector",
        "Education investment",
        "Stable employment",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },

    // Qualification Stage (10 leads)
    {
      firstname: "Simbarashe",
      lastname: "Mhango",
      emailAddress: "simbarashe.mhango@email.com",
      mobileNo: "783456789",
      countryCode: "+263",
      dateOfBirth: new Date("1990-07-22"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user3",
      // Financial Information
      creditScore: 665,
      annualIncome: 36000,
      monthlyIncome: 3000,
      monthlyExpenses: 2300,
      employmentStatus: "EMPLOYED",
      employerName: "National Foods",
      yearsEmployed: 4.2,
      yearsAtCurrentJob: "3_5_years",
      bankName: "CBZ Bank",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 14000,
      monthlyDebtPayments: 450,
      propertyOwnership: "RENT",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 20000,
      loanPurpose: "Home improvement",
      loanTerm: 36,
      collateralType: "Salary",
      collateralValue: 36000,
      // Risk Assessment
      riskScore: 45,
      riskCategory: "MEDIUM",
      riskFactors: [
        "Stable employment",
        "Existing debt obligations",
        "Good payment history",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Tsitsi",
      lastname: "Makoni",
      emailAddress: "tsitsi.makoni@email.com",
      mobileNo: "784567890",
      countryCode: "+263",
      dateOfBirth: new Date("1984-11-30"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user4",
      // Financial Information
      creditScore: 730,
      annualIncome: 58000,
      monthlyIncome: 4833,
      monthlyExpenses: 3200,
      employmentStatus: "EMPLOYED",
      employerName: "Old Mutual",
      yearsEmployed: 7.5,
      yearsAtCurrentJob: "5_10_years",
      bankName: "Standard Bank",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 28000,
      monthlyDebtPayments: 850,
      propertyOwnership: "OWN",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 45000,
      loanPurpose: "Business expansion",
      loanTerm: 60,
      collateralType: "Property",
      collateralValue: 85000,
      // Risk Assessment
      riskScore: 25,
      riskCategory: "LOW",
      riskFactors: [
        "Excellent credit history",
        "Property owner",
        "Stable income",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Ropafadzo",
      lastname: "Chidziva",
      emailAddress: "ropafadzo.chidziva@email.com",
      mobileNo: "785678901",
      countryCode: "+263",
      dateOfBirth: new Date("1986-05-16"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user3",
      // Financial Information
      creditScore: 610,
      annualIncome: 30000,
      monthlyIncome: 2500,
      monthlyExpenses: 2000,
      employmentStatus: "EMPLOYED",
      employerName: "City Council",
      yearsEmployed: 3.8,
      yearsAtCurrentJob: "3_5_years",
      bankName: "POSB",
      existingLoans: 0,
      hasExistingLoans: false,
      totalDebt: 8000,
      monthlyDebtPayments: 200,
      propertyOwnership: "FAMILY",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 15000,
      loanPurpose: "Education",
      loanTerm: 24,
      collateralType: "Guarantor",
      collateralValue: 25000,
      // Risk Assessment
      riskScore: 55,
      riskCategory: "MEDIUM",
      riskFactors: [
        "Government employee",
        "Limited credit history",
        "Family support",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Tafadzwa",
      lastname: "Mushonga",
      emailAddress: "tafadzwa.mushonga@email.com",
      mobileNo: "786789012",
      countryCode: "+263",
      dateOfBirth: new Date("1981-09-03"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user4",
      // Financial Information
      creditScore: 745,
      annualIncome: 72000,
      monthlyIncome: 6000,
      monthlyExpenses: 4200,
      employmentStatus: "SELF_EMPLOYED",
      employerName: "Mushonga Consulting",
      yearsEmployed: 9.0,
      yearsAtCurrentJob: "over_10_years",
      bankName: "FBC Bank",
      existingLoans: 2,
      hasExistingLoans: true,
      totalDebt: 45000,
      monthlyDebtPayments: 1200,
      propertyOwnership: "OWN",
      businessOwnership: true,
      businessType: "Consulting Services",
      // Loan Request
      requestedAmount: 60000,
      loanPurpose: "Business expansion",
      loanTerm: 48,
      collateralType: "Property",
      collateralValue: 120000,
      // Risk Assessment
      riskScore: 35,
      riskCategory: "LOW",
      riskFactors: [
        "Established business",
        "Property owner",
        "Strong cash flow",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Fungai",
      lastname: "Zimunya",
      emailAddress: "fungai.zimunya@email.com",
      mobileNo: "787890123",
      countryCode: "+263",
      dateOfBirth: new Date("1988-01-27"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user3",
      // Financial Information
      creditScore: 580,
      annualIncome: 22000,
      monthlyIncome: 1833,
      monthlyExpenses: 1500,
      employmentStatus: "EMPLOYED",
      employerName: "Pick n Pay",
      yearsEmployed: 2.2,
      yearsAtCurrentJob: "1_3_years",
      bankName: "Steward Bank",
      existingLoans: 0,
      hasExistingLoans: false,
      totalDebt: 3000,
      monthlyDebtPayments: 150,
      propertyOwnership: "RENT",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 8000,
      loanPurpose: "Emergency expenses",
      loanTerm: 18,
      collateralType: "Salary",
      collateralValue: 22000,
      // Risk Assessment
      riskScore: 70,
      riskCategory: "HIGH",
      riskFactors: [
        "Low income",
        "Limited employment history",
        "Emergency loan",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Panashe",
      lastname: "Mujuru",
      emailAddress: "panashe.mujuru@email.com",
      mobileNo: "788901234",
      countryCode: "+263",
      dateOfBirth: new Date("1977-12-11"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user4",
      // Financial Information
      creditScore: 760,
      annualIncome: 95000,
      monthlyIncome: 7917,
      monthlyExpenses: 5200,
      employmentStatus: "EMPLOYED",
      employerName: "Anglo American",
      yearsEmployed: 15.0,
      yearsAtCurrentJob: "over_10_years",
      bankName: "Standard Chartered",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 35000,
      monthlyDebtPayments: 1100,
      propertyOwnership: "OWN",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 120000,
      loanPurpose: "Property investment",
      loanTerm: 84,
      collateralType: "Property",
      collateralValue: 200000,
      // Risk Assessment
      riskScore: 15,
      riskCategory: "LOW",
      riskFactors: [
        "Senior executive",
        "Excellent credit",
        "High-value collateral",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Ruvimbo",
      lastname: "Chitongo",
      emailAddress: "ruvimbo.chitongo@email.com",
      mobileNo: "789012345",
      countryCode: "+263",
      dateOfBirth: new Date("1985-04-08"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user3",
      // Financial Information
      creditScore: 650,
      annualIncome: 40000,
      monthlyIncome: 3333,
      monthlyExpenses: 2600,
      employmentStatus: "EMPLOYED",
      employerName: "CIMAS Medical Aid",
      yearsEmployed: 5.5,
      yearsAtCurrentJob: "5_10_years",
      bankName: "NMB Bank",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 18000,
      monthlyDebtPayments: 550,
      propertyOwnership: "RENT",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 30000,
      loanPurpose: "Vehicle purchase",
      loanTerm: 48,
      collateralType: "Vehicle",
      collateralValue: 40000,
      // Risk Assessment
      riskScore: 40,
      riskCategory: "MEDIUM",
      riskFactors: [
        "Healthcare sector",
        "Asset-backed loan",
        "Stable employment",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Tapiwa",
      lastname: "Mandaza",
      emailAddress: "tapiwa.mandaza@email.com",
      mobileNo: "790123456",
      countryCode: "+263",
      dateOfBirth: new Date("1982-08-25"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user4",
      // Financial Information
      creditScore: 695,
      annualIncome: 50000,
      monthlyIncome: 4167,
      monthlyExpenses: 3100,
      employmentStatus: "EMPLOYED",
      employerName: "NetOne",
      yearsEmployed: 6.8,
      yearsAtCurrentJob: "5_10_years",
      bankName: "Barclays Bank",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 22000,
      monthlyDebtPayments: 650,
      propertyOwnership: "OWN",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 35000,
      loanPurpose: "Home renovation",
      loanTerm: 42,
      collateralType: "Property",
      collateralValue: 70000,
      // Risk Assessment
      riskScore: 30,
      riskCategory: "LOW",
      riskFactors: ["Telecom sector", "Property owner", "Good credit history"],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Chenai",
      lastname: "Rusike",
      emailAddress: "chenai.rusike@email.com",
      mobileNo: "791234567",
      countryCode: "+263",
      dateOfBirth: new Date("1989-12-14"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user3",
      // Financial Information
      creditScore: 625,
      annualIncome: 33000,
      monthlyIncome: 2750,
      monthlyExpenses: 2200,
      employmentStatus: "EMPLOYED",
      employerName: "ZBC Holdings",
      yearsEmployed: 3.5,
      yearsAtCurrentJob: "3_5_years",
      bankName: "Ecobank",
      existingLoans: 0,
      hasExistingLoans: false,
      totalDebt: 9000,
      monthlyDebtPayments: 300,
      propertyOwnership: "FAMILY",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 18000,
      loanPurpose: "Business startup",
      loanTerm: 30,
      collateralType: "Guarantor",
      collateralValue: 28000,
      // Risk Assessment
      riskScore: 50,
      riskCategory: "MEDIUM",
      riskFactors: ["New business venture", "Media sector", "Family support"],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Kudakwashe",
      lastname: "Pfende",
      emailAddress: "kudakwashe.pfende@email.com",
      mobileNo: "792345678",
      countryCode: "+263",
      dateOfBirth: new Date("1983-06-19"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user4",
      // Financial Information
      creditScore: 710,
      annualIncome: 55000,
      monthlyIncome: 4583,
      monthlyExpenses: 3400,
      employmentStatus: "EMPLOYED",
      employerName: "ZESA Holdings",
      yearsEmployed: 8.2,
      yearsAtCurrentJob: "5_10_years",
      bankName: "ZB Bank",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 25000,
      monthlyDebtPayments: 750,
      propertyOwnership: "OWN",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 40000,
      loanPurpose: "Debt consolidation",
      loanTerm: 48,
      collateralType: "Property",
      collateralValue: 80000,
      // Risk Assessment
      riskScore: 35,
      riskCategory: "LOW",
      riskFactors: ["Utility sector", "Property owner", "Debt consolidation"],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },

    // Proposal Stage (8 leads)
    {
      firstname: "Tatenda",
      lastname: "Chikomo",
      emailAddress: "tatenda.chikomo@email.com",
      mobileNo: "793456789",
      countryCode: "+263",
      dateOfBirth: new Date("1982-11-08"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user5",
      // Financial Information
      creditScore: 685,
      annualIncome: 46000,
      monthlyIncome: 3833,
      monthlyExpenses: 2900,
      employmentStatus: "EMPLOYED",
      employerName: "Lafarge Cement",
      yearsEmployed: 6.0,
      yearsAtCurrentJob: "5_10_years",
      bankName: "Standard Bank",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 19000,
      monthlyDebtPayments: 580,
      propertyOwnership: "OWN",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 32000,
      loanPurpose: "Home renovation",
      loanTerm: 42,
      collateralType: "Property",
      collateralValue: 65000,
      // Risk Assessment
      riskScore: 35,
      riskCategory: "LOW",
      riskFactors: [
        "Manufacturing sector",
        "Property owner",
        "Good credit history",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Charmaine",
      lastname: "Mukamuri",
      emailAddress: "charmaine.mukamuri@email.com",
      mobileNo: "794567890",
      countryCode: "+263",
      dateOfBirth: new Date("1988-05-14"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user6",
      // Financial Information
      creditScore: 640,
      annualIncome: 34000,
      monthlyIncome: 2833,
      monthlyExpenses: 2300,
      employmentStatus: "EMPLOYED",
      employerName: "Natpharm",
      yearsEmployed: 4.8,
      yearsAtCurrentJob: "3_5_years",
      bankName: "CBZ Bank",
      existingLoans: 0,
      hasExistingLoans: false,
      totalDebt: 11000,
      monthlyDebtPayments: 350,
      propertyOwnership: "RENT",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 24000,
      loanPurpose: "Business startup",
      loanTerm: 36,
      collateralType: "Guarantor",
      collateralValue: 35000,
      // Risk Assessment
      riskScore: 50,
      riskCategory: "MEDIUM",
      riskFactors: [
        "Pharmaceutical sector",
        "New business venture",
        "Stable employment",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Tonderai",
      lastname: "Mazango",
      emailAddress: "tonderai.mazango@email.com",
      mobileNo: "795678901",
      countryCode: "+263",
      dateOfBirth: new Date("1985-03-22"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user5",
      // Financial Information
      creditScore: 720,
      annualIncome: 62000,
      monthlyIncome: 5167,
      monthlyExpenses: 3800,
      employmentStatus: "EMPLOYED",
      employerName: "Cassava Technologies",
      yearsEmployed: 5.5,
      yearsAtCurrentJob: "5_10_years",
      bankName: "FBC Bank",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 28000,
      monthlyDebtPayments: 850,
      propertyOwnership: "OWN",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 50000,
      loanPurpose: "Vehicle purchase",
      loanTerm: 60,
      collateralType: "Vehicle",
      collateralValue: 65000,
      // Risk Assessment
      riskScore: 30,
      riskCategory: "LOW",
      riskFactors: ["Technology sector", "Asset-backed loan", "Strong income"],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Yeukai",
      lastname: "Chivasa",
      emailAddress: "yeukai.chivasa@email.com",
      mobileNo: "796789012",
      countryCode: "+263",
      dateOfBirth: new Date("1992-08-07"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user6",
      // Financial Information
      creditScore: 605,
      annualIncome: 29000,
      monthlyIncome: 2417,
      monthlyExpenses: 1950,
      employmentStatus: "EMPLOYED",
      employerName: "Simbisa Brands",
      yearsEmployed: 3.2,
      yearsAtCurrentJob: "3_5_years",
      bankName: "Steward Bank",
      existingLoans: 0,
      hasExistingLoans: false,
      totalDebt: 7000,
      monthlyDebtPayments: 250,
      propertyOwnership: "FAMILY",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 16000,
      loanPurpose: "Education",
      loanTerm: 30,
      collateralType: "Salary",
      collateralValue: 29000,
      // Risk Assessment
      riskScore: 55,
      riskCategory: "MEDIUM",
      riskFactors: [
        "Retail sector",
        "Young professional",
        "Education investment",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Tawanda",
      lastname: "Mukamuri",
      emailAddress: "tawanda.mukamuri@email.com",
      mobileNo: "797890123",
      countryCode: "+263",
      dateOfBirth: new Date("1980-06-19"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user5",
      // Financial Information
      creditScore: 755,
      annualIncome: 78000,
      monthlyIncome: 6500,
      monthlyExpenses: 4600,
      employmentStatus: "SELF_EMPLOYED",
      employerName: "Mukamuri Transport",
      yearsEmployed: 10.0,
      yearsAtCurrentJob: "over_10_years",
      bankName: "Standard Chartered",
      existingLoans: 2,
      hasExistingLoans: true,
      totalDebt: 42000,
      monthlyDebtPayments: 1300,
      propertyOwnership: "OWN",
      businessOwnership: true,
      businessType: "Transport Services",
      // Loan Request
      requestedAmount: 85000,
      loanPurpose: "Business expansion",
      loanTerm: 72,
      collateralType: "Property",
      collateralValue: 150000,
      // Risk Assessment
      riskScore: 25,
      riskCategory: "LOW",
      riskFactors: [
        "Established business",
        "Transport sector",
        "High-value collateral",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Primrose",
      lastname: "Chigumba",
      emailAddress: "primrose.chigumba@email.com",
      mobileNo: "798901234",
      countryCode: "+263",
      dateOfBirth: new Date("1987-10-03"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user6",
      // Financial Information
      creditScore: 670,
      annualIncome: 41000,
      monthlyIncome: 3417,
      monthlyExpenses: 2700,
      employmentStatus: "EMPLOYED",
      employerName: "ZIMRA",
      yearsEmployed: 6.5,
      yearsAtCurrentJob: "5_10_years",
      bankName: "POSB",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 17000,
      monthlyDebtPayments: 520,
      propertyOwnership: "RENT",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 27000,
      loanPurpose: "Home purchase",
      loanTerm: 48,
      collateralType: "Property",
      collateralValue: 45000,
      // Risk Assessment
      riskScore: 40,
      riskCategory: "MEDIUM",
      riskFactors: [
        "Government employee",
        "Property purchase",
        "Stable income",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Tafara",
      lastname: "Mutindi",
      emailAddress: "tafara.mutindi@email.com",
      mobileNo: "799012345",
      countryCode: "+263",
      dateOfBirth: new Date("1984-02-28"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user5",
      // Financial Information
      creditScore: 695,
      annualIncome: 53000,
      monthlyIncome: 4417,
      monthlyExpenses: 3300,
      employmentStatus: "EMPLOYED",
      employerName: "Zimplats",
      yearsEmployed: 7.2,
      yearsAtCurrentJob: "5_10_years",
      bankName: "Barclays Bank",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 24000,
      monthlyDebtPayments: 720,
      propertyOwnership: "OWN",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 38000,
      loanPurpose: "Debt consolidation",
      loanTerm: 48,
      collateralType: "Property",
      collateralValue: 75000,
      // Risk Assessment
      riskScore: 30,
      riskCategory: "LOW",
      riskFactors: ["Mining sector", "Property owner", "Debt consolidation"],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Chiedza",
      lastname: "Mpofu",
      emailAddress: "chiedza.mpofu@email.com",
      mobileNo: "700123456",
      countryCode: "+263",
      dateOfBirth: new Date("1991-07-15"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user6",
      // Financial Information
      creditScore: 615,
      annualIncome: 31000,
      monthlyIncome: 2583,
      monthlyExpenses: 2100,
      employmentStatus: "EMPLOYED",
      employerName: "Herald House",
      yearsEmployed: 3.8,
      yearsAtCurrentJob: "3_5_years",
      bankName: "NMB Bank",
      existingLoans: 0,
      hasExistingLoans: false,
      totalDebt: 9000,
      monthlyDebtPayments: 300,
      propertyOwnership: "FAMILY",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 19000,
      loanPurpose: "Wedding expenses",
      loanTerm: 24,
      collateralType: "Guarantor",
      collateralValue: 30000,
      // Risk Assessment
      riskScore: 50,
      riskCategory: "MEDIUM",
      riskFactors: ["Media sector", "Personal expenses", "Family support"],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },

    // Negotiation Stage (6 leads)
    {
      firstname: "Tawanda",
      lastname: "Chidziva",
      emailAddress: "tawanda.chidziva@email.com",
      mobileNo: "701234567",
      countryCode: "+263",
      dateOfBirth: new Date("1975-09-30"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Negotiation")?.id,
      status: "SUBMITTED",
      userId: "user7",
      // Financial Information
      creditScore: 740,
      annualIncome: 68000,
      monthlyIncome: 5667,
      monthlyExpenses: 4100,
      employmentStatus: "EMPLOYED",
      employerName: "Zimre Holdings",
      yearsEmployed: 12.0,
      yearsAtCurrentJob: "over_10_years",
      bankName: "Standard Bank",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 32000,
      monthlyDebtPayments: 950,
      propertyOwnership: "OWN",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 55000,
      loanPurpose: "Property investment",
      loanTerm: 60,
      collateralType: "Property",
      collateralValue: 110000,
      // Risk Assessment
      riskScore: 20,
      riskCategory: "LOW",
      riskFactors: ["Senior executive", "Property owner", "Insurance sector"],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Shuvai",
      lastname: "Makoni",
      emailAddress: "shuvai.makoni@email.com",
      mobileNo: "702345678",
      countryCode: "+263",
      dateOfBirth: new Date("1987-04-13"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Negotiation")?.id,
      status: "SUBMITTED",
      userId: "user8",
      // Financial Information
      creditScore: 675,
      annualIncome: 44000,
      monthlyIncome: 3667,
      monthlyExpenses: 2800,
      employmentStatus: "EMPLOYED",
      employerName: "CABS",
      yearsEmployed: 8.5,
      yearsAtCurrentJob: "5_10_years",
      bankName: "CABS",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 21000,
      monthlyDebtPayments: 630,
      propertyOwnership: "RENT",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 33000,
      loanPurpose: "Home purchase",
      loanTerm: 48,
      collateralType: "Property",
      collateralValue: 55000,
      // Risk Assessment
      riskScore: 35,
      riskCategory: "LOW",
      riskFactors: ["Banking sector", "Stable income", "Property purchase"],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Tichafa",
      lastname: "Mujuru",
      emailAddress: "tichafa.mujuru@email.com",
      mobileNo: "703456789",
      countryCode: "+263",
      dateOfBirth: new Date("1983-10-26"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Negotiation")?.id,
      status: "SUBMITTED",
      userId: "user7",
      // Financial Information
      creditScore: 705,
      annualIncome: 56000,
      monthlyIncome: 4667,
      monthlyExpenses: 3500,
      employmentStatus: "EMPLOYED",
      employerName: "Liquid Telecom",
      yearsEmployed: 9.0,
      yearsAtCurrentJob: "5_10_years",
      bankName: "FBC Bank",
      existingLoans: 2,
      hasExistingLoans: true,
      totalDebt: 29000,
      monthlyDebtPayments: 880,
      propertyOwnership: "OWN",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 42000,
      loanPurpose: "Business expansion",
      loanTerm: 54,
      collateralType: "Property",
      collateralValue: 85000,
      // Risk Assessment
      riskScore: 30,
      riskCategory: "LOW",
      riskFactors: ["Telecom sector", "Property owner", "Good credit"],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Chipo",
      lastname: "Rusike",
      emailAddress: "chipo.rusike@email.com",
      mobileNo: "704567890",
      countryCode: "+263",
      dateOfBirth: new Date("1986-01-18"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Negotiation")?.id,
      status: "SUBMITTED",
      userId: "user8",
      // Financial Information
      creditScore: 660,
      annualIncome: 39000,
      monthlyIncome: 3250,
      monthlyExpenses: 2600,
      employmentStatus: "EMPLOYED",
      employerName: "Meikles Limited",
      yearsEmployed: 6.2,
      yearsAtCurrentJob: "5_10_years",
      bankName: "Standard Chartered",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 16000,
      monthlyDebtPayments: 480,
      propertyOwnership: "FAMILY",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 26000,
      loanPurpose: "Education",
      loanTerm: 36,
      collateralType: "Guarantor",
      collateralValue: 40000,
      // Risk Assessment
      riskScore: 40,
      riskCategory: "MEDIUM",
      riskFactors: ["Retail sector", "Family support", "Education loan"],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Tafadzwa",
      lastname: "Pfende",
      emailAddress: "tafadzwa.pfende@email.com",
      mobileNo: "705678901",
      countryCode: "+263",
      dateOfBirth: new Date("1981-11-09"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Negotiation")?.id,
      status: "SUBMITTED",
      userId: "user7",
      // Financial Information
      creditScore: 725,
      annualIncome: 61000,
      monthlyIncome: 5083,
      monthlyExpenses: 3800,
      employmentStatus: "EMPLOYED",
      employerName: "RBZ",
      yearsEmployed: 10.5,
      yearsAtCurrentJob: "over_10_years",
      bankName: "ZB Bank",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 27000,
      monthlyDebtPayments: 810,
      propertyOwnership: "OWN",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 48000,
      loanPurpose: "Vehicle purchase",
      loanTerm: 60,
      collateralType: "Vehicle",
      collateralValue: 62000,
      // Risk Assessment
      riskScore: 25,
      riskCategory: "LOW",
      riskFactors: [
        "Central bank employee",
        "Asset-backed",
        "Excellent credit",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Rumbidzai",
      lastname: "Chitongo",
      emailAddress: "rumbidzai.chitongo@email.com",
      mobileNo: "706789012",
      countryCode: "+263",
      dateOfBirth: new Date("1989-05-24"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Negotiation")?.id,
      status: "SUBMITTED",
      userId: "user8",
      // Financial Information
      creditScore: 645,
      annualIncome: 37000,
      monthlyIncome: 3083,
      monthlyExpenses: 2500,
      employmentStatus: "EMPLOYED",
      employerName: "Dairibord Holdings",
      yearsEmployed: 5.8,
      yearsAtCurrentJob: "5_10_years",
      bankName: "NMB Bank",
      existingLoans: 0,
      hasExistingLoans: false,
      totalDebt: 12000,
      monthlyDebtPayments: 400,
      propertyOwnership: "RENT",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 23000,
      loanPurpose: "Business startup",
      loanTerm: 36,
      collateralType: "Salary",
      collateralValue: 37000,
      // Risk Assessment
      riskScore: 45,
      riskCategory: "MEDIUM",
      riskFactors: [
        "Manufacturing sector",
        "New business",
        "No existing loans",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },

    // Closed Won Stage (4 leads)
    {
      firstname: "Tinashe",
      lastname: "Mandaza",
      emailAddress: "tinashe.mandaza@email.com",
      mobileNo: "707890123",
      countryCode: "+263",
      dateOfBirth: new Date("1992-12-03"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Closed Won")?.id,
      status: "SUBMITTED",
      userId: "user8",
      // Financial Information
      creditScore: 780,
      annualIncome: 75000,
      monthlyIncome: 6250,
      monthlyExpenses: 4200,
      employmentStatus: "EMPLOYED",
      employerName: "Stanbic Bank",
      yearsEmployed: 8.0,
      yearsAtCurrentJob: "5_10_years",
      bankName: "Stanbic Bank",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 35000,
      monthlyDebtPayments: 1050,
      propertyOwnership: "OWN",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 65000,
      loanPurpose: "Property investment",
      loanTerm: 72,
      collateralType: "Property",
      collateralValue: 130000,
      // Risk Assessment
      riskScore: 15,
      riskCategory: "LOW",
      riskFactors: [
        "Banking professional",
        "Excellent credit",
        "High-value collateral",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Charmaine",
      lastname: "Zimunya",
      emailAddress: "charmaine.zimunya@email.com",
      mobileNo: "708901234",
      countryCode: "+263",
      dateOfBirth: new Date("1986-01-15"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Closed Won")?.id,
      status: "SUBMITTED",
      userId: "user7",
      // Financial Information
      creditScore: 720,
      annualIncome: 59000,
      monthlyIncome: 4917,
      monthlyExpenses: 3600,
      employmentStatus: "EMPLOYED",
      employerName: "Delta Corporation",
      yearsEmployed: 9.5,
      yearsAtCurrentJob: "5_10_years",
      bankName: "CBZ Bank",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 26000,
      monthlyDebtPayments: 780,
      propertyOwnership: "OWN",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 45000,
      loanPurpose: "Home renovation",
      loanTerm: 60,
      collateralType: "Property",
      collateralValue: 90000,
      // Risk Assessment
      riskScore: 20,
      riskCategory: "LOW",
      riskFactors: [
        "Established company",
        "Property owner",
        "Strong financials",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Tonderai",
      lastname: "Chivasa",
      emailAddress: "tonderai.chivasa@email.com",
      mobileNo: "709012345",
      countryCode: "+263",
      dateOfBirth: new Date("1989-11-28"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Closed Won")?.id,
      status: "SUBMITTED",
      userId: "user8",
      // Financial Information
      creditScore: 695,
      annualIncome: 51000,
      monthlyIncome: 4250,
      monthlyExpenses: 3200,
      employmentStatus: "EMPLOYED",
      employerName: "Innscor Africa",
      yearsEmployed: 7.0,
      yearsAtCurrentJob: "5_10_years",
      bankName: "Barclays Bank",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 23000,
      monthlyDebtPayments: 690,
      propertyOwnership: "OWN",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 38000,
      loanPurpose: "Debt consolidation",
      loanTerm: 48,
      collateralType: "Property",
      collateralValue: 76000,
      // Risk Assessment
      riskScore: 25,
      riskCategory: "LOW",
      riskFactors: [
        "Manufacturing sector",
        "Property owner",
        "Debt consolidation",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Yeukai",
      lastname: "Mpofu",
      emailAddress: "yeukai.mpofu@email.com",
      mobileNo: "710123456",
      countryCode: "+263",
      dateOfBirth: new Date("1984-08-11"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Closed Won")?.id,
      status: "SUBMITTED",
      userId: "user7",
      // Financial Information
      creditScore: 710,
      annualIncome: 54000,
      monthlyIncome: 4500,
      monthlyExpenses: 3300,
      employmentStatus: "EMPLOYED",
      employerName: "Hippo Valley Estates",
      yearsEmployed: 8.5,
      yearsAtCurrentJob: "5_10_years",
      bankName: "Standard Bank",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 24000,
      monthlyDebtPayments: 720,
      propertyOwnership: "OWN",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 41000,
      loanPurpose: "Business expansion",
      loanTerm: 54,
      collateralType: "Property",
      collateralValue: 82000,
      // Risk Assessment
      riskScore: 25,
      riskCategory: "LOW",
      riskFactors: [
        "Agriculture sector",
        "Property owner",
        "Good credit history",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },

    // Closed Lost Stage (2 leads)
    {
      firstname: "Tafara",
      lastname: "Chigumba",
      emailAddress: "tafara.chigumba@email.com",
      mobileNo: "711234567",
      countryCode: "+263",
      dateOfBirth: new Date("1988-03-07"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Closed Lost")?.id,
      status: "SUBMITTED",
      userId: "user7",
      // Financial Information
      creditScore: 520,
      annualIncome: 19000,
      monthlyIncome: 1583,
      monthlyExpenses: 1400,
      employmentStatus: "EMPLOYED",
      employerName: "Local Council",
      yearsEmployed: 2.0,
      yearsAtCurrentJob: "1_3_years",
      bankName: "POSB",
      existingLoans: 2,
      hasExistingLoans: true,
      totalDebt: 15000,
      monthlyDebtPayments: 500,
      propertyOwnership: "RENT",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 25000,
      loanPurpose: "Debt consolidation",
      loanTerm: 60,
      collateralType: "Salary",
      collateralValue: 19000,
      // Risk Assessment
      riskScore: 85,
      riskCategory: "HIGH",
      riskFactors: ["Low credit score", "High debt ratio", "Limited income"],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
    {
      firstname: "Chiedza",
      lastname: "Mutindi",
      emailAddress: "chiedza.mutindi@email.com",
      mobileNo: "712345678",
      countryCode: "+263",
      dateOfBirth: new Date("1990-09-21"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Closed Lost")?.id,
      status: "SUBMITTED",
      userId: "user8",
      // Financial Information
      creditScore: 545,
      annualIncome: 21000,
      monthlyIncome: 1750,
      monthlyExpenses: 1600,
      employmentStatus: "EMPLOYED",
      employerName: "Small Retailer",
      yearsEmployed: 1.5,
      yearsAtCurrentJob: "1_3_years",
      bankName: "Steward Bank",
      existingLoans: 1,
      hasExistingLoans: true,
      totalDebt: 18000,
      monthlyDebtPayments: 600,
      propertyOwnership: "RENT",
      businessOwnership: false,
      // Loan Request
      requestedAmount: 30000,
      loanPurpose: "Business startup",
      loanTerm: 48,
      collateralType: "Guarantor",
      collateralValue: 25000,
      // Risk Assessment
      riskScore: 80,
      riskCategory: "HIGH",
      riskFactors: [
        "Poor credit score",
        "High debt payments",
        "New employment",
      ],
      riskAssessmentDate: new Date(),
      riskAssessedBy: "system",
    },
  ];

  const leads = await Promise.all(
    sampleLeads.map((lead) =>
      prisma.lead.create({
        data: {
          ...lead,
          tenantId,
        },
      })
    )
  );

  // Create state transitions for each lead to simulate progression
  const transitionPromises = leads.map(async (lead, index) => {
    const currentStage = stages.find((s) => s.id === lead.currentStageId);
    if (!currentStage) return;

    // Create initial transition to current stage
    await prisma.stateTransition.create({
      data: {
        leadId: lead.id,
        tenantId,
        fromStageId: null, // Initial state
        toStageId: lead.currentStageId!,
        event: "INITIAL_SUBMISSION",
        triggeredBy: lead.userId,
        triggeredAt: new Date(
          Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000
        ), // Random time in last 7 days
        context: { leadData: lead },
        metadata: { source: "seed_data" },
      },
    });

    // For leads not in the first stage, create progression transitions
    if (currentStage.order > 1) {
      const previousStages = stages
        .filter((s) => s.order < currentStage.order)
        .sort((a, b) => a.order - b.order);

      for (const prevStage of previousStages) {
        await prisma.stateTransition.create({
          data: {
            leadId: lead.id,
            tenantId,
            fromStageId:
              prevStage.order === 1
                ? null
                : stages.find((s) => s.order === prevStage.order - 1)?.id ||
                  null,
            toStageId: prevStage.id,
            event: `TRANSITION_TO_${prevStage.name
              .toUpperCase()
              .replace(/\s+/g, "_")}`,
            triggeredBy: `user${Math.floor(Math.random() * 8) + 1}`,
            triggeredAt: new Date(
              Date.now() -
                Math.random() * (7 - prevStage.order) * 24 * 60 * 60 * 1000
            ),
            context: { leadData: lead },
            metadata: { source: "seed_data" },
          },
        });
      }
    }
  });

  await Promise.all(transitionPromises);

  return leads;
}

async function seedSampleDocuments(tenantId: string, leads: any[]) {
  // Check if documents already exist
  const existingDocuments = await prisma.leadDocument.findMany({
    where: { tenantId },
  });

  if (existingDocuments.length > 0) {
    return existingDocuments;
  }

  // Sample document categories and types
  const documentCategories = [
    "Business Documents",
    "Financial Documents",
    "Collateral Documents",
    "Identity Documents",
    "Legal Documents",
  ];

  const documentTypes = {
    "Business Documents": [
      { name: "Business Registration Certificate", type: "PDF", size: 245760 },
      { name: "Tax Clearance Certificate", type: "PDF", size: 189440 },
      { name: "Business Plan", type: "DOCX", size: 512000 },
      { name: "Company Profile", type: "PDF", size: 367616 },
    ],
    "Financial Documents": [
      { name: "Bank Statements (6 months)", type: "PDF", size: 1048576 },
      { name: "Financial Statements", type: "PDF", size: 786432 },
      { name: "Audited Accounts", type: "PDF", size: 921600 },
      { name: "Cash Flow Projections", type: "XLSX", size: 204800 },
    ],
    "Collateral Documents": [
      { name: "Property Title Deed", type: "PDF", size: 512000 },
      { name: "Property Valuation Report", type: "PDF", size: 1572864 },
      { name: "Insurance Policy", type: "PDF", size: 327680 },
      { name: "Property Survey Report", type: "PDF", size: 2097152 },
    ],
    "Identity Documents": [
      { name: "National ID Copy", type: "PDF", size: 102400 },
      { name: "Passport Copy", type: "PDF", size: 153600 },
      { name: "Proof of Residence", type: "PDF", size: 204800 },
    ],
    "Legal Documents": [
      { name: "Power of Attorney", type: "PDF", size: 256000 },
      { name: "Memorandum of Understanding", type: "PDF", size: 409600 },
      { name: "Legal Opinion", type: "PDF", size: 327680 },
    ],
  };

  const statuses = ["pending", "verified", "rejected"];
  const users = [
    "user1",
    "user2",
    "user3",
    "user4",
    "user5",
    "user6",
    "user7",
    "user8",
  ];

  const sampleDocuments = [];

  // Create documents for first 10 leads (to have some variety)
  for (let i = 0; i < Math.min(10, leads.length); i++) {
    const lead = leads[i];
    const numDocuments = Math.floor(Math.random() * 5) + 2; // 2-6 documents per lead

    for (let j = 0; j < numDocuments; j++) {
      const category =
        documentCategories[
          Math.floor(Math.random() * documentCategories.length)
        ];
      const docTypes = documentTypes[category as keyof typeof documentTypes];
      const docType = docTypes[Math.floor(Math.random() * docTypes.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const uploadedBy = users[Math.floor(Math.random() * users.length)];

      const document = {
        leadId: lead.id,
        tenantId,
        name: docType.name,
        originalName: `${docType.name
          .toLowerCase()
          .replace(/\s+/g, "_")}.${docType.type.toLowerCase()}`,
        type: docType.type,
        size: docType.size,
        category,
        status,
        filePath: `/uploads/leads/${lead.id}/${docType.name
          .toLowerCase()
          .replace(/\s+/g, "_")}.${docType.type.toLowerCase()}`,
        mimeType:
          docType.type === "PDF"
            ? "application/pdf"
            : docType.type === "DOCX"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : docType.type === "XLSX"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/octet-stream",
        uploadedBy,
        verifiedBy:
          status === "verified"
            ? users[Math.floor(Math.random() * users.length)]
            : null,
        verifiedAt:
          status === "verified"
            ? new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000)
            : null,
        notes:
          status === "rejected"
            ? "Document quality is poor, please resubmit"
            : status === "verified"
            ? "Document verified and approved"
            : null,
        metadata: {
          uploadSource: "web_portal",
          fileHash: `hash_${Math.random().toString(36).substring(7)}`,
          scanResult: "clean",
        },
      };

      sampleDocuments.push(document);
    }
  }

  // Create the documents in the database
  const documents = await Promise.all(
    sampleDocuments.map((doc) =>
      prisma.leadDocument.create({
        data: doc,
      })
    )
  );

  return documents;
}

async function seedSampleCommunications(tenantId: string, leads: any[]) {
  // Check if communications already exist
  const existingCommunications = await prisma.leadCommunication.findMany({
    where: { tenantId },
  });

  if (existingCommunications.length > 0) {
    return existingCommunications;
  }

  const communicationTypes = ["EMAIL", "SMS", "CALL", "MEETING", "NOTE"];
  const directions = ["INBOUND", "OUTBOUND"];
  const statuses = ["sent", "delivered", "read", "failed"];
  const users = [
    "user1",
    "user2",
    "user3",
    "user4",
    "user5",
    "user6",
    "user7",
    "user8",
  ];

  const emailSubjects = [
    "Welcome to our loan application process",
    "Document verification required",
    "Loan application status update",
    "Additional information needed",
    "Congratulations! Your loan has been approved",
    "Meeting scheduled for loan discussion",
    "Follow-up on your loan application",
    "Important: Action required on your application",
    "Loan terms and conditions",
    "Thank you for choosing our services",
  ];

  const emailContents = [
    "Thank you for submitting your loan application. We have received all your documents and will begin processing shortly.",
    "We need additional documentation to proceed with your application. Please upload the requested documents at your earliest convenience.",
    "Your loan application is currently under review. We will contact you within 2-3 business days with an update.",
    "We would like to schedule a meeting to discuss your loan requirements in detail. Please let us know your availability.",
    "Congratulations! Your loan application has been approved. Please review the attached terms and conditions.",
    "This is a follow-up to our previous conversation. Please don't hesitate to contact us if you have any questions.",
    "We have reviewed your application and would like to discuss some modifications to better suit your needs.",
    "Your application requires immediate attention. Please contact us as soon as possible to avoid delays.",
    "Please find attached the loan agreement for your review. Kindly sign and return at your earliest convenience.",
    "Thank you for choosing our financial services. We look forward to a successful partnership.",
  ];

  const callNotes = [
    "Discussed loan requirements and eligibility criteria. Client seems interested and qualified.",
    "Explained the application process and required documentation. Client will submit documents by end of week.",
    "Follow-up call to check on document submission status. Client requested extension for bank statements.",
    "Clarified loan terms and interest rates. Client satisfied with the proposed terms.",
    "Discussed collateral requirements and property valuation process.",
    "Client had questions about repayment schedule. Provided detailed explanation.",
    "Scheduled in-person meeting for loan agreement signing.",
    "Client requested information about early repayment options.",
    "Discussed loan disbursement process and timeline.",
    "Final verification call before loan approval.",
  ];

  const meetingNotes = [
    "Productive meeting to discuss loan application. Client provided additional financial information.",
    "Reviewed all submitted documents with client. Everything appears to be in order.",
    "Discussed loan terms in detail. Client agreed to proposed interest rate and repayment schedule.",
    "Property inspection meeting completed. Collateral value confirmed.",
    "Final meeting before loan approval. All conditions have been met.",
    "Loan agreement signing ceremony. Client very satisfied with the service.",
    "Initial consultation meeting. Assessed client's financial needs and capacity.",
    "Follow-up meeting to address client's concerns about loan terms.",
    "Meeting with client and guarantor to finalize loan documentation.",
    "Post-approval meeting to explain disbursement process.",
  ];

  const smsMessages = [
    "Your loan application has been received. Reference: LA2024001",
    "Document verification in progress. We'll update you soon.",
    "Please call us at your earliest convenience regarding your application.",
    "Congratulations! Your loan has been approved. Check your email for details.",
    "Reminder: Meeting scheduled for tomorrow at 2 PM.",
    "Your application is pending additional documentation.",
    "Loan disbursement completed. Check your account.",
    "Thank you for choosing our services. Rate us on our app!",
    "Important: Please respond to our email sent today.",
    "Your monthly payment is due in 3 days.",
  ];

  const noteContents = [
    "Client called to inquire about application status. Provided update and reassurance.",
    "Received additional documents via email. All requirements now satisfied.",
    "Internal note: Credit score verification completed. Score: 720 - Excellent.",
    "Property valuation report received. Value confirmed at $50,000.",
    "Client expressed satisfaction with our service during phone conversation.",
    "Loan committee approved application. Preparing final documentation.",
    "Client requested expedited processing due to urgent business needs.",
    "All KYC requirements completed. Client profile updated in system.",
    "Risk assessment completed. Client categorized as low-risk borrower.",
    "Final approval granted by senior management. Proceeding with disbursement.",
  ];

  const sampleCommunications = [];

  // Create communications for first 15 leads (to have variety)
  for (let i = 0; i < Math.min(15, leads.length); i++) {
    const lead = leads[i];
    const numCommunications = Math.floor(Math.random() * 8) + 3; // 3-10 communications per lead

    for (let j = 0; j < numCommunications; j++) {
      const type =
        communicationTypes[
          Math.floor(Math.random() * communicationTypes.length)
        ];
      const direction =
        directions[Math.floor(Math.random() * directions.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const createdBy = users[Math.floor(Math.random() * users.length)];

      let subject = null;
      let content = "";

      // Generate content based on communication type
      switch (type) {
        case "EMAIL":
          subject =
            emailSubjects[Math.floor(Math.random() * emailSubjects.length)];
          content =
            emailContents[Math.floor(Math.random() * emailContents.length)];
          break;
        case "SMS":
          content = smsMessages[Math.floor(Math.random() * smsMessages.length)];
          break;
        case "CALL":
          content = callNotes[Math.floor(Math.random() * callNotes.length)];
          break;
        case "MEETING":
          subject = "Client Meeting - " + lead.firstname + " " + lead.lastname;
          content =
            meetingNotes[Math.floor(Math.random() * meetingNotes.length)];
          break;
        case "NOTE":
          content =
            noteContents[Math.floor(Math.random() * noteContents.length)];
          break;
      }

      // Create timestamp (spread over last 30 days)
      const createdAt = new Date(
        Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
      );

      const communication = {
        leadId: lead.id,
        tenantId,
        type,
        direction,
        subject,
        content,
        status,
        scheduledAt:
          type === "MEETING"
            ? new Date(createdAt.getTime() + 24 * 60 * 60 * 1000)
            : null,
        sentAt: createdAt,
        deliveredAt:
          status !== "failed"
            ? new Date(createdAt.getTime() + 5 * 60 * 1000)
            : null,
        readAt:
          status === "read"
            ? new Date(createdAt.getTime() + 30 * 60 * 1000)
            : null,
        fromEmail:
          direction === "OUTBOUND" && type === "EMAIL"
            ? "loans@company.com"
            : null,
        toEmail:
          direction === "INBOUND" || type === "EMAIL"
            ? lead.emailAddress
            : null,
        fromPhone:
          direction === "OUTBOUND" && (type === "SMS" || type === "CALL")
            ? "+263123456789"
            : null,
        toPhone:
          direction === "INBOUND" || type === "SMS" || type === "CALL"
            ? lead.mobileNo
            : null,
        provider:
          type === "EMAIL" ? "SendGrid" : type === "SMS" ? "Twilio" : null,
        providerId:
          type === "EMAIL" || type === "SMS"
            ? `msg_${Math.random().toString(36).substring(7)}`
            : null,
        metadata: {
          source: "seed_data",
          priority: Math.random() > 0.8 ? "high" : "normal",
          tags: [type.toLowerCase(), direction.toLowerCase()],
        },
        createdBy,
        assignedTo:
          Math.random() > 0.5
            ? users.filter((user) => user !== lead.userId)[
                Math.floor(Math.random() * (users.length - 1))
              ]
            : null,
        createdAt,
        updatedAt: createdAt,
      };

      sampleCommunications.push(communication);
    }
  }

  // Sort communications by creation date
  sampleCommunications.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  // Create the communications in the database
  const communications = await Promise.all(
    sampleCommunications.map((comm) =>
      prisma.leadCommunication.create({
        data: comm,
      })
    )
  );

  console.log(`✅ Created ${communications.length} sample communications`);
  return communications;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
