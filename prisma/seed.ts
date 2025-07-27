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

    // Seed sample leads
    console.log("Seeding sample leads...");
    await seedSampleLeads(tenant.id, stages, teams);

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
      name: "John Doe",
      email: "john@example.com",
      role: "Sales Rep",
    },
    {
      teamId: teams[0].id,
      userId: "user2",
      name: "Jane Smith",
      email: "jane@example.com",
      role: "Senior Sales Rep",
    },
    {
      teamId: teams[1].id,
      userId: "user3",
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "Operations Specialist",
    },
    {
      teamId: teams[1].id,
      userId: "user4",
      name: "Bob Wilson",
      email: "bob@example.com",
      role: "Document Processor",
    },
    {
      teamId: teams[2].id,
      userId: "user5",
      name: "Robert Brown",
      email: "robert@example.com",
      role: "Credit Analyst",
    },
    {
      teamId: teams[2].id,
      userId: "user6",
      name: "Emily Davis",
      email: "emily@example.com",
      role: "Senior Credit Analyst",
    },
    {
      teamId: teams[3].id,
      userId: "user7",
      name: "Alex Martinez",
      email: "alex@example.com",
      role: "Manager",
    },
    {
      teamId: teams[3].id,
      userId: "user8",
      name: "Maria Santos",
      email: "maria@example.com",
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
      mobileNo: "+263771234567",
      dateOfBirth: new Date("1985-03-15"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user1",
    },
    {
      firstname: "Chipo",
      lastname: "Nyamande",
      emailAddress: "chipo.nyamande@email.com",
      mobileNo: "+263772345678",
      dateOfBirth: new Date("1987-08-20"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user1",
    },
    {
      firstname: "Blessing",
      lastname: "Chikwanha",
      emailAddress: "blessing.chikwanha@email.com",
      mobileNo: "+263773456789",
      dateOfBirth: new Date("1979-12-05"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user2",
    },
    {
      firstname: "Rutendo",
      lastname: "Madziva",
      emailAddress: "rutendo.madziva@email.com",
      mobileNo: "+263774567890",
      dateOfBirth: new Date("1991-04-18"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user1",
    },
    {
      firstname: "Takudzwa",
      lastname: "Moyo",
      emailAddress: "takudzwa.moyo@email.com",
      mobileNo: "+263775678901",
      dateOfBirth: new Date("1983-06-12"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user2",
    },
    {
      firstname: "Vimbai",
      lastname: "Sibanda",
      emailAddress: "vimbai.sibanda@email.com",
      mobileNo: "+263776789012",
      dateOfBirth: new Date("1989-10-25"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user1",
    },
    {
      firstname: "Tinashe",
      lastname: "Dube",
      emailAddress: "tinashe.dube@email.com",
      mobileNo: "+263777890123",
      dateOfBirth: new Date("1976-02-14"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user2",
    },
    {
      firstname: "Nyasha",
      lastname: "Gumbo",
      emailAddress: "nyasha.gumbo@email.com",
      mobileNo: "+263778901234",
      dateOfBirth: new Date("1993-07-08"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user1",
    },
    {
      firstname: "Farai",
      lastname: "Mutasa",
      emailAddress: "farai.mutasa@email.com",
      mobileNo: "+263779012345",
      dateOfBirth: new Date("1988-11-22"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user2",
    },
    {
      firstname: "Tariro",
      lastname: "Ncube",
      emailAddress: "tariro.ncube@email.com",
      mobileNo: "+263780123456",
      dateOfBirth: new Date("1992-05-30"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user1",
    },
    {
      firstname: "Munyaradzi",
      lastname: "Chigumba",
      emailAddress: "munyaradzi.chigumba@email.com",
      mobileNo: "+263781234567",
      dateOfBirth: new Date("1984-09-17"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user2",
    },
    {
      firstname: "Chiedza",
      lastname: "Mapfumo",
      emailAddress: "chiedza.mapfumo@email.com",
      mobileNo: "+263782345678",
      dateOfBirth: new Date("1990-01-12"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "New Lead")?.id,
      status: "SUBMITTED",
      userId: "user1",
    },

    // Qualification Stage (10 leads)
    {
      firstname: "Simbarashe",
      lastname: "Mhango",
      emailAddress: "simbarashe.mhango@email.com",
      mobileNo: "+263783456789",
      dateOfBirth: new Date("1990-07-22"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user3",
    },
    {
      firstname: "Tsitsi",
      lastname: "Makoni",
      emailAddress: "tsitsi.makoni@email.com",
      mobileNo: "+263784567890",
      dateOfBirth: new Date("1984-11-30"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user4",
    },
    {
      firstname: "Ropafadzo",
      lastname: "Chidziva",
      emailAddress: "ropafadzo.chidziva@email.com",
      mobileNo: "+263785678901",
      dateOfBirth: new Date("1986-05-16"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user3",
    },
    {
      firstname: "Tafadzwa",
      lastname: "Mushonga",
      emailAddress: "tafadzwa.mushonga@email.com",
      mobileNo: "+263786789012",
      dateOfBirth: new Date("1981-09-03"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user4",
    },
    {
      firstname: "Fungai",
      lastname: "Zimunya",
      emailAddress: "fungai.zimunya@email.com",
      mobileNo: "+263787890123",
      dateOfBirth: new Date("1988-01-27"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user3",
    },
    {
      firstname: "Panashe",
      lastname: "Mujuru",
      emailAddress: "panashe.mujuru@email.com",
      mobileNo: "+263788901234",
      dateOfBirth: new Date("1977-12-11"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user4",
    },
    {
      firstname: "Ruvimbo",
      lastname: "Chitongo",
      emailAddress: "ruvimbo.chitongo@email.com",
      mobileNo: "+263789012345",
      dateOfBirth: new Date("1985-04-08"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user3",
    },
    {
      firstname: "Tapiwa",
      lastname: "Mandaza",
      emailAddress: "tapiwa.mandaza@email.com",
      mobileNo: "+263790123456",
      dateOfBirth: new Date("1982-08-25"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user4",
    },
    {
      firstname: "Chenai",
      lastname: "Rusike",
      emailAddress: "chenai.rusike@email.com",
      mobileNo: "+263791234567",
      dateOfBirth: new Date("1989-12-14"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user3",
    },
    {
      firstname: "Kudakwashe",
      lastname: "Pfende",
      emailAddress: "kudakwashe.pfende@email.com",
      mobileNo: "+263792345678",
      dateOfBirth: new Date("1983-06-19"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Qualification")?.id,
      status: "SUBMITTED",
      userId: "user4",
    },

    // Proposal Stage (8 leads)
    {
      firstname: "Tatenda",
      lastname: "Chikomo",
      emailAddress: "tatenda.chikomo@email.com",
      mobileNo: "+263793456789",
      dateOfBirth: new Date("1982-11-08"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user5",
    },
    {
      firstname: "Charmaine",
      lastname: "Mukamuri",
      emailAddress: "charmaine.mukamuri@email.com",
      mobileNo: "+263794567890",
      dateOfBirth: new Date("1988-05-14"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user6",
    },
    {
      firstname: "Tonderai",
      lastname: "Mazango",
      emailAddress: "tonderai.mazango@email.com",
      mobileNo: "+263795678901",
      dateOfBirth: new Date("1985-03-22"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user5",
    },
    {
      firstname: "Yeukai",
      lastname: "Chivasa",
      emailAddress: "yeukai.chivasa@email.com",
      mobileNo: "+263796789012",
      dateOfBirth: new Date("1992-08-07"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user6",
    },
    {
      firstname: "Tawanda",
      lastname: "Mukamuri",
      emailAddress: "tawanda.mukamuri@email.com",
      mobileNo: "+263797890123",
      dateOfBirth: new Date("1980-06-19"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user5",
    },
    {
      firstname: "Primrose",
      lastname: "Chigumba",
      emailAddress: "primrose.chigumba@email.com",
      mobileNo: "+263798901234",
      dateOfBirth: new Date("1987-10-03"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user6",
    },
    {
      firstname: "Tafara",
      lastname: "Mutindi",
      emailAddress: "tafara.mutindi@email.com",
      mobileNo: "+263799012345",
      dateOfBirth: new Date("1984-02-28"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user5",
    },
    {
      firstname: "Chiedza",
      lastname: "Mpofu",
      emailAddress: "chiedza.mpofu@email.com",
      mobileNo: "+263700123456",
      dateOfBirth: new Date("1991-07-15"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Proposal")?.id,
      status: "SUBMITTED",
      userId: "user6",
    },

    // Negotiation Stage (6 leads)
    {
      firstname: "Tawanda",
      lastname: "Chidziva",
      emailAddress: "tawanda.chidziva@email.com",
      mobileNo: "+263701234567",
      dateOfBirth: new Date("1975-09-30"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Negotiation")?.id,
      status: "SUBMITTED",
      userId: "user7",
    },
    {
      firstname: "Shuvai",
      lastname: "Makoni",
      emailAddress: "shuvai.makoni@email.com",
      mobileNo: "+263702345678",
      dateOfBirth: new Date("1987-04-13"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Negotiation")?.id,
      status: "SUBMITTED",
      userId: "user8",
    },
    {
      firstname: "Tichafa",
      lastname: "Mujuru",
      emailAddress: "tichafa.mujuru@email.com",
      mobileNo: "+263703456789",
      dateOfBirth: new Date("1983-10-26"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Negotiation")?.id,
      status: "SUBMITTED",
      userId: "user7",
    },
    {
      firstname: "Chipo",
      lastname: "Rusike",
      emailAddress: "chipo.rusike@email.com",
      mobileNo: "+263704567890",
      dateOfBirth: new Date("1986-01-18"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Negotiation")?.id,
      status: "SUBMITTED",
      userId: "user8",
    },
    {
      firstname: "Tafadzwa",
      lastname: "Pfende",
      emailAddress: "tafadzwa.pfende@email.com",
      mobileNo: "+263705678901",
      dateOfBirth: new Date("1981-11-09"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Negotiation")?.id,
      status: "SUBMITTED",
      userId: "user7",
    },
    {
      firstname: "Rumbidzai",
      lastname: "Chitongo",
      emailAddress: "rumbidzai.chitongo@email.com",
      mobileNo: "+263706789012",
      dateOfBirth: new Date("1989-05-24"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Negotiation")?.id,
      status: "SUBMITTED",
      userId: "user8",
    },

    // Closed Won Stage (4 leads)
    {
      firstname: "Tinashe",
      lastname: "Mandaza",
      emailAddress: "tinashe.mandaza@email.com",
      mobileNo: "+263707890123",
      dateOfBirth: new Date("1992-12-03"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Closed Won")?.id,
      status: "SUBMITTED",
      userId: "user8",
    },
    {
      firstname: "Charmaine",
      lastname: "Zimunya",
      emailAddress: "charmaine.zimunya@email.com",
      mobileNo: "+263708901234",
      dateOfBirth: new Date("1986-01-15"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Closed Won")?.id,
      status: "SUBMITTED",
      userId: "user7",
    },
    {
      firstname: "Tonderai",
      lastname: "Chivasa",
      emailAddress: "tonderai.chivasa@email.com",
      mobileNo: "+263709012345",
      dateOfBirth: new Date("1989-11-28"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Closed Won")?.id,
      status: "SUBMITTED",
      userId: "user8",
    },
    {
      firstname: "Yeukai",
      lastname: "Mpofu",
      emailAddress: "yeukai.mpofu@email.com",
      mobileNo: "+263710123456",
      dateOfBirth: new Date("1984-08-11"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Closed Won")?.id,
      status: "SUBMITTED",
      userId: "user7",
    },

    // Closed Lost Stage (2 leads)
    {
      firstname: "Tafara",
      lastname: "Chigumba",
      emailAddress: "tafara.chigumba@email.com",
      mobileNo: "+263711234567",
      dateOfBirth: new Date("1988-03-07"),
      gender: "Male",
      currentStageId: stages.find((s) => s.name === "Closed Lost")?.id,
      status: "SUBMITTED",
      userId: "user7",
    },
    {
      firstname: "Chiedza",
      lastname: "Mutindi",
      emailAddress: "chiedza.mutindi@email.com",
      mobileNo: "+263712345678",
      dateOfBirth: new Date("1990-09-21"),
      gender: "Female",
      currentStageId: stages.find((s) => s.name === "Closed Lost")?.id,
      status: "SUBMITTED",
      userId: "user8",
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

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
