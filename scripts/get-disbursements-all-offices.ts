#!/usr/bin/env tsx

import { getFineractService } from "../lib/fineract-api";

interface CliOptions {
  from: string;
  to: string;
  officeId: string;
  reportName?: string;
}

interface ReportParameterMeta {
  parameter_name: string;
  parameter_variable: string;
  parameter_label: string;
  parameter_displayType: string;
}

interface ReportColumnHeader {
  columnName: string;
}

interface ReportRow {
  row: unknown[];
}

interface ReportResult {
  columnHeaders?: ReportColumnHeader[];
  data?: ReportRow[];
}

const REPORT_NAME_CANDIDATES = [
  "Funds disbursed between date summary by office",
  "Funds disbursed between dates summary by office",
  "Funds Disbursed Between Date Summary By Office",
  "Funds Disbursed Between Dates Summary By Office",
];

function parseArgs(argv: string[]): CliOptions {
  const currentYear = new Date().getFullYear();
  const options: CliOptions = {
    from: `${currentYear}-01-01`,
    to: `${currentYear}-03-31`,
    officeId: "-1",
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (!arg.startsWith("--")) continue;

    const [rawKey, ...rest] = arg.slice(2).split("=");
    const value = rest.join("=");

    switch (rawKey) {
      case "from":
        options.from = value;
        break;
      case "to":
        options.to = value;
        break;
      case "officeId":
        options.officeId = value;
        break;
      case "report":
        options.reportName = value;
        break;
      default:
        throw new Error(`Unknown argument: --${rawKey}`);
    }
  }

  if (!options.from || !options.to) {
    throw new Error("Both --from and --to are required.");
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  npx tsx scripts/get-disbursements-all-offices.ts --from=2026-01-01 --to=2026-03-31

Options:
  --from=YYYY-MM-DD     Start date for the report.
  --to=YYYY-MM-DD       End date for the report.
  --officeId=-1         Office filter. Use -1 for all offices. Default: -1
  --report="Name"       Optional exact Fineract report name.

Environment:
  FINERACT_BASE_URL
  FINERACT_TENANT_ID
  FINERACT_USERNAME
  FINERACT_PASSWORD
`);
}

function mapParameterRows(raw: ReportResult): ReportParameterMeta[] {
  return (raw.data ?? []).map((item) => ({
    parameter_name: String(item.row[0] ?? ""),
    parameter_variable: String(item.row[1] ?? ""),
    parameter_label: String(item.row[2] ?? ""),
    parameter_displayType: String(item.row[3] ?? ""),
  }));
}

function normalizeText(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function findParameter(
  parameters: ReportParameterMeta[],
  matcher: (parameter: ReportParameterMeta) => boolean
): ReportParameterMeta | undefined {
  return parameters.find(matcher);
}

function findStartDateParameter(parameters: ReportParameterMeta[]) {
  return findParameter(parameters, (parameter) => {
    const variable = normalizeText(parameter.parameter_variable);
    const name = normalizeText(parameter.parameter_name);
    const label = normalizeText(parameter.parameter_label);

    return (
      variable.includes("startdate") ||
      variable.includes("fromdate") ||
      name.includes("startdate") ||
      name.includes("fromdate") ||
      label.includes("startdate") ||
      label.includes("fromdate")
    );
  });
}

function findEndDateParameter(parameters: ReportParameterMeta[]) {
  return findParameter(parameters, (parameter) => {
    const variable = normalizeText(parameter.parameter_variable);
    const name = normalizeText(parameter.parameter_name);
    const label = normalizeText(parameter.parameter_label);

    return (
      variable.includes("enddate") ||
      variable.includes("todate") ||
      name.includes("enddate") ||
      name.includes("todate") ||
      label.includes("enddate") ||
      label.includes("todate")
    );
  });
}

function findOfficeParameter(parameters: ReportParameterMeta[]) {
  return findParameter(parameters, (parameter) => {
    const variable = normalizeText(parameter.parameter_variable);
    const name = normalizeText(parameter.parameter_name);
    const label = normalizeText(parameter.parameter_label);

    return (
      variable === "officeid" ||
      variable.endsWith("officeid") ||
      name.includes("office") ||
      label.includes("office")
    );
  });
}

function getReportNameCandidates(options: CliOptions) {
  return options.reportName
    ? [options.reportName]
    : REPORT_NAME_CANDIDATES;
}

async function resolveReportName(options: CliOptions) {
  const fineract = getFineractService("");

  for (const reportName of getReportNameCandidates(options)) {
    try {
      const rawParameters = (await fineract.getReportParameters(
        reportName
      )) as ReportResult;
      const parameters = mapParameterRows(rawParameters);
      if (parameters.length > 0) {
        return { fineract, reportName, parameters };
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.warn(`Skipping report "${reportName}": ${message}`);
    }
  }

  throw new Error(
    `Could not find a usable disbursement report. Tried: ${getReportNameCandidates(
      options
    ).join(", ")}`
  );
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    if (!normalized) return null;

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function findOfficeColumn(headers: string[]) {
  return (
    headers.find((header) => /office/i.test(header)) ??
    headers[0]
  );
}

function findAmountColumn(headers: string[], rows: Record<string, unknown>[]) {
  const numericHeaders = headers.filter((header) =>
    rows.some((row) => toNumber(row[header]) !== null)
  );

  return (
    numericHeaders.find((header) =>
      /(disburs|amount|value|total)/i.test(header)
    ) ??
    numericHeaders.at(-1)
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { fineract, reportName, parameters } = await resolveReportName(options);

  const startDateParameter = findStartDateParameter(parameters);
  const endDateParameter = findEndDateParameter(parameters);
  const officeParameter = findOfficeParameter(parameters);

  if (!startDateParameter || !endDateParameter) {
    throw new Error(
      `Could not identify the report date parameters. Available parameters: ${parameters
        .map((parameter) => `${parameter.parameter_variable} (${parameter.parameter_label})`)
        .join(", ")}`
    );
  }

  const reportParams: Record<string, string> = {
    [startDateParameter.parameter_variable]: options.from,
    [endDateParameter.parameter_variable]: options.to,
  };

  if (officeParameter) {
    reportParams[officeParameter.parameter_variable] = options.officeId;
  }

  const result = (await fineract.runReport(reportName, reportParams)) as ReportResult;
  const headers = (result.columnHeaders ?? []).map((header) => header.columnName);
  const rows = (result.data ?? []).map((item) =>
    Object.fromEntries(headers.map((header, index) => [header, item.row[index]]))
  );

  if (rows.length === 0) {
    console.log(`Report: ${reportName}`);
    console.log(`Period: ${options.from} to ${options.to}`);
    console.log("No rows returned.");
    return;
  }

  const officeColumn = findOfficeColumn(headers);
  const amountColumn = findAmountColumn(headers, rows);

  console.log(`Report: ${reportName}`);
  console.log(`Period: ${options.from} to ${options.to}`);
  console.log(
    `Office filter: ${
      options.officeId === "-1" ? "All offices" : `Office ${options.officeId}`
    }`
  );

  if (!amountColumn) {
    console.log("\nCould not identify the amount column automatically.");
    console.table(rows);
    return;
  }

  const printableRows = rows.map((row) => ({
    office: String(row[officeColumn] ?? ""),
    amount: toNumber(row[amountColumn]) ?? 0,
  }));

  const grandTotal = printableRows.reduce((sum, row) => sum + row.amount, 0);

  console.log(`\nUsing columns: office="${officeColumn}", amount="${amountColumn}"`);
  console.table(
    printableRows.map((row) => ({
      office: row.office,
      amount: formatMoney(row.amount),
    }))
  );
  console.log(`Grand total: ${formatMoney(grandTotal)}`);
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Script failed with an unknown error."
  );
  process.exit(1);
});
