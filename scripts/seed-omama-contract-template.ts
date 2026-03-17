#!/usr/bin/env tsx
/**
 * Seed the Omama tenant's full loan contract template into the database.
 * Copies the HTML into LoanContractTemplate and (optionally) copies image assets to public.
 *
 * Prerequisites:
 * - Run the migration: npx prisma migrate deploy (or migrate dev)
 * - Omama tenant must exist in the database
 *
 * Usage:
 *   CONTRACT_TEMPLATE_DIR=/path/to/full-loan-template-final npx tsx scripts/seed-omama-contract-template.ts
 *
 * Example:
 *   CONTRACT_TEMPLATE_DIR=/Users/dazzmurenga/Downloads/full-loan-template-final npx tsx scripts/seed-omama-contract-template.ts
 *
 * CONTRACT_TEMPLATE_DIR must contain:
 *   - full-loan-template-final.html
 *   - 1773751365_full-loan-template-final/ (folder with images referenced in the HTML)
 */

import { PrismaClient } from "../app/generated/prisma";
import { prisma } from "../lib/prisma";
import * as fs from "fs";
import * as path from "path";

const db = prisma as PrismaClient;
const OMAMA_SLUG = "omama";
const TEMPLATE_SLUG = "full-loan";
const IMAGE_FOLDER_NAME = "1773751365_full-loan-template-final";
const PUBLIC_OMAMA_TEMPLATES = path.join(
  process.cwd(),
  "public",
  "tenant-templates",
  "omama"
);

async function main() {
  const templateDir = process.env.CONTRACT_TEMPLATE_DIR;
  if (!templateDir) {
    console.error(
      "Missing CONTRACT_TEMPLATE_DIR. Set it to the folder containing full-loan-template-final.html"
    );
    console.error(
      "Example: CONTRACT_TEMPLATE_DIR=/Users/dazzmurenga/Downloads/full-loan-template-final npx tsx scripts/seed-omama-contract-template.ts"
    );
    process.exit(1);
  }

  const htmlPath = path.join(templateDir, "full-loan-template-final.html");
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

  let html = fs.readFileSync(htmlPath, "utf-8");
  // So that images load when the HTML is shown in the app, point image paths to our public folder
  const imageBasePath = `/tenant-templates/omama/${IMAGE_FOLDER_NAME}`;
  html = html.replace(
    new RegExp(IMAGE_FOLDER_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/", "g"),
    `${imageBasePath}/`
  );

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

  // Copy image folder to public so the HTML can load images
  const sourceImageDir = path.join(templateDir, IMAGE_FOLDER_NAME);
  const destImageDir = path.join(PUBLIC_OMAMA_TEMPLATES, IMAGE_FOLDER_NAME);
  if (fs.existsSync(sourceImageDir)) {
    fs.mkdirSync(PUBLIC_OMAMA_TEMPLATES, { recursive: true });
    if (fs.existsSync(destImageDir)) {
      fs.rmSync(destImageDir, { recursive: true });
    }
    fs.cpSync(sourceImageDir, destImageDir, { recursive: true });
    console.log(`Copied images to ${destImageDir}`);
  } else {
    console.warn(
      `Image folder not found: ${sourceImageDir}. Template HTML may reference images that will not load.`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
