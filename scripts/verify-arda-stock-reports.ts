import { execFileSync } from "node:child_process";

import { prisma } from "../lib/prisma";
import {
  extractReportParameterVariables,
  validateArdaReportFixtures,
  verifyArdaStockReportIsolation,
  verifyReportColumns,
  type ReportRow,
  type StockReportArtifactSnapshot,
} from "../lib/arda-stock-report-verification";
import {
  ARDA_STOCK_REPORT_NAMES,
  buildArdaStockReportDefinitions,
} from "../lib/fineract-arda-stock-reports";

type CliOptions = {
  tenantSlug: string;
  controlTenantSlug: string;
  startDate: string;
  endDate: string;
};

type ApiRequest = (endpoint: string, options?: RequestInit) => Promise<unknown>;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isoDate(value: string, name: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${name} must be YYYY-MM-DD.`);
  }
  return value;
}

function parseArgs(argv: string[]): CliOptions {
  let tenantSlug = "";
  let controlTenantSlug = "";
  let startDate = "";
  let endDate = "";
  for (const argument of argv) {
    if (argument.startsWith("--tenant=")) {
      tenantSlug = argument.slice("--tenant=".length).trim();
    } else if (argument.startsWith("--control-tenant=")) {
      controlTenantSlug = argument.slice("--control-tenant=".length).trim();
    } else if (argument.startsWith("--start=")) {
      startDate = isoDate(argument.slice("--start=".length), "Start date");
    } else if (argument.startsWith("--end=")) {
      endDate = isoDate(argument.slice("--end=".length), "End date");
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (tenantSlug.toLowerCase() !== "arda") {
    throw new Error("Verification requires --tenant=arda.");
  }
  if (!controlTenantSlug || controlTenantSlug.toLowerCase() === "arda") {
    throw new Error("Pass a non-ARDA --control-tenant, normally goodfellow.");
  }
  if (!startDate || !endDate || startDate > endDate) {
    throw new Error("Pass a valid inclusive --start and --end range.");
  }
  return { tenantSlug: "arda", controlTenantSlug, startDate, endDate };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function createApiClient(tenantId: string): ApiRequest {
  const baseUrl = requiredEnv("FINERACT_BASE_URL").replace(/\/$/, "");
  const username = requiredEnv("FINERACT_USERNAME");
  const password = requiredEnv("FINERACT_PASSWORD");
  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  return async (endpoint, options = {}) => {
    const response = await fetch(
      `${baseUrl}/fineract-provider/api/v1${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`,
      {
        ...options,
        headers: {
          Authorization: `Basic ${auth}`,
          "Fineract-Platform-TenantId": tenantId,
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      }
    );
    const responseText = await response.text();
    const data = responseText ? JSON.parse(responseText) : {};
    if (!response.ok) {
      throw new Error(
        `${tenantId} ${response.status}: ${data.defaultUserMessage || data.developerMessage || responseText}`
      );
    }
    return data;
  };
}

function featureEnabled(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  const features = (settings as { features?: unknown }).features;
  return Boolean(
    features &&
      typeof features === "object" &&
      !Array.isArray(features) &&
      (features as { ardaStockReports?: unknown }).ardaStockReports === true
  );
}

function parseReportRows(value: unknown): ReportRow[] {
  if (Array.isArray(value)) return value as ReportRow[];
  if (!value || typeof value !== "object") return [];
  const result = value as {
    columnHeaders?: Array<{ columnName?: string }>;
    data?: Array<{ row?: unknown[] }>;
    pageItems?: unknown[];
  };
  if (Array.isArray(result.pageItems)) return result.pageItems as ReportRow[];
  if (!Array.isArray(result.columnHeaders) || !Array.isArray(result.data)) return [];
  const headers = result.columnHeaders.map((header) => String(header.columnName || ""));
  return result.data.map((item) =>
    Object.fromEntries(headers.map((header, index) => [header, item.row?.[index]]))
  );
}

async function artifactSnapshot(input: {
  tenantSlug: string;
  settings: unknown;
  api: ApiRequest;
}): Promise<StockReportArtifactSnapshot> {
  const reports = (await input.api("/reports")) as Array<{
    reportName?: string;
  }>;
  const reportNames = Array.isArray(reports)
    ? reports.map((report) => String(report.reportName || "")).filter(Boolean)
    : [];
  const tables = await input.api("/datatables?apptable=m_loan");
  const dataTables = Array.isArray(tables)
    ? tables
        .map((table) => {
          const item = record(table);
          return String(
            item.registeredTableName || item.datatableName || item.name || ""
          );
        })
        .filter(Boolean)
    : [];
  const reportParameters: Record<string, string[]> = {};
  for (const name of ARDA_STOCK_REPORT_NAMES) {
    if (!reportNames.includes(name)) continue;
    const parameters = await input.api(
      `/runreports/FullParameterList?R_reportListing=${encodeURIComponent(`'${name}'`)}&parameterType=true`
    );
    reportParameters[name] = extractReportParameterVariables(parameters);
  }
  const permissions = await input.api("/permissions");
  return {
    tenantSlug: input.tenantSlug,
    featureEnabled: featureEnabled(input.settings),
    reports: reportNames,
    dataTables,
    reportParameters,
    permissions: Array.isArray(permissions)
      ? permissions
          .map((permission) => String(record(permission).code || ""))
          .filter(Boolean)
      : [],
  };
}

async function runReport(
  api: ApiRequest,
  reportName: string,
  startDate: string,
  endDate: string
): Promise<ReportRow[]> {
  const query = new URLSearchParams({
    R_startDate: startDate,
    R_endDate: endDate,
    R_officeId: "-1",
    R_currencyId: "-1",
    R_loanProductId: "-1",
    R_stockItemId: "-1",
  });
  return parseReportRows(
    await api(`/runreports/${encodeURIComponent(reportName)}?${query}`)
  );
}

function validateKnownMonetaryFallbacks(
  disbursements: ReportRow[],
  repayments: ReportRow[]
): void {
  const disbursement = disbursements.find(
    (row) =>
      Number(row["Disbursed Amount"]) === 250 &&
      Number(row["Stock Value"]) === 250 &&
      String(row["Stock Item"]) === "Not captured"
  );
  const repayment = repayments.find(
    (row) =>
      String(row["Loan Account"]) === String(disbursement?.["Loan Account"]) &&
      Number(row["Repayment Amount"]) === 100 &&
      Number(row["Post Transaction Balance"]) === 155
  );
  if (!disbursement || !repayment) {
    throw new Error(
      "The known USD 250 disbursement / USD 100 repayment fallback was not returned."
    );
  }
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function renderFixtureSql(sql: string, input: CliOptions): string {
  const replacements: Record<string, string> = {
    currentUserHierarchy: ".",
    startDate: input.startDate,
    endDate: input.endDate,
    officeId: "-1",
    currencyId: "-1",
    loanProductId: "-1",
    stockItemId: "__arda_verification_stock__",
  };
  let rendered = sql;
  for (const [name, value] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(`\${${name}}`, value);
  }
  return rendered;
}

function runTransactionalFixture(input: CliOptions): {
  disbursements: ReportRow[];
  repayments: ReportRow[];
  performance: ReportRow[];
  loanAccount: string;
} {
  const database = requiredEnv("FINERACT_DB_NAME");
  if (database !== "fineract_tenant_arda") {
    throw new Error("FINERACT_DB_NAME must be fineract_tenant_arda.");
  }
  const definitions = buildArdaStockReportDefinitions(1).slice(1);
  const reportQueries = definitions.map((definition, index) => {
    const kind = ["disbursements", "repayments", "performance"][index];
    const sql = renderFixtureSql(definition.reportSql, input);
    return `SELECT json_build_object('kind', ${sqlLiteral(kind)}, 'rows', COALESCE(json_agg(row_to_json(report_row)), '[]'::json))
FROM (${sql}) report_row;`;
  });
  const script = `BEGIN;
CREATE TEMP TABLE arda_verify_loan ON COMMIT DROP AS
SELECT ml.id, ml.account_no
FROM m_loan ml
WHERE EXISTS (
  SELECT 1 FROM m_loan_transaction t
  WHERE t.loan_id = ml.id AND t.transaction_type_enum = 1
    AND COALESCE(t.is_reversed, false) = false
    AND t.transaction_date::date BETWEEN ${sqlLiteral(input.startDate)}::date AND ${sqlLiteral(input.endDate)}::date
)
AND 1 = (
  SELECT COUNT(*) FROM m_loan_transaction t
  WHERE t.loan_id = ml.id AND t.transaction_type_enum = 1
    AND COALESCE(t.is_reversed, false) = false
    AND t.transaction_date::date BETWEEN ${sqlLiteral(input.startDate)}::date AND ${sqlLiteral(input.endDate)}::date
)
AND EXISTS (
  SELECT 1 FROM m_loan_transaction t
  WHERE t.loan_id = ml.id AND t.transaction_type_enum = 2
    AND COALESCE(t.is_reversed, false) = false
    AND t.transaction_date::date BETWEEN ${sqlLiteral(input.startDate)}::date AND ${sqlLiteral(input.endDate)}::date
)
ORDER BY ml.id
LIMIT 1;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM arda_verify_loan) THEN
    RAISE EXCEPTION 'No eligible verification loan exists in the requested date range';
  END IF;
END $$;
DELETE FROM arda_stock_details WHERE loan_id = (SELECT id FROM arda_verify_loan);
INSERT INTO arda_stock_details (
  loan_id, stock_item_id, stock_item_name, quantity, unit_of_measure,
  unit_value, total_stock_value, currency_code, stock_issue_reference
)
SELECT id, '__arda_verification_stock__', 'Verification Stock', 4, 'bag',
       12.50, 50.00, 'USD', '__arda_verification__'
FROM arda_verify_loan;
SELECT json_build_object('kind', 'loan', 'loanAccount', account_no)
FROM arda_verify_loan;
${reportQueries.join("\n")}
ROLLBACK;`;
  const output = execFileSync(
    "psql",
    [
      "-h",
      requiredEnv("FINERACT_DB_HOST"),
      "-p",
      requiredEnv("FINERACT_DB_PORT"),
      "-U",
      requiredEnv("FINERACT_DB_USER"),
      "-d",
      database,
      "-X",
      "-q",
      "-A",
      "-t",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      script,
    ],
    {
      env: { ...process.env, PGPASSWORD: requiredEnv("FINERACT_DB_PASSWORD") },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const records = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line));
  const byKind = new Map(records.map((record) => [record.kind, record]));
  return {
    loanAccount: String(byKind.get("loan")?.loanAccount || ""),
    disbursements: byKind.get("disbursements")?.rows || [],
    repayments: byKind.get("repayments")?.rows || [],
    performance: byKind.get("performance")?.rows || [],
  };
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const tenants = await prisma.tenant.findMany({
    where: { slug: { in: [cli.tenantSlug, cli.controlTenantSlug] }, isActive: true },
    select: { slug: true, settings: true },
  });
  const ardaTenant = tenants.find((tenant) => tenant.slug === cli.tenantSlug);
  const controlTenant = tenants.find(
    (tenant) => tenant.slug === cli.controlTenantSlug
  );
  if (!ardaTenant || !controlTenant) {
    throw new Error("Both active ARDA and control Loan Matrix tenants are required.");
  }

  const ardaApi = createApiClient("arda");
  const controlApi = createApiClient(cli.controlTenantSlug);
  const [ardaArtifacts, controlArtifacts] = await Promise.all([
    artifactSnapshot({ tenantSlug: "arda", settings: ardaTenant.settings, api: ardaApi }),
    artifactSnapshot({
      tenantSlug: cli.controlTenantSlug,
      settings: controlTenant.settings,
      api: controlApi,
    }),
  ]);
  verifyArdaStockReportIsolation(ardaArtifacts, controlArtifacts);

  const [disbursements, repayments, performance] = await Promise.all(
    ARDA_STOCK_REPORT_NAMES.map((reportName) =>
      runReport(ardaApi, reportName, cli.startDate, cli.endDate)
    )
  );
  verifyReportColumns(ARDA_STOCK_REPORT_NAMES[0], disbursements);
  verifyReportColumns(ARDA_STOCK_REPORT_NAMES[1], repayments);
  verifyReportColumns(ARDA_STOCK_REPORT_NAMES[2], performance);
  validateKnownMonetaryFallbacks(disbursements, repayments);

  const fixture = runTransactionalFixture(cli);
  validateArdaReportFixtures({
    ...fixture,
    expected: {
      loanAccount: fixture.loanAccount,
      stockItem: "Verification Stock",
      disbursementCount: 1,
      quantity: 4,
      stockValue: 50,
      repaymentAmount: Number(fixture.repayments[0]?.["Repayment Amount"]),
      principalAllocation: Number(fixture.repayments[0]?.["Principal Allocation"]),
      interestAllocation: Number(fixture.repayments[0]?.["Interest Allocation"]),
      postTransactionBalance: Number(fixture.repayments[0]?.["Post Transaction Balance"]),
      averageQuantity: 4,
      averageUnitValue: 12.5,
      averageStockValue: 50,
      rank: 1,
    },
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        range: { start: cli.startDate, end: cli.endDate },
        reports: {
          disbursements: disbursements.length,
          repayments: repayments.length,
          performance: performance.length,
        },
        fixtureRolledBack: true,
        controlTenant: cli.controlTenantSlug,
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
