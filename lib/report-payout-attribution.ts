type ReportColumnHeader = {
  columnName?: string;
  [key: string]: unknown;
};

type ReportRow = {
  row: unknown[];
  [key: string]: unknown;
};

export type FineractTableReport = {
  columnHeaders?: ReportColumnHeader[];
  data?: ReportRow[];
  [key: string]: unknown;
};

export type PayoutAttribution = {
  cashierName: string | null;
  paidByName: string | null;
};

const normaliseColumnName = (value: string | undefined) =>
  (value || "").trim().toLowerCase().replace(/[_\s]+/g, " ");

export function getDisbursalLoanIds(report: FineractTableReport): number[] {
  if (!Array.isArray(report.columnHeaders) || !Array.isArray(report.data)) {
    return [];
  }

  const loanIdIndex = report.columnHeaders.findIndex(
    (header) => normaliseColumnName(header.columnName) === "loan id"
  );
  if (loanIdIndex < 0) {
    return [];
  }

  return [
    ...new Set(
      report.data
        .map((item) => Number(item.row[loanIdIndex]))
        .filter((loanId) => Number.isFinite(loanId))
    ),
  ];
}

/**
 * Replaces Fineract's service-account creator with Loan Matrix's payout audit
 * attribution when the report row can be matched to a locally recorded payout.
 */
export function enrichDisbursalReportWithPayoutAttribution(
  report: FineractTableReport,
  attributionsByLoanId: Map<number, PayoutAttribution>
): FineractTableReport {
  if (!Array.isArray(report.columnHeaders) || !Array.isArray(report.data)) {
    return report;
  }

  const loanIdIndex = report.columnHeaders.findIndex(
    (header) => normaliseColumnName(header.columnName) === "loan id"
  );
  const recordedByIndex = report.columnHeaders.findIndex(
    (header) =>
      normaliseColumnName(header.columnName) === "cashier / recorded by"
  );

  if (loanIdIndex < 0 || recordedByIndex < 0) {
    return report;
  }

  return {
    ...report,
    columnHeaders: [...report.columnHeaders],
    data: report.data.map((item) => {
      const loanId = Number(item.row[loanIdIndex]);
      const attribution = Number.isFinite(loanId)
        ? attributionsByLoanId.get(loanId)
        : undefined;
      const recordedBy = attribution?.cashierName || attribution?.paidByName;

      if (!recordedBy) {
        return { ...item, row: [...item.row] };
      }

      const row = [...item.row];
      row[recordedByIndex] = recordedBy;
      return { ...item, row };
    }),
  };
}
