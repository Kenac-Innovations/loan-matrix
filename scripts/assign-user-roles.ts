/**
 * Script to assign roles to users based on the provided mapping
 * Run with: npx tsx scripts/assign-user-roles.ts
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

const FINERACT_BASE_URL = process.env.FINERACT_BASE_URL || "http://10.10.0.143";
const FINERACT_TENANT_ID = "goodfellow";
const FINERACT_USERNAME = process.env.FINERACT_USERNAME || "mifos";
const FINERACT_PASSWORD = process.env.FINERACT_PASSWORD || "password";

// User role mapping from the provided table
const userRoleMapping: { name: string; branch: string; role: string }[] = [
  { name: "HARRY.LUNGU", branch: "CHINGOLA", role: "BRANCH MANAGER" },
  { name: "ABIGAIL.ZIMBA", branch: "CHINGOLA", role: "LOAN OFFICER" },
  { name: "RONSU.CHIWATI", branch: "CHINSALI", role: "BRANCH MANAGER" },
  { name: "SIAME.HOLLY", branch: "CHINSALI", role: "LOAN OFFICER" },
  { name: "MARGARET.MWANZA", branch: "CHIPATA", role: "BRANCH MANAGER" },
  { name: "BERTHA.HABASIMBI", branch: "CHIPATA", role: "LOAN OFFICER" },
  { name: "STEPHEN.SIMUSOKWE", branch: "CHIPATA", role: "LOAN OFFICER" },
  { name: "HELLEN.NYIRENDA", branch: "CHIPATA", role: "LOAN OFFICER" },
  { name: "MUKAMULUTI.MWILA", branch: "CHOMA", role: "BRANCH MANAGER" },
  { name: "CECILIA.PHIRI", branch: "CHOMA", role: "LOAN OFFICER" },
  { name: "BARBARA.GONDWE", branch: "CHONGWE", role: "LOAN OFFICER" },
  { name: "EUNICE.MALUNGA", branch: "CHONGWE", role: "BRANCH MANAGER" },
  { name: "SUSAN.MWAMBA", branch: "HEAD OFFICE", role: "CREDIT OFFICER" },
  { name: "GRACIOUS.KAZOKA", branch: "KABWE", role: "LOAN OFFICER" },
  { name: "BRIDGET.MULENGA", branch: "KABWE", role: "LOAN OFFICER" },
  { name: "CHIPONDE.CHELA", branch: "KABWE", role: "BRANCH MANAGER" },
  { name: "COURTNEY.SIMWIZI", branch: "KAFUE", role: "LOAN OFFICER" },
  { name: "CHILESHE.MINGOCHI", branch: "KAFUE", role: "LOAN OFFICER" },
  { name: "SYLVIA.MWILA", branch: "KAFUE", role: "BRANCH MANAGER" },
  { name: "MOSES.SIMUKONDA", branch: "KALUMBILA", role: "BRANCH MANAGER" },
  { name: "MOSES.CHISHA", branch: "KAOMA", role: "LOAN OFFICER" },
  { name: "MUBANGA.KANGWA", branch: "KAOMA", role: "BRANCH MANAGER" },
  { name: "HARRIET.KANGWA", branch: "KASAMA", role: "LOAN OFFICER" },
  { name: "MWILA.LUMANDE", branch: "KASAMA", role: "LOAN OFFICER" },
  { name: "MOFFAT.TONGA", branch: "KASAMA", role: "BRANCH MANAGER" },
  { name: "HEZRON.SICHILONGO", branch: "KAWAMBWA", role: "BRANCH MANAGER" },
  { name: "IREEN.MULABWA", branch: "KAWAMBWA", role: "BRANCH MANAGER" },
  { name: "PRINCE.MWALE", branch: "KITWE", role: "LOAN OFFICER" },
  { name: "JASPER.MWALE", branch: "KITWE", role: "LOAN OFFICER" },
  { name: "MERCY.CHANSA", branch: "KITWE", role: "LOAN OFFICER" },
  { name: "PATRICK.NGANDU", branch: "KITWE", role: "LOAN OFFICER" },
  { name: "ROSEMARY.HANYUKA", branch: "KITWE", role: "LOAN OFFICER" },
  { name: "MIPA.MULENGA", branch: "KITWE", role: "BRANCH MANAGER" },
  { name: "ROXANA.CHOMBA", branch: "KITWE", role: "LOAN OFFICER" },
  { name: "AGNESS.ZULU", branch: "LIVINGSTONE", role: "LOAN OFFICER" },
  { name: "CONNIE.KONALA", branch: "LIVINGSTONE", role: "LOAN OFFICER" },
  { name: "PAULINE.SINYANGWE", branch: "LIVINGSTONE", role: "BRANCH MANAGER" },
  { name: "AUDREY.NAWALE", branch: "LUANSHYA", role: "LOAN OFFICER" },
  { name: "NINA.KABAYO", branch: "LUANSHYA", role: "LOAN OFFICER" },
  { name: "TRAVIS.MUNTHALI", branch: "LUANSHYA", role: "BRANCH MANAGER" },
  { name: "MAJORY.NONDE", branch: "LUMWANA", role: "LOAN OFFICER" },
  { name: "GWENY.MUBANGA", branch: "LUMWANA", role: "BRANCH MANAGER" },
  { name: "DANIEL.TEMBO", branch: "LUNDAZI", role: "BRANCH MANAGER" },
  { name: "KUNDA.MAKAKO", branch: "LUSAKA PREMIUM", role: "LOAN OFFICER" },
  { name: "MUMBA.MAINZA", branch: "LUSAKA PREMIUM", role: "LOAN OFFICER" },
  { name: "RUTH.KATONGO", branch: "LUSAKA PREMIUM", role: "BRANCH MANAGER" },
  { name: "LEAH.MUYUNDA", branch: "LUSAKA TOWN", role: "LOAN OFFICER" },
  { name: "PATRICK.PHIRI", branch: "LUSAKA TOWN", role: "LOAN OFFICER" },
  { name: "PHILLIS.CHUNJE", branch: "LUSAKA TOWN", role: "LOAN OFFICER" },
  { name: "THANDIWE.SAKALA", branch: "LUSAKA TOWN", role: "BRANCH MANAGER" },
  { name: "BWALYA.CHITUTA", branch: "MANSA", role: "LOAN OFFICER" },
  { name: "JACKSON.MULANDU", branch: "MANSA", role: "BRANCH MANAGER" },
  { name: "JOSEPHINE.PHIRI", branch: "MAZABUKA", role: "BRANCH MANAGER" },
  { name: "CATHERINE.MWALE", branch: "MBALA", role: "BRANCH MANAGER" },
  { name: "ALEX.TANDEO", branch: "MKUSHI", role: "LOAN OFFICER" },
  { name: "MATERDEI.KALOTO", branch: "MKUSHI", role: "BRANCH MANAGER" },
  { name: "HOPE.CHITUTA", branch: "MOBILE", role: "LOAN OFFICER" },
  { name: "NAI.KAUNDI", branch: "MOBILE", role: "LOAN OFFICER" },
  { name: "NANCY.MUKANDO", branch: "MOBILE", role: "BRANCH MANAGER" },
  { name: "ETAMBUYU.NAWA", branch: "MONGU", role: "LOAN OFFICER" },
  { name: "LYAMBA.AKALEMWA", branch: "MONGU", role: "LOAN OFFICER" },
  { name: "INONGE.SITUMBEKO", branch: "MONGU", role: "BRANCH MANAGER" },
  { name: "RICHARD.MASWABI", branch: "MONZE", role: "LOAN OFFICER" },
  { name: "ROSE.MVULA", branch: "MONZE", role: "BRANCH MANAGER" },
  { name: "EMILY.NAKAZWE", branch: "MPIKA", role: "LOAN OFFICER" },
  { name: "HARRIET.BANDA", branch: "MPIKA", role: "BRANCH MANAGER" },
  { name: "CHALWE.MUTALE", branch: "MUMBWA", role: "LOAN OFFICER" },
  { name: "THELMA.MUKANDO", branch: "MUMBWA", role: "BRANCH MANAGER" },
  { name: "CAROL.MANDONA", branch: "NAKONDE", role: "LOAN OFFICER" },
  { name: "SWEETER.PASI", branch: "NAKONDE", role: "BRANCH MANAGER" },
  { name: "GETRUDE.KAYOMBO", branch: "NDOLA", role: "LOAN OFFICER" },
  { name: "HELLEN.KABANDA", branch: "NDOLA", role: "LOAN OFFICER" },
  { name: "MICHAEL.PONYA", branch: "NDOLA", role: "LOAN OFFICER" },
  { name: "IVY.MTHUNZI", branch: "NDOLA", role: "BRANCH MANAGER" },
  { name: "DOMINIC.BANDA", branch: "PETAUKE", role: "LOAN OFFICER" },
  { name: "MOLLY.MWALE", branch: "PETAUKE", role: "BRANCH MANAGER" },
  { name: "COLLINS.MPONGWE", branch: "SOLWEZI", role: "LOAN OFFICER" },
  { name: "GIFT.MBEWE", branch: "SOLWEZI", role: "LOAN OFFICER" },
  { name: "MARTIN.KIYEYA", branch: "SOLWEZI", role: "LOAN OFFICER" },
  { name: "SOPHIE.TEMBO", branch: "SOLWEZI", role: "LOAN OFFICER" },
  { name: "INONGE.SAMBOLE", branch: "SOLWEZI", role: "BRANCH MANAGER" },
  { name: "SUWILANJI.SINKALA", branch: "UTH BRANCH", role: "LOAN OFFICER" },
  { name: "MUNDA.MILIMO", branch: "UTH BRANCH", role: "LOAN OFFICER" },
  { name: "NAMUNDA.CHEEMBO", branch: "UTH BRANCH", role: "LOAN OFFICER" },
  { name: "JULIA.CHITIMA", branch: "UTH BRANCH", role: "BRANCH MANAGER" },
];

// Map role names to system role names
const roleNameMapping: Record<string, string> = {
  "BRANCH MANAGER": "BRANCH_MANAGER",
  "LOAN OFFICER": "LOAN_OFFICER",
  "CREDIT OFFICER": "CREDIT_OFFICER",
};

async function fetchFineractUsers(): Promise<any[]> {
  const authToken = Buffer.from(
    `${FINERACT_USERNAME}:${FINERACT_PASSWORD}`
  ).toString("base64");

  const response = await fetch(
    `${FINERACT_BASE_URL}/fineract-provider/api/v1/users`,
    {
      headers: {
        Authorization: `Basic ${authToken}`,
        "Fineract-Platform-TenantId": FINERACT_TENANT_ID,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.status}`);
  }

  return response.json();
}

function normalizeNameForMatch(name: string): string {
  // Convert "HARRY.LUNGU" or "HARRY LUNGU" to "harry lungu" for matching
  return name.toLowerCase().replace(/[._]/g, " ").trim();
}

async function main() {
  console.log("Starting role assignment...\n");

  // Use Goodfellow Organization tenant where the roles are defined
  const TENANT_ID = "cmh607k3d0000vc0k5xxjocsi";
  
  const tenant = await prisma.tenant.findUnique({
    where: { id: TENANT_ID }
  });
  if (!tenant) {
    console.error("Tenant not found!");
    return;
  }
  console.log("Tenant:", tenant.id, tenant.name);

  // Get system roles for this tenant
  const systemRoles = await prisma.systemRole.findMany({
    where: { tenantId: TENANT_ID },
  });
  console.log("\nSystem roles found:", systemRoles.length);

  const roleMap: Record<string, string> = {};
  for (const role of systemRoles) {
    roleMap[role.name] = role.id;
    console.log(`  ${role.name}: ${role.id}`);
  }

  // Fetch Fineract users
  console.log("\nFetching Fineract users...");
  const fineractUsers = await fetchFineractUsers();
  console.log(`Found ${fineractUsers.length} Fineract users`);

  // Create user lookup by normalized name
  const userLookup: Record<string, { id: number; username: string; firstname: string; lastname: string }> = {};
  for (const user of fineractUsers) {
    const fullName = `${user.firstname || ""} ${user.lastname || ""}`.trim();
    const normalizedName = normalizeNameForMatch(fullName);
    userLookup[normalizedName] = {
      id: user.id,
      username: user.username,
      firstname: user.firstname,
      lastname: user.lastname,
    };
  }

  console.log("\n=== ASSIGNING ROLES ===\n");

  let assignedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const mapping of userRoleMapping) {
    const normalizedMappingName = normalizeNameForMatch(mapping.name);
    const fineractUser = userLookup[normalizedMappingName];

    if (!fineractUser) {
      console.log(`⚠️  User not found in Fineract: ${mapping.name}`);
      skippedCount++;
      continue;
    }

    const systemRoleName = roleNameMapping[mapping.role];
    if (!systemRoleName) {
      console.log(`⚠️  Unknown role: ${mapping.role} for user ${mapping.name}`);
      skippedCount++;
      continue;
    }

    const roleId = roleMap[systemRoleName];
    if (!roleId) {
      console.log(`⚠️  Role not found in system: ${systemRoleName}`);
      skippedCount++;
      continue;
    }

    try {
      // Check if user role already exists
      const existingRole = await prisma.userRole.findFirst({
        where: {
          tenantId: tenant.id,
          mifosUserId: fineractUser.id,
          roleId: roleId,
        },
      });

      if (existingRole) {
        console.log(`⏭️  Role already assigned: ${mapping.name} -> ${mapping.role}`);
        skippedCount++;
        continue;
      }

      // Create user role
      await prisma.userRole.create({
        data: {
          tenantId: tenant.id,
          mifosUserId: fineractUser.id,
          mifosUsername: fineractUser.username,
          roleId: roleId,
          assignedBy: "system",
          isActive: true,
        },
      });

      console.log(`✅ Assigned: ${mapping.name} (ID: ${fineractUser.id}) -> ${mapping.role} (${mapping.branch})`);
      assignedCount++;
    } catch (error) {
      console.error(`❌ Error assigning role for ${mapping.name}:`, error);
      errorCount++;
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Assigned: ${assignedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);

  await prisma.$disconnect();
}

main().catch(console.error);
