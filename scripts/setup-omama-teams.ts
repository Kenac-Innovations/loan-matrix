/**
 * Sets up pipeline stages and teams for the omama tenant.
 * Run with: npx tsx scripts/setup-omama-teams.ts
 */
import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: "omama", isActive: true },
  });

  if (!tenant) {
    console.error("Tenant 'omama' not found");
    process.exit(1);
  }

  console.log(`Found tenant: ${tenant.name} (${tenant.id})`);

  // 1. Ensure pipeline stages exist
  const stages = await ensurePipelineStages(tenant.id);

  // 2. Create teams
  await createTeams(tenant.id, stages);

  console.log("\nDone! Omama tenant is now configured with teams and pipeline stages.");
}

async function ensurePipelineStages(tenantId: string) {
  const existing = await prisma.pipelineStage.findMany({
    where: { tenantId },
    orderBy: { order: "asc" },
  });

  if (existing.length > 0) {
    console.log(`\nPipeline stages already exist (${existing.length}):`);
    existing.forEach((s) => console.log(`  ${s.order}. ${s.name} [${s.isInitialState ? "INITIAL" : s.isFinalState ? "FINAL" : ""}]`));
    return existing;
  }

  console.log("\nCreating pipeline stages...");

  const stageData = [
    { name: "Application Intake", description: "New lead entry and document collection", order: 1, color: "#3b82f6", isInitialState: true, isFinalState: false },
    { name: "Credit Assessment",  description: "Credit check and affordability analysis", order: 2, color: "#8b5cf6", isInitialState: false, isFinalState: false },
    { name: "Approval",           description: "Loan approval decision",                  order: 3, color: "#f59e0b", isInitialState: false, isFinalState: false },
    { name: "Disbursement",       description: "Loan disbursement processing",            order: 4, color: "#10b981", isInitialState: false, isFinalState: false },
    { name: "Payout",             description: "Cash payout to client",                   order: 5, color: "#059669", isInitialState: false, isFinalState: true  },
    { name: "Rejected",           description: "Lead rejected at any stage",              order: 6, color: "#ef4444", isInitialState: false, isFinalState: true  },
  ];

  const stages = await Promise.all(
    stageData.map((s) =>
      prisma.pipelineStage.create({
        data: { ...s, tenantId, allowedTransitions: [] },
      })
    )
  );

  // Set up allowed transitions
  const stageMap = new Map(stages.map((s) => [s.name, s.id]));

  const transitions: Record<string, string[]> = {
    "Application Intake": ["Credit Assessment", "Rejected"],
    "Credit Assessment":  ["Approval", "Rejected"],
    "Approval":           ["Disbursement", "Rejected"],
    "Disbursement":       ["Payout", "Rejected"],
    "Payout":             [],
    "Rejected":           [],
  };

  await Promise.all(
    stages.map((stage) => {
      const targetNames = transitions[stage.name] || [];
      const targetIds = targetNames.map((n) => stageMap.get(n)).filter(Boolean) as string[];
      return prisma.pipelineStage.update({
        where: { id: stage.id },
        data: { allowedTransitions: targetIds },
      });
    })
  );

  console.log("Created stages:");
  stages.forEach((s) => {
    const trans = transitions[s.name] || [];
    console.log(`  ${s.order}. ${s.name} -> [${trans.join(", ")}]`);
  });

  return stages;
}

async function createTeams(tenantId: string, stages: any[]) {
  // Check if teams already exist
  const existing = await prisma.team.findMany({ where: { tenantId } });
  if (existing.length > 0) {
    console.log(`\nTeams already exist (${existing.length}):`);
    existing.forEach((t) => console.log(`  - ${t.name} (strategy: ${t.assignmentStrategy})`));
    console.log("Skipping team creation. Delete existing teams first if you want to recreate.");
    return;
  }

  const stageMap = new Map(stages.map((s) => [s.name, s.id]));

  const teamDefs = [
    {
      name: "Branch Officers",
      description: "Branch-level loan officers handling application intake",
      stageNames: ["Application Intake"],
      assignmentStrategy: "round_robin" as const,
    },
    {
      name: "Credit Team",
      description: "Credit analysts and officers handling assessment and approval",
      stageNames: ["Credit Assessment", "Approval"],
      assignmentStrategy: "least_loaded" as const,
    },
    {
      name: "Operations",
      description: "Operations team handling disbursement and payouts",
      stageNames: ["Disbursement", "Payout"],
      assignmentStrategy: "round_robin" as const,
    },
  ];

  console.log("\nCreating teams...");

  for (const def of teamDefs) {
    const pipelineStageIds = def.stageNames
      .map((n) => stageMap.get(n))
      .filter(Boolean) as string[];

    const team = await prisma.team.create({
      data: {
        tenantId,
        name: def.name,
        description: def.description,
        pipelineStageIds,
        assignmentStrategy: def.assignmentStrategy,
        assignmentConfig: {},
      },
    });

    console.log(`  Created: ${team.name}`);
    console.log(`    Stages: [${def.stageNames.join(", ")}]`);
    console.log(`    Strategy: ${def.assignmentStrategy}`);
  }

  console.log("\nNote: Add team members via the UI at /leads/config -> Teams tab.");
  console.log("Members need a userId that matches their Fineract/Mifos user ID.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
