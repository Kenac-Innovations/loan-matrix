import {
  ARDA_STOCK_ITEM_OPTIONS_REPORT,
  ARDA_STOCK_REPORT_NAMES,
} from "@/lib/fineract-arda-stock-reports";

export type ReportRow = Record<string, unknown>;

export type StockReportArtifactSnapshot = {
  tenantSlug: string;
  featureEnabled: boolean;
  reports: string[];
  dataTables: string[];
  reportParameters: Record<string, string[]>;
  permissions: string[];
};

const REQUIRED_COLUMNS: Record<string, string[]> = {
  [ARDA_STOCK_REPORT_NAMES[0]]: [
    "Loan Account",
    "Disbursement Date",
    "Stock Item",
    "Quantity",
    "Unit Value",
    "Stock Value",
    "Disbursed Amount",
    "Principal Repaid",
    "Outstanding Amount",
    "Loan Status",
  ],
  [ARDA_STOCK_REPORT_NAMES[1]]: [
    "Loan Account",
    "Transaction ID",
    "Repayment Date",
    "Stock Item",
    "Repayment Amount",
    "Principal Allocation",
    "Interest Allocation",
    "Fee Allocation",
    "Penalty Allocation",
    "Post Transaction Balance",
    "Repayment Type",
    "Cashier Name",
  ],
  [ARDA_STOCK_REPORT_NAMES[2]]: [
    "Month",
    "Stock Item",
    "Unit",
    "Number of Disbursements",
    "Quantity Disbursed",
    "Stock Value Disbursed",
    "Average Quantity per Disbursement",
    "Average Unit Value",
    "Average Stock Value per Disbursement",
    "Monthly Sales Rank",
  ],
};

const REQUIRED_PARAMETERS = [
  "startDate",
  "endDate",
  "officeId",
  "currencyId",
  "loanProductId",
  "stockItemId",
];

function normalized(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function extractReportParameterVariables(value: unknown): string[] {
  const rows = Array.isArray(value)
    ? value
    : Array.isArray((value as { data?: unknown } | null)?.data)
      ? ((value as { data: unknown[] }).data)
      : [];

  return rows
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const record = entry as {
        parameter_variable?: unknown;
        row?: unknown;
      };
      if (record.parameter_variable) return String(record.parameter_variable);
      return Array.isArray(record.row) ? String(record.row[1] || "") : "";
    })
    .filter(Boolean);
}

function numberValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected a number, received ${value}.`);
  return parsed;
}

function assertNumber(label: string, actual: unknown, expected: number): void {
  if (Math.abs(numberValue(actual) - expected) > 0.000001) {
    throw new Error(`${label} does not match the expected fixture value ${expected}.`);
  }
}

export function verifyReportColumns(
  reportName: string,
  rows: ReportRow[]
): void {
  const required = REQUIRED_COLUMNS[reportName];
  if (!required) throw new Error(`Unknown ARDA report: ${reportName}.`);
  if (rows.length === 0) {
    throw new Error(`${reportName} returned no rows for column verification.`);
  }
  const available = new Set(Object.keys(rows[0]));
  const missing = required.filter((column) => !available.has(column));
  if (missing.length > 0) {
    throw new Error(`${reportName} is missing columns: ${missing.join(", ")}.`);
  }
}

export function validateArdaReportFixtures(input: {
  disbursements: ReportRow[];
  repayments: ReportRow[];
  performance: ReportRow[];
  expected: {
    loanAccount: string;
    stockItem: string;
    disbursementCount: number;
    quantity: number;
    stockValue: number;
    repaymentAmount: number;
    principalAllocation: number;
    interestAllocation: number;
    postTransactionBalance: number;
    averageQuantity: number;
    averageUnitValue: number;
    averageStockValue: number;
    rank: number;
  };
}): void {
  const disbursement = input.disbursements.find(
    (row) => String(row["Loan Account"]) === input.expected.loanAccount
  );
  const repayment = input.repayments.find(
    (row) => String(row["Loan Account"]) === input.expected.loanAccount
  );
  const performance = input.performance.find(
    (row) => String(row["Stock Item"]) === input.expected.stockItem
  );
  if (!disbursement || !repayment || !performance) {
    throw new Error("The expected ARDA verification fixture rows were not returned.");
  }

  assertNumber("Disbursement quantity", disbursement.Quantity, input.expected.quantity);
  assertNumber("Disbursement stock value", disbursement["Stock Value"], input.expected.stockValue);
  assertNumber("Disbursed amount", disbursement["Disbursed Amount"], input.expected.stockValue);
  assertNumber("Repayment amount", repayment["Repayment Amount"], input.expected.repaymentAmount);
  assertNumber("Principal allocation", repayment["Principal Allocation"], input.expected.principalAllocation);
  assertNumber("Interest allocation", repayment["Interest Allocation"], input.expected.interestAllocation);
  assertNumber("Post transaction balance", repayment["Post Transaction Balance"], input.expected.postTransactionBalance);
  assertNumber("Disbursement count", performance["Number of Disbursements"], input.expected.disbursementCount);
  assertNumber("Performance quantity", performance["Quantity Disbursed"], input.expected.quantity);
  assertNumber("Performance stock value", performance["Stock Value Disbursed"], input.expected.stockValue);
  assertNumber("Average quantity", performance["Average Quantity per Disbursement"], input.expected.averageQuantity);
  assertNumber("Average unit value", performance["Average Unit Value"], input.expected.averageUnitValue);
  assertNumber(
    "Average stock value",
    performance["Average Stock Value per Disbursement"],
    input.expected.averageStockValue
  );
  assertNumber("Monthly rank", performance["Monthly Sales Rank"], input.expected.rank);
}

export function verifyArdaStockReportIsolation(
  arda: StockReportArtifactSnapshot,
  control: StockReportArtifactSnapshot
): void {
  if (arda.tenantSlug.trim().toLowerCase() !== "arda") {
    throw new Error("The ARDA artifact snapshot is for the wrong tenant.");
  }
  if (!arda.featureEnabled) {
    throw new Error("The ARDA feature flag is not enabled.");
  }

  const requiredReports = [
    ARDA_STOCK_ITEM_OPTIONS_REPORT,
    ...ARDA_STOCK_REPORT_NAMES,
  ];
  for (const reportName of requiredReports) {
    if (!arda.reports.includes(reportName)) {
      throw new Error(`ARDA is missing report ${reportName}.`);
    }
  }
  if (!arda.dataTables.includes("arda_stock_details")) {
    throw new Error("ARDA is missing the arda_stock_details data table.");
  }
  for (const reportName of ARDA_STOCK_REPORT_NAMES) {
    const parameters = new Set(arda.reportParameters[reportName] || []);
    for (const required of REQUIRED_PARAMETERS) {
      if (!parameters.has(required)) {
        throw new Error(`${reportName} is missing parameter ${required}.`);
      }
    }
    const expectedPermission = normalized(`READ_${reportName}`);
    if (
      !arda.permissions.some(
        (permission) => normalized(permission) === expectedPermission
      )
    ) {
      throw new Error(`${reportName} is missing its read permission.`);
    }
  }

  if (control.featureEnabled) {
    throw new Error("The control tenant feature flag must remain disabled.");
  }
  for (const reportName of requiredReports) {
    if (control.reports.includes(reportName)) {
      throw new Error(`The control tenant contains ARDA report ${reportName}.`);
    }
  }
  if (control.dataTables.includes("arda_stock_details")) {
    throw new Error("The control tenant contains ARDA data table arda_stock_details.");
  }
}
