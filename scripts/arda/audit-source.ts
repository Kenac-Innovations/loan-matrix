import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@/app/generated/prisma";
import {
  buildArdaSourceAuditManifest,
  type ArdaAuditRecord,
} from "@/lib/arda-source-audit-manifest";
import {
  ArdaSourceAuditOptionsError,
  parseArdaSourceAuditOptions,
} from "@/lib/arda-source-audit-options";
import { FineractAPIService } from "@/lib/fineract-api";

const HELP = `Usage:
  FINERACT_AUDIT_USERNAME=... FINERACT_AUDIT_PASSWORD=... pnpm exec tsx scripts/arda/audit-source.ts \\
    --source-loan-matrix-url=postgresql://... \\
    --source-fineract-base-url=https://... \\
    --out=artifacts/arda-source-manifest.json

This command is read-only against Omama. It does not copy, update, or delete source records.`;

type FineractProductRecord = {
  id: number;
  name?: string;
  externalId?: string | null;
};

function asInventoryAuditRecords(
  items: Array<{
    id: string;
    sku: string;
    name: string;
    balances: Array<{
      fineractOfficeId: number;
      fineractOfficeName: string | null;
      quantityOnHand: { toString(): string };
      quantityReserved: { toString(): string };
      stockValue: { toString(): string };
      currencyCode: string;
    }>;
  }>,
): ArdaAuditRecord[] {
  return items.map((item) => ({
    id: item.id,
    externalId: item.sku,
    name: item.name,
    tags: [],
    balances: item.balances.map((balance) => ({
      officeId: balance.fineractOfficeId,
      officeName: balance.fineractOfficeName,
      quantityOnHand: balance.quantityOnHand.toString(),
      quantityReserved: balance.quantityReserved.toString(),
      stockValue: balance.stockValue.toString(),
      currencyCode: balance.currencyCode,
    })),
  }));
}

async function run() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  const options = parseArdaSourceAuditOptions(args);
  const username = process.env.FINERACT_AUDIT_USERNAME;
  const password = process.env.FINERACT_AUDIT_PASSWORD;
  if (!username || !password) {
    throw new ArdaSourceAuditOptionsError(
      "FINERACT_AUDIT_USERNAME and FINERACT_AUDIT_PASSWORD are required for the read-only Fineract audit.",
    );
  }

  const sourcePrisma = new PrismaClient({
    datasources: { db: { url: options.sourceLoanMatrixUrl } },
  });

  try {
    const sourceTenant = await sourcePrisma.tenant.findUnique({
      where: { slug: "omama" },
      select: { id: true },
    });
    if (!sourceTenant) {
      throw new Error("The source Loan Matrix database does not contain the Omama tenant.");
    }

    const [inventoryItems, contractTemplates] = await Promise.all([
      sourcePrisma.inventoryItem.findMany({
        where: { tenantId: sourceTenant.id },
        select: {
          id: true,
          sku: true,
          name: true,
          balances: {
            select: {
              fineractOfficeId: true,
              fineractOfficeName: true,
              quantityOnHand: true,
              quantityReserved: true,
              stockValue: true,
              currencyCode: true,
            },
          },
        },
        orderBy: { sku: "asc" },
      }),
      sourcePrisma.loanContractTemplate.findMany({
        where: { tenantId: sourceTenant.id },
        select: { id: true, slug: true, name: true },
        orderBy: { slug: "asc" },
      }),
    ]);

    const fineract = new FineractAPIService({
      baseUrl: options.sourceFineractBaseUrl.replace(/\/$/, ""),
      username,
      password,
      tenantId: options.sourceFineractTenant,
    });
    const loanProducts = (await fineract.getLoanProducts()) as FineractProductRecord[];

    const manifest = buildArdaSourceAuditManifest({
      inventory: asInventoryAuditRecords(inventoryItems),
      loanProducts: loanProducts
        .map((product) => ({
          id: product.id,
          externalId: product.externalId,
          name: product.name,
          tags: [],
        }))
        .sort((left, right) => String(left.id).localeCompare(String(right.id))),
      contractTemplates: contractTemplates.map((template) => ({
        id: template.id,
        externalId: template.slug,
        name: template.name,
        tags: [],
      })),
    });

    await mkdir(path.dirname(options.out), { recursive: true });
    await writeFile(options.out, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    console.log(`ARDA source manifest written to ${options.out}`);
    console.log(
      `Copyable: ${manifest.summary.copyAllowed}; review required: ${manifest.summary.reviewRequired}; excluded: ${manifest.summary.excluded}.`,
    );
  } finally {
    await sourcePrisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
