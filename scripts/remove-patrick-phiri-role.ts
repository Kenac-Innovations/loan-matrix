/**
 * Script to remove LOAN_OFFICER role from Patrick Phiri
 * Run with: npx tsx scripts/remove-patrick-phiri-role.ts
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

const TENANT_ID = "cmh607k3d0000vc0k5xxjocsi";

async function main() {
  console.log("Looking up Patrick Phiri's LOAN_OFFICER role...\n");

  // Find the LOAN_OFFICER system role for this tenant
  const loanOfficerRole = await prisma.systemRole.findFirst({
    where: {
      tenantId: TENANT_ID,
      name: "LOAN_OFFICER",
    },
  });

  if (!loanOfficerRole) {
    console.error("LOAN_OFFICER role not found for tenant");
    return;
  }

  console.log(`Found LOAN_OFFICER role: ${loanOfficerRole.id}`);

  // Find Patrick Phiri's user role assignment
  // Match by username pattern since we know it's PATRICK.PHIRI
  const patrickRoles = await prisma.userRole.findMany({
    where: {
      tenantId: TENANT_ID,
      roleId: loanOfficerRole.id,
      mifosUsername: {
        contains: "PATRICK",
        mode: "insensitive",
      },
    },
    include: {
      role: true,
    },
  });

  // Filter to find the exact match for Patrick Phiri
  const patrickPhiriRole = patrickRoles.find((ur) =>
    ur.mifosUsername.toLowerCase().includes("patrick") &&
    ur.mifosUsername.toLowerCase().includes("phiri")
  );

  if (!patrickPhiriRole) {
    // Try broader search to show what we found
    const allPatricks = await prisma.userRole.findMany({
      where: {
        tenantId: TENANT_ID,
        mifosUsername: {
          contains: "PHIRI",
          mode: "insensitive",
        },
      },
      include: { role: true },
    });

    console.log("\nCould not find exact match. Users with 'PHIRI' in username:");
    for (const ur of allPatricks) {
      console.log(`  - ${ur.mifosUsername} (Mifos ID: ${ur.mifosUserId}) -> ${ur.role.name} [active: ${ur.isActive}]`);
    }
    return;
  }

  console.log(`\nFound Patrick Phiri's role assignment:`);
  console.log(`  Username: ${patrickPhiriRole.mifosUsername}`);
  console.log(`  Mifos User ID: ${patrickPhiriRole.mifosUserId}`);
  console.log(`  Role: ${patrickPhiriRole.role.name} (${patrickPhiriRole.role.displayName})`);
  console.log(`  Active: ${patrickPhiriRole.isActive}`);
  console.log(`  Assigned: ${patrickPhiriRole.assignedAt}`);

  if (!patrickPhiriRole.isActive) {
    console.log("\nRole is already inactive. No changes needed.");
    return;
  }

  // Deactivate the role (soft delete - keeps audit trail)
  await prisma.userRole.update({
    where: { id: patrickPhiriRole.id },
    data: { isActive: false },
  });

  console.log("\nDone - LOAN_OFFICER role has been removed (deactivated) for Patrick Phiri.");

  // Verify
  const verified = await prisma.userRole.findUnique({
    where: { id: patrickPhiriRole.id },
    include: { role: true },
  });
  console.log(`Verified: ${verified?.mifosUsername} -> ${verified?.role.name} [active: ${verified?.isActive}]`);

  await prisma.$disconnect();
}

main().catch(console.error);
