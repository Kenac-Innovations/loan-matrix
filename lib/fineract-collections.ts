import "server-only";

import { fetchFineractAPI } from "@/lib/api";

export const BRANCH_COLLECTION_PERFORMANCE_REPORT = "LM_BRANCH_COLLECTION_PERFORMANCE";

type ReportRow = Record<string, unknown>;

export type BranchCollectionPerformanceRow = {
  officeId: number | null;
  officeName: string;
  currencyCode: string;
  expectedPaymentCount: number;
  expectedLoanCount: number;
  expectedClientCount: number;
  expectedAmount: number;
  collectedTransactionCount: number;
  collectedLoanCount: number;
  collectedClientCount: number;
  collectedAmount: number;
  overdueAmount: number;
  shortfallAmount: number;
  collectionRate: number;
};

export type BranchCollectionPerformanceSummary = {
  branchCount: number;
  expectedAmount: number;
  collectedAmount: number;
  overdueAmount: number;
  shortfallAmount: number;
  collectionRate: number;
  expectedPaymentCount: number;
  collectedTransactionCount: number;
  expectedClientCount: number;
  collectedClientCount: number;
};

export type BranchCollectionPerformanceData = {
  fromDate: string;
  toDate: string;
  officeId: number;
  rows: BranchCollectionPerformanceRow[];
  summary: BranchCollectionPerformanceSummary;
  generatedAt: string;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getReportNumber(row: ReportRow, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];
    if (value !== undefined && value !== null && value !== "") {
      return toNumber(value);
    }
  }
  return fallback;
}

function getReportString(row: ReportRow, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return fallback;
}

function parseReportRows(data: unknown): ReportRow[] {
  if (Array.isArray(data)) return data as ReportRow[];
  if (!data || typeof data !== "object") return [];

  const result = data as {
    columnHeaders?: Array<{ columnName?: string; name?: string } | string>;
    data?: Array<{ row?: unknown[] } | unknown[]>;
    pageItems?: unknown[];
  };

  if (Array.isArray(result.pageItems)) return result.pageItems as ReportRow[];
  if (!Array.isArray(result.columnHeaders) || !Array.isArray(result.data)) return [];

  const columns = result.columnHeaders.map((column) => {
    const name = typeof column === "string" ? column : column.columnName || column.name || "";
    return String(name).toLowerCase().replaceAll(" ", "_").replaceAll(/[()%]/g, "");
  });

  return result.data.map((item) => {
    const values = Array.isArray(item) ? item : item.row || [];
    const row: ReportRow = {};
    columns.forEach((column, index) => {
      row[column] = values[index];
    });
    return row;
  });
}

function normalizeIsoDate(value: string | null | undefined, fallback: Date): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return fallback.toISOString().slice(0, 10);
}

function normalizeOfficeId(value: string | number | null | undefined): number {
  const officeId = Number(value);
  return Number.isInteger(officeId) && officeId > 0 ? officeId : 1;
}

function toBranchPerformanceRow(row: ReportRow): BranchCollectionPerformanceRow {
  const expectedAmount = getReportNumber(row, ["expected_amount"]);
  const collectedAmount = getReportNumber(row, ["collected_amount"]);

  return {
    officeId: getReportNumber(row, ["office_id"]) || null,
    officeName: getReportString(row, ["office_name"], "Unassigned"),
    currencyCode: getReportString(row, ["currency_code"], ""),
    expectedPaymentCount: getReportNumber(row, ["expected_payment_count"]),
    expectedLoanCount: getReportNumber(row, ["expected_loan_count"]),
    expectedClientCount: getReportNumber(row, ["expected_client_count"]),
    expectedAmount,
    collectedTransactionCount: getReportNumber(row, ["collected_transaction_count"]),
    collectedLoanCount: getReportNumber(row, ["collected_loan_count"]),
    collectedClientCount: getReportNumber(row, ["collected_client_count"]),
    collectedAmount,
    overdueAmount: getReportNumber(row, ["overdue_amount"]),
    shortfallAmount: getReportNumber(row, ["shortfall_amount"], Math.max(expectedAmount - collectedAmount, 0)),
    collectionRate: getReportNumber(row, ["collection_rate"]),
  };
}

