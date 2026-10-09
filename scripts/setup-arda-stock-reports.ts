import { execFileSync } from "node:child_process";

import { prisma } from "../lib/prisma";
import { Prisma } from "../app/generated/prisma";
import {
  setupArdaStockReports,
  type ArdaLoanMatrixClient,
  type ArdaStockCatalogClient,
} from "../lib/fineract-arda-stock-report-setup";
import { ARDA_STOCK_ITEM_OPTIONS_REPORT } from "../lib/fineract-arda-stock-reports";
import type { FineractRequester } from "../lib/fineract-arda-stock-details";

type CliOptions = {
  tenantSlug: string;
  roleIds: number[];
  apply: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  let tenantSlug = "";
  let apply = false;
  const roleIds: number[] = [];

  for (const argument of argv) {
    if (argument === "--apply") {
      apply = true;
    } else if (argument.startsWith("--tenant=")) {
      tenantSlug = argument.slice("--tenant=".length).trim();
    } else if (argument.startsWith("--role-id=")) {
      const roleId = Number(argument.slice("--role-id=".length));
      if (!Number.isInteger(roleId) || roleId <= 0) {
        throw new Error(`Invalid role ID: ${argument}`);
      }
      roleIds.push(roleId);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!tenantSlug) {
    throw new Error("Pass --tenant=arda.");
  }
  if (roleIds.length === 0) {
    throw new Error("Pass at least one --role-id=<positive integer>.");
  }
  return { tenantSlug, roleIds, apply };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function createLoanMatrixClient(): ArdaLoanMatrixClient {
  return {
    getTenantBySlug: async (slug) =>
      prisma.tenant.findFirst({
        where: { slug, isActive: true },
        select: { id: true, slug: true, settings: true },
      }),
    updateTenantSettings: async (id, settings) => {
      await prisma.tenant.update({
        where: { id },
        data: { settings: settings as Prisma.InputJsonValue },
      });
    },
  };
}

function createFineractClient(tenantId: string): FineractRequester {
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

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

class PsqlArdaStockCatalogClient implements ArdaStockCatalogClient {
  private readonly host = requiredEnv("FINERACT_DB_HOST");
  private readonly port = requiredEnv("FINERACT_DB_PORT");
  private readonly user = requiredEnv("FINERACT_DB_USER");
  private readonly password = requiredEnv("FINERACT_DB_PASSWORD");

  constructor(private readonly database: string) {}

  private run(sql: string): string {
    return execFileSync(
      "psql",
      [
        "-h",
        this.host,
        "-p",
        this.port,
        "-U",
        this.user,
        "-d",
        this.database,
        "-X",
        "-q",
        "-A",
        "-t",
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
      ],
      {
        env: { ...process.env, PGPASSWORD: this.password },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }
    ).trim();
  }

  async getStockItemParameterId(): Promise<number | null> {
    const output = this.run(
      `SELECT id FROM stretchy_parameter WHERE parameter_name = ${sqlLiteral(ARDA_STOCK_ITEM_OPTIONS_REPORT)} LIMIT 1;`
    );
    if (!output) return null;
    const id = Number(output.split("\n").at(-1));
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  async upsertStockItemParameter(): Promise<number> {
    const requiredColumns = [
      "id",
      "parameter_name",
      "parameter_variable",
      "parameter_label",
      "parameter_displaytype",
      "parameter_formattype",
      "parameter_default",
      "special",
      "selectone",
      "selectall",
      "parameter_sql",
      "parent_id",
    ];
    const requiredArray = requiredColumns.map(sqlLiteral).join(", ");
    const reportName = sqlLiteral(ARDA_STOCK_ITEM_OPTIONS_REPORT);

    this.run(`BEGIN;
DO $$
DECLARE missing_columns text;
BEGIN
  SELECT string_agg(required.name, ', ' ORDER BY required.name)
    INTO missing_columns
  FROM unnest(ARRAY[${requiredArray}]) AS required(name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = current_schema()
      AND c.table_name = 'stretchy_parameter'
      AND lower(c.column_name) = required.name
  );

  IF missing_columns IS NOT NULL THEN
    RAISE EXCEPTION 'stretchy_parameter is missing required columns: %', missing_columns;
  END IF;
END $$;

INSERT INTO stretchy_parameter (
  parameter_name,
  parameter_variable,
  parameter_label,
  "parameter_displayType",
  "parameter_FormatType",
  parameter_default,
  special,
  "selectOne",
  "selectAll",
  parameter_sql,
  parent_id
) VALUES (
  ${reportName}, 'stockItemId', 'Stock Item', 'select', 'string', '0', NULL, 'N', 'Y', NULL, NULL
)
ON CONFLICT (parameter_name) DO UPDATE SET
  parameter_variable = EXCLUDED.parameter_variable,
  parameter_label = EXCLUDED.parameter_label,
  "parameter_displayType" = EXCLUDED."parameter_displayType",
  "parameter_FormatType" = EXCLUDED."parameter_FormatType",
  parameter_default = EXCLUDED.parameter_default,
  "selectOne" = EXCLUDED."selectOne",
  "selectAll" = EXCLUDED."selectAll",
  parameter_sql = EXCLUDED.parameter_sql,
  parent_id = EXCLUDED.parent_id;
COMMIT;`);

    const id = await this.getStockItemParameterId();
    if (!id) throw new Error("Unable to read the Stock Item parameter after upsert.");
    return id;
  }
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const fineractDatabaseName =
    process.env.FINERACT_DB_NAME?.trim() || "fineract_tenant_arda";
  const fineractTenantId =
    process.env.FINERACT_TENANT_ID?.trim() || cli.tenantSlug;

  const previewLoanMatrix: ArdaLoanMatrixClient = {
    getTenantBySlug: async (slug) => ({ id: "preview", slug, settings: {} }),
    updateTenantSettings: async () => {
      throw new Error("Preview cannot update Loan Matrix.");
    },
  };
  const unavailableCatalog: ArdaStockCatalogClient = {
    getStockItemParameterId: async () => null,
    upsertStockItemParameter: async () => {
      throw new Error("Preview cannot update the Fineract catalog.");
    },
  };
  const unavailableFineract: FineractRequester = async () => {
    throw new Error("Preview cannot call the Fineract API.");
  };

  const result = await setupArdaStockReports({
    tenantSlug: cli.tenantSlug,
    fineractTenantId,
    fineractDatabaseName,
    roleIds: cli.roleIds,
    apply: cli.apply,
    loanMatrix: cli.apply ? createLoanMatrixClient() : previewLoanMatrix,
    catalog: cli.apply
      ? new PsqlArdaStockCatalogClient(fineractDatabaseName)
      : unavailableCatalog,
    fineract: cli.apply ? createFineractClient(fineractTenantId) : unavailableFineract,
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
