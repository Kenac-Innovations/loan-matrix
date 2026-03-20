#!/usr/bin/env tsx
/**
 * Seed the Omama tenant's full loan contract template into the database.
 * Reads the HTML from public/tenant-templates/omama/full-loan-template-final.html
 * and upserts it into LoanContractTemplate.
 *
 * Prerequisites:
 * - Run the migration: npx prisma migrate deploy (or migrate dev)
 * - Omama tenant must exist in the database
 *
 * Usage:
 *   npx tsx scripts/seed-omama-contract-template.ts
 *
 * Or with a custom HTML file:
 *   CONTRACT_TEMPLATE_DIR=/path/to/dir npx tsx scripts/seed-omama-contract-template.ts
 */

import { prisma } from "../lib/prisma";
import * as fs from "fs";
import * as path from "path";

const db = prisma;
const OMAMA_SLUG = "omama";
const TEMPLATE_SLUG = "full-loan";

async function main() {
  const templateDir = process.env.CONTRACT_TEMPLATE_DIR;
  const htmlPath = templateDir
    ? path.join(templateDir, "full-loan-template-final.html")
    : path.join(process.cwd(), "public", "tenant-templates", "omama", "full-loan-template-final.html");

  if (!fs.existsSync(htmlPath)) {
    console.error(`HTML file not found: ${htmlPath}`);
    process.exit(1);
  }

  const tenant = await db.tenant.findFirst({
    where: { slug: OMAMA_SLUG, isActive: true },
  });
  if (!tenant) {
    console.error(
      `Tenant with slug "${OMAMA_SLUG}" not found. Create the Omama tenant first (e.g. via admin or seed).`
    );
    process.exit(1);
  }

  const html = fs.readFileSync(htmlPath, "utf-8");

  await db.loanContractTemplate.upsert({
    where: {
      tenantId_slug: { tenantId: tenant.id, slug: TEMPLATE_SLUG },
    },
    create: {
      tenantId: tenant.id,
      name: "Full Loan Template (Omama)",
      slug: TEMPLATE_SLUG,
      content: html,
      isDefault: true,
    },
    update: {
      name: "Full Loan Template (Omama)",
      content: html,
      isDefault: true,
      updatedAt: new Date(),
    },
  });
  console.log(
    `Saved contract template for tenant "${OMAMA_SLUG}" (slug: ${TEMPLATE_SLUG}).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