function summarize(rows: BranchCollectionPerformanceRow[]): BranchCollectionPerformanceSummary {
  const expectedAmount = rows.reduce((sum, row) => sum + row.expectedAmount, 0);
  const collectedAmount = rows.reduce((sum, row) => sum + row.collectedAmount, 0);
  const overdueAmount = rows.reduce((sum, row) => sum + row.overdueAmount, 0);
  const shortfallAmount = rows.reduce((sum, row) => sum + row.shortfallAmount, 0);

  return {
    branchCount: rows.length,
    expectedAmount,
    collectedAmount,
    overdueAmount,
    shortfallAmount,
    collectionRate: expectedAmount > 0 ? (collectedAmount / expectedAmount) * 100 : 0,
    expectedPaymentCount: rows.reduce((sum, row) => sum + row.expectedPaymentCount, 0),
    collectedTransactionCount: rows.reduce((sum, row) => sum + row.collectedTransactionCount, 0),
    expectedClientCount: rows.reduce((sum, row) => sum + row.expectedClientCount, 0),
    collectedClientCount: rows.reduce((sum, row) => sum + row.collectedClientCount, 0),
  };
}

function isAlreadyExistsError(error: unknown): boolean {
  const err = error as { message?: string; status?: number; errorData?: unknown };
  const message = [
    err?.message,
    typeof err?.errorData === "object" && err.errorData
      ? JSON.stringify(err.errorData)
      : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return err?.status === 409 || message.includes("already") || message.includes("exist");
}

export async function getBranchCollectionPerformance(options: {
  fromDate?: string | null;
  toDate?: string | null;
  officeId?: string | number | null;
}): Promise<BranchCollectionPerformanceData> {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const fromDate = normalizeIsoDate(options.fromDate, monthStart);
  const toDate = normalizeIsoDate(options.toDate, today);
  const officeId = normalizeOfficeId(options.officeId);

  const params = new URLSearchParams({
    genericResultSet: "false",
    R_startDate: fromDate,
    R_endDate: toDate,
    R_officeId: String(officeId),
  });

  const data = await fetchFineractAPI(`/runreports/${BRANCH_COLLECTION_PERFORMANCE_REPORT}?${params.toString()}`, {
    cache: "no-store",
  });

  const rows = parseReportRows(data)
    .map(toBranchPerformanceRow)
    .sort((a, b) => b.expectedAmount - a.expectedAmount || a.officeName.localeCompare(b.officeName));

  return {
    fromDate,
    toDate,
    officeId,
    rows,
    summary: summarize(rows),
    generatedAt: new Date().toISOString(),
  };
}

export async function setupCollectionReports(): Promise<{ success: boolean; error?: string }> {
  const report = {
    reportName: BRANCH_COLLECTION_PERFORMANCE_REPORT,
    reportType: "Table",
    reportSubType: "",
    reportCategory: "Collections",
    description: "Branch-level expected versus actual loan collection performance.",
    useReport: true,
    reportSql: `WITH params AS (
  SELECT '\${startDate}'::date AS from_date,
         '\${endDate}'::date AS to_date
),
loan_scope AS (
  SELECT ounder.id AS office_id,
         ounder.name AS office_name,
         ml.id AS loan_id,
         mc.id AS client_id,
         ml.currency_code
  FROM m_office mo
  JOIN m_office ounder
    ON ounder.hierarchy LIKE concat(mo.hierarchy, '%')
   AND ounder.hierarchy LIKE concat('\${currentUserHierarchy}', '%')
  JOIN m_client mc ON mc.office_id = ounder.id
  JOIN m_loan ml ON ml.client_id = mc.id
  WHERE mo.id = '\${officeId}'
),
expected AS (
  SELECT ls.office_id,
         ls.office_name,
         ls.currency_code,
         COUNT(*) AS expected_payment_count,
         COUNT(DISTINCT ls.loan_id) AS expected_loan_count,
         COUNT(DISTINCT ls.client_id) AS expected_client_count,
         COALESCE(SUM(
           COALESCE(rs.principal_amount, 0)
           + COALESCE(rs.interest_amount, 0)
           + COALESCE(rs.fee_charges_amount, 0)
           + COALESCE(rs.penalty_charges_amount, 0)
         ), 0) AS expected_amount,
         COALESCE(SUM(GREATEST(
           COALESCE(rs.principal_amount, 0)
           + COALESCE(rs.interest_amount, 0)
           + COALESCE(rs.fee_charges_amount, 0)
           + COALESCE(rs.penalty_charges_amount, 0)
           - COALESCE(rs.principal_completed_derived, 0)
           - COALESCE(rs.interest_completed_derived, 0)
           - COALESCE(rs.fee_charges_completed_derived, 0)
           - COALESCE(rs.penalty_charges_completed_derived, 0),
           0
         )), 0) AS overdue_amount
  FROM m_loan_repayment_schedule rs
  JOIN loan_scope ls ON ls.loan_id = rs.loan_id
  CROSS JOIN params p
  WHERE rs.duedate BETWEEN p.from_date AND p.to_date
  GROUP BY ls.office_id, ls.office_name, ls.currency_code
),
collected AS (
  SELECT ls.office_id,
         ls.office_name,
         ls.currency_code,
         COUNT(*) AS collected_transaction_count,
         COUNT(DISTINCT ls.loan_id) AS collected_loan_count,
         COUNT(DISTINCT ls.client_id) AS collected_client_count,
         COALESCE(SUM(lt.amount), 0) AS collected_amount
  FROM m_loan_transaction lt
  JOIN loan_scope ls ON ls.loan_id = lt.loan_id
  CROSS JOIN params p
  WHERE lt.transaction_type_enum = 2
    AND COALESCE(lt.is_reversed, false) = false
    AND lt.transaction_date BETWEEN p.from_date AND p.to_date
  GROUP BY ls.office_id, ls.office_name, ls.currency_code
)
SELECT COALESCE(e.office_id, c.office_id) AS office_id,
       COALESCE(e.office_name, c.office_name, 'Unassigned') AS office_name,
       COALESCE(e.currency_code, c.currency_code, '') AS currency_code,
       COALESCE(e.expected_payment_count, 0) AS expected_payment_count,
       COALESCE(e.expected_loan_count, 0) AS expected_loan_count,
       COALESCE(e.expected_client_count, 0) AS expected_client_count,
       COALESCE(e.expected_amount, 0) AS expected_amount,
       COALESCE(c.collected_transaction_count, 0) AS collected_transaction_count,
       COALESCE(c.collected_loan_count, 0) AS collected_loan_count,
       COALESCE(c.collected_client_count, 0) AS collected_client_count,
       COALESCE(c.collected_amount, 0) AS collected_amount,
       COALESCE(e.overdue_amount, 0) AS overdue_amount,
       GREATEST(COALESCE(e.expected_amount, 0) - COALESCE(c.collected_amount, 0), 0) AS shortfall_amount,
       CASE
         WHEN COALESCE(e.expected_amount, 0) > 0
         THEN (COALESCE(c.collected_amount, 0) / COALESCE(e.expected_amount, 0)) * 100
         ELSE 0
       END AS collection_rate
FROM expected e
FULL OUTER JOIN collected c
  ON c.office_id = e.office_id
 AND c.currency_code = e.currency_code
ORDER BY expected_amount DESC, office_name`,
    reportParameters: [
      {
        parameterId: 1,
      },
      {
        parameterId: 2,
      },
      {
        parameterId: 5,
      },
    ],
  };

  let existingReports: Array<{ id: number; reportName: string }> = [];
  try {
    existingReports = (await fetchFineractAPI("/reports")) ?? [];
  } catch {
    existingReports = [];
  }

  const existingId = existingReports.find((existing) => existing.reportName === report.reportName)?.id;

  try {
    if (existingId) {
      const reportUpdate = {
        reportName: report.reportName,
        reportType: report.reportType,
        reportSubType: report.reportSubType,
        reportCategory: report.reportCategory,
        description: report.description,
        useReport: report.useReport,
        reportSql: report.reportSql,
      };
      await fetchFineractAPI(`/reports/${existingId}`, {
        method: "PUT",
        body: JSON.stringify(reportUpdate),
      });
    } else {
      await fetchFineractAPI("/reports", {
        method: "POST",
        body: JSON.stringify(report),
      });
    }
  } catch (error: unknown) {
    if (!isAlreadyExistsError(error)) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: `Failed to register ${report.reportName}: ${message}` };
    }
  }

  return { success: true };
}
