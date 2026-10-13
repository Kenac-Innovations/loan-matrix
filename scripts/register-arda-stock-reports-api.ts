import { Prisma } from "../app/generated/prisma";
import { registerArdaStockReportsWithFineractApi } from "../lib/arda-stock-report-api-registration";
import type { FineractRequester } from "../lib/fineract-arda-stock-details";
import { mergeArdaStockReportSetting } from "../lib/fineract-arda-stock-report-setup";
import {
  ARDA_STOCK_REPORT_NAMES,
  ARDA_SUMMARY_REPORT_NAMES,
} from "../lib/fineract-arda-stock-reports";
import { prisma } from "../lib/prisma";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function parseArgs(argv: string[]): { apply: boolean; tenantSlug: string } {
  let apply = false;
  let tenantSlug = "";
  for (const argument of argv) {
    if (argument === "--apply") apply = true;
    else if (argument.startsWith("--tenant=")) {
      tenantSlug = argument.slice("--tenant=".length).trim().toLowerCase();
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (tenantSlug !== "arda") throw new Error("Pass --tenant=arda.");
  return { apply, tenantSlug };
}

function createFineractRequest(): FineractRequester {
  const baseUrl = requiredEnv("FINERACT_BASE_URL").replace(/\/$/, "");
  const authorization = `Basic ${Buffer.from(
    `${requiredEnv("FINERACT_USERNAME")}:${requiredEnv("FINERACT_PASSWORD")}`
  ).toString("base64")}`;

  return async (endpoint, options = {}) => {
    const requestOptions = { ...options };
    delete requestOptions.authMode;
    const response = await fetch(
      `${baseUrl}/fineract-provider/api/v1${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`,
      {
        ...requestOptions,
        headers: {
          Authorization: authorization,
          "Fineract-Platform-TenantId": "arda",
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

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const tenant = await prisma.tenant.findFirst({
    where: { slug: "arda", isActive: true },
    select: { id: true, settings: true },
  });
  if (!tenant) throw new Error("The active ARDA Loan Matrix tenant was not found.");
  const tenantSettings = mergeArdaStockReportSetting(tenant.settings);

  if (!options.apply) {
    console.log(
      JSON.stringify(
        {
          mode: "preview",
          tenant: options.tenantSlug,
          fineractTenant: "arda",
          dataTable: "arda_stock_details",
          reports: [...ARDA_SUMMARY_REPORT_NAMES, ...ARDA_STOCK_REPORT_NAMES],
        },
        null,
        2
      )
    );
    return;
  }

  const result = await registerArdaStockReportsWithFineractApi({
    tenantSlug: "arda",
    tenantSettings,
    fineractTenantId: "arda",
    request: createFineractRequest(),
  });
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { settings: tenantSettings as Prisma.InputJsonValue },
  });

  console.log(
    JSON.stringify(
      {
        mode: "applied",
        tenant: "arda",
        fineractTenant: "arda",
        featureEnabled: true,
        ...result,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
