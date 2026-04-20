type LoanStatusShape = {
  value?: string | null;
  code?: string | null;
  closedWrittenOff?: boolean | null;
};

type DelinquentShape = {
  pastDueDays?: number | string | null;
  delinquentDays?: number | string | null;
  delinquentAmount?: number | string | null;
};

type SummaryShape = {
  totalOverdue?: number | string | null;
};

export type LoanStatusSource = {
  status?: string | LoanStatusShape | null;
  chargedOff?: boolean | null;
  inArrears?: boolean | null;
  daysInArrears?: number | string | null;
  summary?: SummaryShape | null;
  delinquent?: DelinquentShape | null;
};

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function getRawLoanStatusValue(loan: LoanStatusSource): string {
  if (typeof loan.status === "string") {
    return loan.status || "Unknown";
  }

  if (loan.status?.value) {
    return loan.status.value;
  }

  return "Unknown";
}

export function getLoanDaysInArrears(loan: LoanStatusSource): number {
  return Math.max(
    0,
    toNumber(loan.daysInArrears),
    toNumber(loan.delinquent?.pastDueDays),
    toNumber(loan.delinquent?.delinquentDays),
  );
}

export function getDisplayLoanStatus(loan: LoanStatusSource): string {
  const rawStatus = getRawLoanStatusValue(loan);
  const statusLower = rawStatus.toLowerCase();

  if (
    loan.chargedOff ||
    loan.status?.closedWrittenOff ||
    statusLower.includes("written off") ||
    statusLower.includes("charged off") ||
    statusLower.includes("charge-off")
  ) {
    return "Closed (written off)";
  }

  const overdueAmount = toNumber(loan.summary?.totalOverdue);
  const daysInArrears = getLoanDaysInArrears(loan);
  const delinquentAmount = toNumber(loan.delinquent?.delinquentAmount);

  if (
    (statusLower.includes("active") || statusLower.includes("disbursed")) &&
    (overdueAmount > 0 || daysInArrears > 0 || delinquentAmount > 0 || Boolean(loan.inArrears))
  ) {
    return "Overdue";
  }

  return rawStatus;
}
