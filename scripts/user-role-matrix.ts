#!/usr/bin/env tsx
/**
 * Print user–role matrix and role–permission matrix from Loan Matrix DB.
 * Run: npx tsx scripts/user-role-matrix.ts
 */

import { PrismaClient } from "../app/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Loan Matrix: User Role Matrix ===\n");

  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
  });

  for (const tenant of tenants) {
    console.log(`## Tenant: ${tenant.name} (${tenant.slug})\n`);

    const roles = await prisma.systemRole.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { name: "asc" },
    });

    console.log("### Roles and permissions");
    console.log("| Role (name) | Display Name | Permissions |");
    console.log("|-------------|--------------|-------------|");
    for (const role of roles) {
      const perms = (role.permissions as string[] | null) ?? [];
      const permStr = perms.length ? perms.join(", ") : "—";
      console.log(`| ${role.name} | ${role.displayName} | ${permStr} |`);
    }
    console.log("");

    const userRoles = await prisma.userRole.findMany({
      where: { tenantId: tenant.id, isActive: true },
      include: { role: true },
      orderBy: [{ mifosUserId: "asc" }, { role: { name: "asc" } }],
    });

    const byUser = new Map<number, { username: string; roles: string[] }>();
    for (const ur of userRoles) {
      const existing = byUser.get(ur.mifosUserId);
      if (!existing) {
        byUser.set(ur.mifosUserId, {
          username: ur.mifosUsername,
          roles: [ur.role.displayName],
        });
      } else {
        existing.roles.push(ur.role.displayName);
      }
    }

    console.log("### User ↔ Role assignments (mifosUserId | username | roles)");
    console.log("| Mifos User ID | Username | Roles |");
    console.log("|---------------|----------|-------|");
    const sortedUsers = Array.from(byUser.entries()).sort((a, b) => a[0] - b[0]);
    for (const [mifosUserId, { username, roles }] of sortedUsers) {
      console.log(`| ${mifosUserId} | ${username} | ${roles.join(", ")} |`);
    }
    if (sortedUsers.length === 0) {
      console.log("| (no assignments) | | |");
    }
    console.log("\n---\n");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
