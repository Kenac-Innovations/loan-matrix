import { prisma } from "../lib/prisma";
import {
  runArdaStockDetailsBackfill,
  type BackfillStockIssue,
} from "../lib/arda-stock-details-backfill";
import type { FineractRequester } from "../lib/fineract-arda-stock-details";
import { isArdaStockReportsEnabled } from "../lib/tenant-arda-stock-reports";

type CliOptions = {
  tenantSlug: string;
  loanId?: number;
  limit: number;
  apply: boolean;
};

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function parseArgs(argv: string[]): CliOptions {
  let tenantSlug = "";
  let loanId: number | undefined;
  let limit = 1000;
  let apply = false;

  for (const argument of argv) {
    if (argument === "--apply") {
      apply = true;
    } else if (argument.startsWith("--tenant=")) {
      tenantSlug = argument.slice("--tenant=".length).trim();
    } else if (argument.startsWith("--loan=")) {
      loanId = parsePositiveInteger(
        argument.slice("--loan=".length),
        "Loan ID"
      );
    } else if (argument.startsWith("--limit=")) {
      limit = parsePositiveInteger(argument.slice("--limit=".length), "Limit");
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (tenantSlug.toLowerCase() !== "arda") {
    throw new Error("Backfill requires --tenant=arda.");
  }
  return { tenantSlug: "arda", loanId, limit, apply };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function createFineractRequester(tenantId: string): FineractRequester {
  const baseUrl = requiredEnv("FINERACT_BASE_URL").replace(/\/$/, "");
  const username = requiredEnv("FINERACT_USERNAME");
  const password = requiredEnv("FINERACT_PASSWORD");
  const authorization = Buffer.from(`${username}:${password}`).toString("base64");

  return async (endpoint, options = {}) => {
    const requestOptions = { ...options };
    delete requestOptions.authMode;
    const response = await fetch(
      `${baseUrl}/fineract-provider/api/v1${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`,
      {
        ...requestOptions,
        headers: {
          Authorization: `Basic ${authorization}`,
          "Fineract-Platform-TenantId": tenantId,
          "Content-Type": "application/json",
          ...(requestOptions.headers || {}),
        },
      }
    );
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(
        `${response.status} ${response.statusText}: ${data.defaultUserMessage || data.developerMessage || text}`
      );
    }
    return data;
  };
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const tenant = await prisma.tenant.findFirst({
    where: { slug: "arda", isActive: true },
    select: { id: true, slug: true, settings: true },
  });
  if (!tenant) throw new Error("The active ARDA tenant was not found.");
  if (
    !isArdaStockReportsEnabled({
      tenantSlug: tenant.slug,
      tenantSettings: tenant.settings,
    })
  ) {
    throw new Error(
      "ARDA Tenant.settings.features.ardaStockReports must be true before backfill."
    );
  }

  const rows = await prisma.stockLoanIssue.findMany({
    where: {
      tenantId: tenant.id,
      fineractLoanId: cli.loanId ?? { not: null },
    },
    include: {
      lines: {
        include: {
          inventoryItem: {
            select: { name: true, unitOfMeasure: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: cli.limit,
  });

  const issues: BackfillStockIssue[] = rows.map((row) => ({
    id: row.id,
    tenantSlug: tenant.slug,
    fineractLoanId: row.fineractLoanId,
    fineractOfficeId: row.fineractOfficeId,
    fineractOfficeName: row.fineractOfficeName,
    reference: row.reference,
    externalReference: row.externalReference,
    totalValue: row.totalValue,
    currencyCode: row.currencyCode,
    lines: row.lines.map((line) => ({
      inventoryItemId: line.inventoryItemId,
      quantity: line.quantity,
      unitValue: line.unitValue,
      lineValue: line.lineValue,
      currencyCode: line.currencyCode,
      inventoryItem: line.inventoryItem,
    })),
  }));

  const fineractTenantId =
    process.env.FINERACT_TENANT_ID?.trim() || cli.tenantSlug;
  if (fineractTenantId.toLowerCase() !== "arda") {
    throw new Error("FINERACT_TENANT_ID must be arda for this backfill.");
  }
  const previewRequester: FineractRequester = async () => {
    throw new Error("Preview mode cannot call Fineract.");
  };
  const result = await runArdaStockDetailsBackfill({
    issues,
    apply: cli.apply,
    appTenantSlug: tenant.slug,
    tenantSettings: tenant.settings,
    fineractTenantId,
    request: cli.apply
      ? createFineractRequester(fineractTenantId)
      : previewRequester,
  });

  console.log(JSON.stringify(result, null, 2));
  if (cli.apply && result.summary.errors > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
