import "server-only";

import { fetchFineractAPI } from "@/lib/api";
import { formatFineractDate } from "@/lib/fineract-savings-service";
import { resolveLoanNotificationTarget } from "@/lib/loan-notification-target";
import { sendSms } from "@/lib/notification-service";
import { getTenantBySlug } from "@/lib/tenant-service";

export const RECOVERY_COURT_CASE_TABLE = "lm_loan_court_case";
export const RECOVERY_COURT_PROCEEDING_TABLE = "lm_loan_court_proceeding";

export const COURT_CASES_REPORT = "LM_COURT_CASES_REPORT";
export const COURT_PROCEEDINGS_REPORT = "LM_COURT_PROCEEDINGS_REPORT";
export const RECOVERY_ARREARS_REPORT = "LM_RECOVERY_ARREARS_DETAIL";
export const RECOVERY_NPA_REPORT = "LM_RECOVERY_NPA_DETAIL";
export const RECOVERY_SUMMARY_REPORT = "LM_RECOVERY_DASHBOARD_SUMMARY";
export const RECOVERY_BRANCH_REPORT = "LM_RECOVERY_BRANCH_PERFORMANCE";

const DATE_FORMAT = "dd MMMM yyyy";
const LOCALE = "en";

export type RecoveryBucket = "30" | "60" | "90" | "npa" | "all";

type FineractDate = string | number[] | null | undefined;

type FineractLoanLike = {
  id: number;
  accountNo?: string;
  clientId?: number;
  clientName?: string;
  clientOfficeId?: number;
  officeId?: number;
  officeName?: string;
  clientOfficeName?: string;
  productName?: string;
  loanProductName?: string;
  status?: {
    id?: number;
    code?: string;
    value?: string;
    active?: boolean;
    closed?: boolean;
    closedWrittenOff?: boolean;
  };
  currency?: { code?: string; displaySymbol?: string } | string;
  principal?: number;
  principalAmount?: number;
  outstandingBalance?: number;
  totalOutstanding?: number;
  daysInArrears?: number | string;
  inArrears?: boolean;
  isNPA?: boolean;
  delinquent?: {
    pastDueDays?: number | string;
    delinquentDays?: number | string;
    delinquentAmount?: number | string;
  };
  summary?: {
    totalOverdue?: number | string;
    totalOutstanding?: number | string;
    overdueSinceDate?: FineractDate;
    principalDisbursed?: number | string;
  };
  timeline?: {
    expectedMaturityDate?: FineractDate;
    actualDisbursementDate?: FineractDate;
  };
};

type RecoveryReportRow = Record<string, unknown>;

export type RecoveryLoanRow = {
  loanId: number;
  clientId: number | null;
  accountNo: string;
  clientName: string;
  productName: string;
  officeId: number | null;
  officeName: string;
  bucket: "30" | "60" | "90";
  daysPastDue: number;
  overdueAmount: number;
  outstandingAmount: number;
  principalAmount: number;
  currencyCode: string;
  status: string;
  isNpa: boolean;
  npaStatus: "NPA" | "NPA Candidate" | "Not NPA";
  loanDetailUrl: string;
};

export type OfficeRecoveryPerformance = {
  officeId: number | null;
  officeName: string;
  activeLoanCount: number;
  arrearsLoanCount: number;
  par30LoanCount: number;
  par60LoanCount: number;
  par90LoanCount: number;
  npaLoanCount: number;
  outstandingAmount: number;
  overdueAmount: number;
  par30OutstandingAmount: number;
  par60OutstandingAmount: number;
  par90OutstandingAmount: number;
  currentRate: number;
};

export type RecoveryDashboardSummary = {
  activeLoanCount: number;
  arrearsLoanCount: number;
  bucketCounts: Record<"30" | "60" | "90", number>;
  npaLoanCount: number;
  totalOutstandingAmount: number;
  totalOverdueAmount: number;
  par30OutstandingAmount: number;
  par60OutstandingAmount: number;
  par90OutstandingAmount: number;
  currentRate: number;
  byOffice: OfficeRecoveryPerformance[];
};

export type RecoveryPagination = {
  page: number;
  pageSize: number;
  rowCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type RecoveryDashboardData = {
  bucket: RecoveryBucket;
  rows: RecoveryLoanRow[];
  summary: RecoveryDashboardSummary;
  pagination: RecoveryPagination;
  generatedAt: string;
};

export type RecoveryDashboardOptions = {
  page?: number;
  pageSize?: number;
};

export type CourtCaseInput = {
  caseNumber?: string;
  courtName?: string;
  filingDate?: string;
  lawyerName?: string;
  status?: string;
  startedOnDate?: string;
  nextHearingDate?: string;
  outcome?: string;
  notes?: string;
};

export type CourtProceedingInput = {
  caseNumber?: string;
  proceedingDate?: string;
  proceedingType?: string;
  status?: string;
  nextHearingDate?: string;
  outcome?: string;
  notes?: string;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toPositiveInteger(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const number = Math.floor(toNumber(value));
  if (!Number.isFinite(number) || number < 1) return fallback;
  return Math.min(number, max);
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "t", "yes", "y"].includes(normalized);
  }
  return false;
}

function getReportValue(row: RecoveryReportRow, keys: string[]): unknown {
  for (const key of keys) {
    if (key in row) return row[key];
  }
  return undefined;
}

function getReportString(row: RecoveryReportRow, keys: string[], fallback = ""): string {
  const value = getReportValue(row, keys);
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function getReportNumber(row: RecoveryReportRow, keys: string[]): number {
  return toNumber(getReportValue(row, keys));
}

function parseReportRows(data: unknown): RecoveryReportRow[] {
  if (Array.isArray(data)) return data as RecoveryReportRow[];
  if (data && typeof data === "object") {
    const candidate = data as { pageItems?: unknown; data?: unknown; rows?: unknown };
    if (Array.isArray(candidate.pageItems)) return candidate.pageItems as RecoveryReportRow[];
    if (Array.isArray(candidate.data)) return candidate.data as RecoveryReportRow[];
    if (Array.isArray(candidate.rows)) return candidate.rows as RecoveryReportRow[];
  }
  return [];
}

function parseFineractDate(value: FineractDate): Date | null {
  if (!value) return null;

  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value;
    return new Date(year, month - 1, day);
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function daysBetween(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.max(0, Math.floor((end - start) / (24 * 60 * 60 * 1000)));
}

function getDaysPastDue(loan: FineractLoanLike): number {
  const directDays = Math.max(
    toNumber(loan.daysInArrears),
    toNumber(loan.delinquent?.pastDueDays),
    toNumber(loan.delinquent?.delinquentDays)
  );

  if (directDays > 0) return directDays;

  const overdueSince = parseFineractDate(loan.summary?.overdueSinceDate);
  if (overdueSince && getOverdueAmount(loan) > 0) {
    return daysBetween(overdueSince, new Date());
  }

  return 0;
}

function getBucket(daysPastDue: number): "30" | "60" | "90" | null {
  if (daysPastDue >= 90) return "90";
  if (daysPastDue >= 60) return "60";
  if (daysPastDue >= 30) return "30";
  return null;
}

function getCurrencyCode(loan: FineractLoanLike): string {
  const currency = loan.currency;
  if (typeof currency === "string" && currency) return currency;
  if (currency && typeof currency === "object") return currency.code || "ZMW";
  return "ZMW";
}

function getStatusValue(loan: FineractLoanLike): string {
  return loan.status?.value || loan.status?.code || "Unknown";
}

function getOfficeName(loan: FineractLoanLike): string {
  return loan.officeName || loan.clientOfficeName || "Unassigned";
}

function getOfficeId(loan: FineractLoanLike): number | null {
  if (typeof loan.clientOfficeId === "number") return loan.clientOfficeId;
  if (typeof loan.officeId === "number") return loan.officeId;
  return null;
}

function getOverdueAmount(loan: FineractLoanLike): number {
  return Math.max(toNumber(loan.summary?.totalOverdue), toNumber(loan.delinquent?.delinquentAmount));
}

function getOutstandingAmount(loan: FineractLoanLike): number {
  return Math.max(
    toNumber(loan.summary?.totalOutstanding),
    toNumber(loan.outstandingBalance),
    toNumber(loan.totalOutstanding)
  );
}

function getPrincipalAmount(loan: FineractLoanLike): number {
  return Math.max(
    toNumber(loan.principal),
    toNumber(loan.principalAmount),
    toNumber(loan.summary?.principalDisbursed)
  );
}

function isClosedLoan(loan: FineractLoanLike): boolean {
  const status = getStatusValue(loan).toLowerCase();
  return Boolean(loan.status?.closed || status.includes("closed") || status.includes("withdrawn") || status.includes("rejected"));
}

function isActiveLoan(loan: FineractLoanLike): boolean {
  if (isClosedLoan(loan)) return false;
  if (loan.status?.active) return true;

  const status = getStatusValue(loan).toLowerCase();
  return status.includes("active") || status.includes("disbursed") || getOutstandingAmount(loan) > 0;
}

function isNpaLoan(loan: FineractLoanLike): boolean {
  const status = getStatusValue(loan).toLowerCase();
  return Boolean(loan.isNPA || status.includes("npa") || status.includes("non-performing"));
}

function toLoanRow(loan: FineractLoanLike): RecoveryLoanRow | null {
  const daysPastDue = getDaysPastDue(loan);
  const bucket = getBucket(daysPastDue);
  const overdueAmount = getOverdueAmount(loan);

  if (!bucket || overdueAmount <= 0 || !isActiveLoan(loan)) {
    return null;
  }

  const loanId = Number(loan.id);
  const clientId = loan.clientId == null ? null : Number(loan.clientId);
  const isNpa = isNpaLoan(loan);

  return {
    loanId,
    clientId,
    accountNo: loan.accountNo || String(loanId),
    clientName: loan.clientName || "Unknown Client",
    productName: loan.loanProductName || loan.productName || "Unknown Product",
    officeId: getOfficeId(loan),
    officeName: getOfficeName(loan),
    bucket,
    daysPastDue,
    overdueAmount,
    outstandingAmount: getOutstandingAmount(loan),
    principalAmount: getPrincipalAmount(loan),
    currencyCode: getCurrencyCode(loan),
    status: getStatusValue(loan),
    isNpa,
    npaStatus: isNpa ? "NPA" : daysPastDue >= 90 ? "NPA Candidate" : "Not NPA",
    loanDetailUrl: clientId ? `/clients/${clientId}/loans/${loanId}` : `/loans?query=${encodeURIComponent(String(loanId))}`,
  };
}

function cleanOfficeName(value: string): string {
  return value.replace(/^\.+/, "").trim() || "Unassigned";
}

function toReportLoanRow(row: RecoveryReportRow): RecoveryLoanRow | null {
  const loanId = getReportNumber(row, ["loan_id", "Loan ID"]);
  if (!loanId) return null;

  const daysPastDue = Math.max(0, getReportNumber(row, ["days_in_arrears", "Days in Arrears"]));
  const rawIsNpa = toBoolean(getReportValue(row, ["is_npa", "Is NPA"]));
  const bucket = getBucket(daysPastDue) || (rawIsNpa ? "90" : null);
  if (!bucket) return null;

  const principalOverdue = getReportNumber(row, ["principal_overdue", "Principal Overdue"]);
  const interestOverdue = getReportNumber(row, ["interest_overdue", "Interest Overdue"]);
  const feeOverdue = getReportNumber(row, ["fee_charges_overdue", "Fee Charges Overdue"]);
  const penaltyOverdue = getReportNumber(row, ["penalty_charges_overdue", "Penalty Charges Overdue"]);
  const overdueAmount =
    getReportNumber(row, ["total_overdue", "Total Overdue"]) ||
    principalOverdue + interestOverdue + feeOverdue + penaltyOverdue;

  const clientId = getReportNumber(row, ["client_id", "Client ID"]) || null;
  const accountNo = getReportString(row, ["account_no", "Account Number"], String(loanId));
  const officeName = cleanOfficeName(getReportString(row, ["office_name", "Office/Branch"], "Unassigned"));

  return {
    loanId,
    clientId,
    accountNo,
    clientName: getReportString(row, ["client_name", "Client Name"], "Unknown Client"),
    productName: getReportString(row, ["product_name", "Product Name"], "Unknown Product"),
    officeId: getReportNumber(row, ["office_id", "Office ID"]) || null,
    officeName,
    bucket,
    daysPastDue,
    overdueAmount,
    outstandingAmount: getReportNumber(row, ["total_outstanding", "Total Outstanding"]),
    principalAmount: getReportNumber(row, ["principal_amount", "Loan Amount"]),
    currencyCode: getReportString(row, ["currency_code", "currency"], "ZMW"),
    status: getReportString(row, ["loan_status", "Loan Status"], "Active"),
    isNpa: rawIsNpa,
    npaStatus: rawIsNpa ? "NPA" : daysPastDue >= 90 ? "NPA Candidate" : "Not NPA",
    loanDetailUrl: clientId ? `/clients/${clientId}/loans/${loanId}` : `/loans?query=${encodeURIComponent(String(loanId))}`,
  };
}

function parsePageItems(data: unknown): FineractLoanLike[] {
  if (Array.isArray(data)) return data as FineractLoanLike[];
  if (data && typeof data === "object") {
    const candidate = data as { pageItems?: unknown; content?: unknown; data?: unknown; loans?: unknown };
    if (Array.isArray(candidate.pageItems)) return candidate.pageItems as FineractLoanLike[];
    if (Array.isArray(candidate.content)) return candidate.content as FineractLoanLike[];
    if (Array.isArray(candidate.data)) return candidate.data as FineractLoanLike[];
    if (Array.isArray(candidate.loans)) return candidate.loans as FineractLoanLike[];
  }
  return [];
}

export async function fetchAllRecoveryLoans(): Promise<FineractLoanLike[]> {
  const pageSize = 1000;
  const loans: FineractLoanLike[] = [];

  for (let offset = 0; offset < 20000; offset += pageSize) {
    const data = await fetchFineractAPI(
      `/loans?limit=${pageSize}&offset=${offset}&orderBy=id&sortOrder=desc`,
      { cache: "no-store" }
    );
    const pageItems = parsePageItems(data);
    if (pageItems.length === 0) break;

    loans.push(...pageItems);
    if (pageItems.length < pageSize) break;
  }

  return loans;
}

function buildSummary(loans: FineractLoanLike[], rows: RecoveryLoanRow[]): RecoveryDashboardSummary {
  const activeLoans = loans.filter(isActiveLoan);
  const byOffice = new Map<string, OfficeRecoveryPerformance>();

  const ensureOffice = (loan: FineractLoanLike): OfficeRecoveryPerformance => {
    const officeId = getOfficeId(loan);
    const officeName = getOfficeName(loan);
    const key = `${officeId ?? "none"}:${officeName}`;
    const existing = byOffice.get(key);
    if (existing) return existing;

    const created: OfficeRecoveryPerformance = {
      officeId,
      officeName,
      activeLoanCount: 0,
      arrearsLoanCount: 0,
      par30LoanCount: 0,
      par60LoanCount: 0,
      par90LoanCount: 0,
      npaLoanCount: 0,
      outstandingAmount: 0,
      overdueAmount: 0,
      par30OutstandingAmount: 0,
      par60OutstandingAmount: 0,
      par90OutstandingAmount: 0,
      currentRate: 0,
    };

    byOffice.set(key, created);
    return created;
  };

  for (const loan of activeLoans) {
    const office = ensureOffice(loan);
    const daysPastDue = getDaysPastDue(loan);
    const overdueAmount = getOverdueAmount(loan);
    const outstandingAmount = getOutstandingAmount(loan);

    office.activeLoanCount += 1;
    office.outstandingAmount += outstandingAmount;
    office.overdueAmount += overdueAmount;

    if (overdueAmount > 0 && daysPastDue >= 30) {
      office.arrearsLoanCount += 1;
      office.par30LoanCount += 1;
      office.par30OutstandingAmount += outstandingAmount;
    }
    if (overdueAmount > 0 && daysPastDue >= 60) {
      office.par60LoanCount += 1;
      office.par60OutstandingAmount += outstandingAmount;
    }
    if (overdueAmount > 0 && daysPastDue >= 90) {
      office.par90LoanCount += 1;
      office.par90OutstandingAmount += outstandingAmount;
    }
    if (isNpaLoan(loan)) {
      office.npaLoanCount += 1;
    }
  }

  const officeRows = Array.from(byOffice.values()).map((office) => ({
    ...office,
    currentRate:
      office.outstandingAmount > 0
        ? ((office.outstandingAmount - office.par30OutstandingAmount) / office.outstandingAmount) * 100
        : 0,
  }));

  const totalOutstandingAmount = activeLoans.reduce((sum, loan) => sum + getOutstandingAmount(loan), 0);
  const par30OutstandingAmount = rows.reduce((sum, row) => sum + row.outstandingAmount, 0);
  const par60OutstandingAmount = rows
    .filter((row) => row.daysPastDue >= 60)
    .reduce((sum, row) => sum + row.outstandingAmount, 0);
  const par90OutstandingAmount = rows
    .filter((row) => row.daysPastDue >= 90)
    .reduce((sum, row) => sum + row.outstandingAmount, 0);

  return {
    activeLoanCount: activeLoans.length,
    arrearsLoanCount: rows.length,
    bucketCounts: {
      "30": rows.filter((row) => row.bucket === "30").length,
      "60": rows.filter((row) => row.bucket === "60").length,
      "90": rows.filter((row) => row.bucket === "90").length,
    },
    npaLoanCount: rows.filter((row) => row.isNpa).length,
    totalOutstandingAmount,
    totalOverdueAmount: rows.reduce((sum, row) => sum + row.overdueAmount, 0),
    par30OutstandingAmount,
    par60OutstandingAmount,
    par90OutstandingAmount,
    currentRate:
      totalOutstandingAmount > 0
        ? ((totalOutstandingAmount - par30OutstandingAmount) / totalOutstandingAmount) * 100
        : 0,
    byOffice: officeRows.sort((a, b) => b.par30OutstandingAmount - a.par30OutstandingAmount),
  };
}

function summaryFromReport(row: RecoveryReportRow | undefined, byOffice: OfficeRecoveryPerformance[]): RecoveryDashboardSummary {
  return {
    activeLoanCount: getReportNumber(row ?? {}, ["active_loan_count"]),
    arrearsLoanCount: getReportNumber(row ?? {}, ["arrears_loan_count"]),
    bucketCounts: {
      "30": getReportNumber(row ?? {}, ["bucket_30_count"]),
      "60": getReportNumber(row ?? {}, ["bucket_60_count"]),
      "90": getReportNumber(row ?? {}, ["bucket_90_count"]),
    },
    npaLoanCount: getReportNumber(row ?? {}, ["npa_loan_count"]),
    totalOutstandingAmount: getReportNumber(row ?? {}, ["total_outstanding_amount"]),
    totalOverdueAmount: getReportNumber(row ?? {}, ["total_overdue_amount"]),
    par30OutstandingAmount: getReportNumber(row ?? {}, ["par30_outstanding_amount"]),
    par60OutstandingAmount: getReportNumber(row ?? {}, ["par60_outstanding_amount"]),
    par90OutstandingAmount: getReportNumber(row ?? {}, ["par90_outstanding_amount"]),
    currentRate: getReportNumber(row ?? {}, ["current_rate"]),
    byOffice,
  };
}

function toOfficePerformance(row: RecoveryReportRow): OfficeRecoveryPerformance {
  return {
    officeId: getReportNumber(row, ["office_id"]) || null,
    officeName: cleanOfficeName(getReportString(row, ["office_name", "Office/Branch"], "Unassigned")),
    activeLoanCount: getReportNumber(row, ["active_loan_count"]),
    arrearsLoanCount: getReportNumber(row, ["arrears_loan_count"]),
    par30LoanCount: getReportNumber(row, ["par30_loan_count"]),
    par60LoanCount: getReportNumber(row, ["par60_loan_count"]),
    par90LoanCount: getReportNumber(row, ["par90_loan_count"]),
    npaLoanCount: getReportNumber(row, ["npa_loan_count"]),
    outstandingAmount: getReportNumber(row, ["outstanding_amount"]),
    overdueAmount: getReportNumber(row, ["overdue_amount"]),
    par30OutstandingAmount: getReportNumber(row, ["par30_outstanding_amount"]),
    par60OutstandingAmount: getReportNumber(row, ["par60_outstanding_amount"]),
    par90OutstandingAmount: getReportNumber(row, ["par90_outstanding_amount"]),
    currentRate: getReportNumber(row, ["current_rate"]),
  };
}

async function runRecoverySummaryReport(): Promise<RecoveryDashboardSummary> {
  const [summaryData, branchData] = await Promise.all([
    fetchFineractAPI(`/runreports/${RECOVERY_SUMMARY_REPORT}?genericResultSet=false`, { cache: "no-store" }),
    fetchFineractAPI(`/runreports/${RECOVERY_BRANCH_REPORT}?genericResultSet=false`, { cache: "no-store" }),
  ]);

  const branchRows = parseReportRows(branchData)
    .map(toOfficePerformance)
    .sort((a, b) => b.par30OutstandingAmount - a.par30OutstandingAmount);

  return summaryFromReport(parseReportRows(summaryData)[0], branchRows);
}

async function runRecoveryArrearsReport(
  daysPastDue: number,
  maxDaysPastDue: number | undefined,
  pagination: { page: number; pageSize: number }
): Promise<{ rows: RecoveryLoanRow[]; hasNextPage: boolean }> {
  const requestedLimit = pagination.pageSize + 1;
  const offset = (pagination.page - 1) * pagination.pageSize;
  const params = new URLSearchParams({
    genericResultSet: "false",
    R_daysPastDue: String(Math.max(0, daysPastDue)),
    R_maxDaysPastDue: maxDaysPastDue == null ? "" : String(Math.max(0, maxDaysPastDue)),
    R_pageLimit: String(requestedLimit),
    R_pageOffset: String(offset),
  });
  const data = await fetchFineractAPI(`/runreports/${RECOVERY_ARREARS_REPORT}?${params.toString()}`, {
    cache: "no-store",
  });

  const rows = parseReportRows(data)
    .map(toReportLoanRow)
    .filter((row): row is RecoveryLoanRow => Boolean(row));

  return {
    rows: rows.slice(0, pagination.pageSize),
    hasNextPage: rows.length > pagination.pageSize,
  };
}

async function runRecoveryNpaReport(
  pagination: { page: number; pageSize: number }
): Promise<{ rows: RecoveryLoanRow[]; hasNextPage: boolean }> {
  const requestedLimit = pagination.pageSize + 1;
  const offset = (pagination.page - 1) * pagination.pageSize;
  const params = new URLSearchParams({
    genericResultSet: "false",
    R_pageLimit: String(requestedLimit),
    R_pageOffset: String(offset),
  });
  const data = await fetchFineractAPI(`/runreports/${RECOVERY_NPA_REPORT}?${params.toString()}`, {
    cache: "no-store",
  });

  const rows = parseReportRows(data)
    .map(toReportLoanRow)
    .filter((row): row is RecoveryLoanRow => Boolean(row));

  return {
    rows: rows.slice(0, pagination.pageSize),
    hasNextPage: rows.length > pagination.pageSize,
  };
}

function getBucketRange(bucket: RecoveryBucket): { min: number; max?: number } {
  if (bucket === "30") return { min: 30, max: 59 };
  if (bucket === "60") return { min: 60, max: 89 };
  if (bucket === "90") return { min: 90 };
  return { min: 0 };
}

async function getFallbackRecoveryDashboardData(
  bucket: RecoveryBucket,
  pagination: { page: number; pageSize: number }
): Promise<RecoveryDashboardData> {
  const loans = await fetchAllRecoveryLoans();
  const rows = loans.map(toLoanRow).filter((row): row is RecoveryLoanRow => Boolean(row));
  const summary = buildSummary(loans, rows);

  const filteredRows =
    bucket === "all"
      ? rows
      : bucket === "npa"
        ? rows.filter((row) => row.isNpa)
        : rows.filter((row) => row.bucket === bucket);

  const sortedRows = filteredRows.sort((a, b) => b.daysPastDue - a.daysPastDue || b.overdueAmount - a.overdueAmount);
  const offset = (pagination.page - 1) * pagination.pageSize;
  const pagedRows = sortedRows.slice(offset, offset + pagination.pageSize);

  return {
    bucket,
    rows: pagedRows,
    summary,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      rowCount: pagedRows.length,
      hasNextPage: offset + pagination.pageSize < sortedRows.length,
      hasPreviousPage: pagination.page > 1,
    },
    generatedAt: new Date().toISOString(),
  };
}

export async function getRecoveryDashboardData(
  bucket: RecoveryBucket,
  options: RecoveryDashboardOptions = {}
): Promise<RecoveryDashboardData> {
  const pagination = {
    page: toPositiveInteger(options.page, 1),
    pageSize: toPositiveInteger(options.pageSize, 25, 100),
  };

  try {
    const { min, max } = getBucketRange(bucket);
    const [summary, pageResult] = await Promise.all([
      runRecoverySummaryReport(),
      bucket === "npa"
        ? runRecoveryNpaReport(pagination)
        : runRecoveryArrearsReport(bucket === "all" ? 0 : min, bucket === "all" ? undefined : max, pagination),
    ]);
    const sortedRows = pageResult.rows.sort((a, b) => b.daysPastDue - a.daysPastDue || b.overdueAmount - a.overdueAmount);

    return {
      bucket,
      rows: sortedRows,
      summary,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        rowCount: sortedRows.length,
        hasNextPage: pageResult.hasNextPage,
        hasPreviousPage: pagination.page > 1,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn("Recovery reports unavailable, falling back to loan list:", error);
    return getFallbackRecoveryDashboardData(bucket, pagination);
  }
}

function formatInputDate(value?: string | null): string | undefined {
  if (!value) return undefined;

  const parts = value.split("-").map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return formatFineractDate(new Date(parts[0], parts[1] - 1, parts[2]));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return formatFineractDate(parsed);
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

export async function registerRecoveryDatatables(): Promise<void> {
  const tables = [
    {
      datatableName: RECOVERY_COURT_CASE_TABLE,
      apptableName: "m_loan",
      multiRow: true,
      columns: [
        { name: "case_number", type: "String", length: 80 },
        { name: "court_name", type: "String", length: 120 },
        { name: "filing_date", type: "Date" },
        { name: "lawyer_name", type: "String", length: 120 },
        { name: "status", type: "String", length: 40, mandatory: true },
        { name: "court_process_started", type: "String", length: 10, mandatory: true },
        { name: "started_on_date", type: "Date" },
        { name: "started_by", type: "String", length: 120 },
        { name: "next_hearing_date", type: "Date" },
        { name: "outcome", type: "String", length: 120 },
        { name: "notes", type: "String", length: 2000 },
      ],
    },
    {
      datatableName: RECOVERY_COURT_PROCEEDING_TABLE,
      apptableName: "m_loan",
      multiRow: true,
      columns: [
        { name: "case_number", type: "String", length: 80 },
        { name: "proceeding_date", type: "Date", mandatory: true },
        { name: "proceeding_type", type: "String", length: 80 },
        { name: "status", type: "String", length: 40, mandatory: true },
        { name: "next_hearing_date", type: "Date" },
        { name: "outcome", type: "String", length: 120 },
        { name: "recorded_by", type: "String", length: 120 },
        { name: "notes", type: "String", length: 2000 },
      ],
    },
  ];

  for (const table of tables) {
    try {
      await fetchFineractAPI("/datatables", {
        method: "POST",
        body: JSON.stringify(table),
      });
    } catch (error) {
      if (!isAlreadyExistsError(error)) throw error;
    }
  }
}

export async function setupRecoveryReports(): Promise<{ success: boolean; error?: string }> {
  const reports = [
    {
      reportName: RECOVERY_ARREARS_REPORT,
      reportType: "Table",
      reportSubType: "",
      reportCategory: "Recoveries",
      description: "Recovery arrears detail based on Aging Detail, filterable by minimum and maximum days past due.",
      useReport: true,
      reportSql: `WITH base AS (
  SELECT
       ounder.id AS office_id,
       Concat(Repeat('..', ((Length(ounder.hierarchy) - Length(Replace(ounder.hierarchy , '.', '')) - 1))), ounder.name) AS office_branch,
       COALESCE(cur.display_symbol, ml.currency_code) AS currency,
       ml.currency_code,
       mc.id AS client_id,
       mc.account_no AS client_account_no,
       mc.display_name AS client_name,
       ml.id AS loan_id,
       ml.account_no AS account_no,
       COALESCE(lp.name, 'Unknown Product') AS product_name,
       ml.principal_amount AS principal_amount,
       ml.principal_disbursed_derived AS original_principal,
       ml.interest_charged_derived AS original_interest,
       ml.principal_repaid_derived AS principal_paid,
       ml.interest_repaid_derived AS interest_paid,
       COALESCE(laa.principal_overdue_derived, 0) AS principal_overdue,
       COALESCE(laa.interest_overdue_derived, 0) AS interest_overdue,
       COALESCE(laa.fee_charges_overdue_derived, 0) AS fee_charges_overdue,
       COALESCE(laa.penalty_charges_overdue_derived, 0) AS penalty_charges_overdue,
       COALESCE(laa.total_overdue_derived, 0) AS total_overdue,
       COALESCE(ml.total_outstanding_derived, 0) AS total_outstanding,
       GREATEST(Extract(day FROM (CURRENT_DATE::timestamp - laa.overdue_since_date_derived::timestamp))::int, 0) AS days_in_arrears,
       rev.enum_value AS loan_status,
       COALESCE(ml.is_npa, false) AS is_npa
  FROM m_client mc
  JOIN m_office ounder ON ounder.id = mc.office_id
       AND ounder.hierarchy LIKE concat('\${currentUserHierarchy}', '%')
  JOIN m_loan ml ON ml.client_id = mc.id
  JOIN r_enum_value rev ON rev.enum_id = ml.loan_status_id
       AND rev.enum_name = 'loan_status_id'
  JOIN m_loan_arrears_aging laa ON laa.loan_id = ml.id
  LEFT JOIN m_product_loan lp ON lp.id = ml.product_id
  LEFT JOIN m_currency cur ON cur.code = ml.currency_code
  WHERE ml.loan_status_id = 300
)
SELECT office_id,
       office_branch AS "Office/Branch",
       currency,
       currency_code,
       client_id,
       client_account_no AS "Client Account No.",
       client_name AS "Client Name",
       loan_id,
       account_no AS "Account Number",
       product_name AS "Product Name",
       principal_amount AS "Loan Amount",
       original_principal AS "Original Principal",
       original_interest AS "Original Interest",
       principal_paid AS "Principal Paid",
       interest_paid AS "Interest Paid",
       principal_overdue AS "Principal Overdue",
       interest_overdue AS "Interest Overdue",
       fee_charges_overdue AS "Fee Charges Overdue",
       penalty_charges_overdue AS "Penalty Charges Overdue",
       total_overdue AS "Total Overdue",
       total_outstanding AS "Total Outstanding",
       days_in_arrears AS "Days in Arrears",
       CASE
         WHEN days_in_arrears < 7 THEN '<1'
         WHEN days_in_arrears < 8 THEN '1'
         WHEN days_in_arrears < 15 THEN '2'
         WHEN days_in_arrears < 22 THEN '3'
         WHEN days_in_arrears < 29 THEN '4'
         WHEN days_in_arrears < 36 THEN '5'
         WHEN days_in_arrears < 43 THEN '6'
         WHEN days_in_arrears < 50 THEN '7'
         WHEN days_in_arrears < 57 THEN '8'
         WHEN days_in_arrears < 64 THEN '9'
         WHEN days_in_arrears < 71 THEN '10'
         WHEN days_in_arrears < 78 THEN '11'
         WHEN days_in_arrears < 85 THEN '12'
         ELSE '12+'
       END AS "Weeks In Arrears Band",
       CASE
         WHEN days_in_arrears < 31 THEN '0 - 30'
         WHEN days_in_arrears < 61 THEN '30 - 60'
         WHEN days_in_arrears < 91 THEN '60 - 90'
         WHEN days_in_arrears < 181 THEN '90 - 180'
         WHEN days_in_arrears < 361 THEN '180 - 360'
         ELSE '> 360'
       END AS "Days in Arrears Band",
       CASE
         WHEN days_in_arrears >= 90 THEN '90'
         WHEN days_in_arrears >= 60 THEN '60'
         WHEN days_in_arrears >= 30 THEN '30'
         ELSE 'CURRENT'
       END AS bucket,
       loan_status,
       is_npa
FROM base
WHERE total_overdue > 0
  AND days_in_arrears >= COALESCE(NULLIF(regexp_replace('\${daysPastDue}', '[^0-9]', '', 'g'), '')::int, 0)
  AND days_in_arrears <= COALESCE(NULLIF(regexp_replace('\${maxDaysPastDue}', '[^0-9]', '', 'g'), '')::int, days_in_arrears)
ORDER BY office_branch, currency, account_no
LIMIT COALESCE(NULLIF(regexp_replace('\${pageLimit}', '[^0-9]', '', 'g'), '')::int, 26)
OFFSET COALESCE(NULLIF(regexp_replace('\${pageOffset}', '[^0-9]', '', 'g'), '')::int, 0)`,
      reportParameters: [
        {
          parameterId: 1026,
          reportParameterName: "daysPastDue",
        },
        {
          parameterId: 1027,
          reportParameterName: "maxDaysPastDue",
        },
        {
          parameterId: 1028,
          reportParameterName: "pageLimit",
        },
        {
          parameterId: 1029,
          reportParameterName: "pageOffset",
        },
      ],
    },
    {
      reportName: RECOVERY_NPA_REPORT,
      reportType: "Table",
      reportSubType: "",
      reportCategory: "Recoveries",
      description: "Active loans currently marked as NPA by Fineract.",
      useReport: true,
      reportSql: `WITH base AS (
  SELECT
       ounder.id AS office_id,
       Concat(Repeat('..', ((Length(ounder.hierarchy) - Length(Replace(ounder.hierarchy , '.', '')) - 1))), ounder.name) AS office_branch,
       COALESCE(cur.display_symbol, ml.currency_code) AS currency,
       ml.currency_code,
       mc.id AS client_id,
       mc.account_no AS client_account_no,
       mc.display_name AS client_name,
       ml.id AS loan_id,
       ml.account_no AS account_no,
       COALESCE(lp.name, 'Unknown Product') AS product_name,
       ml.principal_amount AS principal_amount,
       ml.principal_disbursed_derived AS original_principal,
       ml.interest_charged_derived AS original_interest,
       ml.principal_repaid_derived AS principal_paid,
       ml.interest_repaid_derived AS interest_paid,
       COALESCE(laa.principal_overdue_derived, 0) AS principal_overdue,
       COALESCE(laa.interest_overdue_derived, 0) AS interest_overdue,
       COALESCE(laa.fee_charges_overdue_derived, 0) AS fee_charges_overdue,
       COALESCE(laa.penalty_charges_overdue_derived, 0) AS penalty_charges_overdue,
       COALESCE(laa.total_overdue_derived, 0) AS total_overdue,
       COALESCE(ml.total_outstanding_derived, 0) AS total_outstanding,
       CASE
         WHEN laa.overdue_since_date_derived IS NULL THEN 0
         ELSE GREATEST(Extract(day FROM (CURRENT_DATE::timestamp - laa.overdue_since_date_derived::timestamp))::int, 0)
       END AS days_in_arrears,
       rev.enum_value AS loan_status,
       COALESCE(ml.is_npa, false) AS is_npa
  FROM m_client mc
  JOIN m_office ounder ON ounder.id = mc.office_id
       AND ounder.hierarchy LIKE concat('\${currentUserHierarchy}', '%')
  JOIN m_loan ml ON ml.client_id = mc.id
  JOIN r_enum_value rev ON rev.enum_id = ml.loan_status_id
       AND rev.enum_name = 'loan_status_id'
  LEFT JOIN m_loan_arrears_aging laa ON laa.loan_id = ml.id
  LEFT JOIN m_product_loan lp ON lp.id = ml.product_id
  LEFT JOIN m_currency cur ON cur.code = ml.currency_code
  WHERE ml.loan_status_id = 300
    AND COALESCE(ml.is_npa, false) = true
)
SELECT office_id,
       office_branch AS "Office/Branch",
       currency,
       currency_code,
       client_id,
       client_account_no AS "Client Account No.",
       client_name AS "Client Name",
       loan_id,
       account_no AS "Account Number",
       product_name AS "Product Name",
       principal_amount AS "Loan Amount",
       original_principal AS "Original Principal",
       original_interest AS "Original Interest",
       principal_paid AS "Principal Paid",
       interest_paid AS "Interest Paid",
       principal_overdue AS "Principal Overdue",
       interest_overdue AS "Interest Overdue",
       fee_charges_overdue AS "Fee Charges Overdue",
       penalty_charges_overdue AS "Penalty Charges Overdue",
       total_overdue AS "Total Overdue",
       total_outstanding AS "Total Outstanding",
       days_in_arrears AS "Days in Arrears",
       CASE
         WHEN days_in_arrears < 7 THEN '<1'
         WHEN days_in_arrears < 8 THEN '1'
         WHEN days_in_arrears < 15 THEN '2'
         WHEN days_in_arrears < 22 THEN '3'
         WHEN days_in_arrears < 29 THEN '4'
         WHEN days_in_arrears < 36 THEN '5'
         WHEN days_in_arrears < 43 THEN '6'
         WHEN days_in_arrears < 50 THEN '7'
         WHEN days_in_arrears < 57 THEN '8'
         WHEN days_in_arrears < 64 THEN '9'
         WHEN days_in_arrears < 71 THEN '10'
         WHEN days_in_arrears < 78 THEN '11'
         WHEN days_in_arrears < 85 THEN '12'
         ELSE '12+'
       END AS "Weeks In Arrears Band",
       CASE
         WHEN days_in_arrears < 31 THEN '0 - 30'
         WHEN days_in_arrears < 61 THEN '30 - 60'
         WHEN days_in_arrears < 91 THEN '60 - 90'
         WHEN days_in_arrears < 181 THEN '90 - 180'
         WHEN days_in_arrears < 361 THEN '180 - 360'
         ELSE '> 360'
       END AS "Days in Arrears Band",
       CASE
         WHEN days_in_arrears >= 90 THEN '90'
         WHEN days_in_arrears >= 60 THEN '60'
         WHEN days_in_arrears >= 30 THEN '30'
         ELSE 'CURRENT'
       END AS bucket,
       loan_status,
       is_npa
FROM base
ORDER BY office_branch, currency, account_no
LIMIT COALESCE(NULLIF(regexp_replace('\${pageLimit}', '[^0-9]', '', 'g'), '')::int, 26)
OFFSET COALESCE(NULLIF(regexp_replace('\${pageOffset}', '[^0-9]', '', 'g'), '')::int, 0)`,
      reportParameters: [
        {
          parameterId: 1028,
          reportParameterName: "pageLimit",
        },
        {
          parameterId: 1029,
          reportParameterName: "pageOffset",
        },
      ],
    },
    {
      reportName: RECOVERY_SUMMARY_REPORT,
      reportType: "Table",
      reportSubType: "",
      reportCategory: "Recoveries",
      description: "Aggregate recovery dashboard totals without returning account-level rows.",
      useReport: true,
      reportSql: `WITH base AS (
  SELECT
       COALESCE(ml.total_outstanding_derived, 0) AS total_outstanding,
       COALESCE(laa.total_overdue_derived, 0) AS total_overdue,
       CASE
         WHEN laa.overdue_since_date_derived IS NULL THEN 0
         ELSE GREATEST(Extract(day FROM (CURRENT_DATE::timestamp - laa.overdue_since_date_derived::timestamp))::int, 0)
       END AS days_in_arrears,
       COALESCE(ml.is_npa, false) AS is_npa
  FROM m_client mc
  JOIN m_office ounder ON ounder.id = mc.office_id
       AND ounder.hierarchy LIKE concat('\${currentUserHierarchy}', '%')
  JOIN m_loan ml ON ml.client_id = mc.id
  LEFT JOIN m_loan_arrears_aging laa ON laa.loan_id = ml.id
  WHERE ml.loan_status_id = 300
)
SELECT COUNT(*) AS active_loan_count,
       COUNT(*) FILTER (WHERE total_overdue > 0) AS arrears_loan_count,
       COUNT(*) FILTER (WHERE total_overdue > 0 AND days_in_arrears BETWEEN 30 AND 59) AS bucket_30_count,
       COUNT(*) FILTER (WHERE total_overdue > 0 AND days_in_arrears BETWEEN 60 AND 89) AS bucket_60_count,
       COUNT(*) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 90) AS bucket_90_count,
       COUNT(*) FILTER (WHERE is_npa) AS npa_loan_count,
       COALESCE(SUM(total_outstanding), 0) AS total_outstanding_amount,
       COALESCE(SUM(total_overdue), 0) AS total_overdue_amount,
       COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 30), 0) AS par30_outstanding_amount,
       COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 60), 0) AS par60_outstanding_amount,
       COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 90), 0) AS par90_outstanding_amount,
       CASE
         WHEN COALESCE(SUM(total_outstanding), 0) > 0
         THEN ((COALESCE(SUM(total_outstanding), 0) - COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 30), 0)) / COALESCE(SUM(total_outstanding), 0)) * 100
         ELSE 0
       END AS current_rate
FROM base`,
    },
    {
      reportName: RECOVERY_BRANCH_REPORT,
      reportType: "Table",
      reportSubType: "",
      reportCategory: "Recoveries",
      description: "Branch-level collection performance aggregates for recoveries.",
      useReport: true,
      reportSql: `WITH base AS (
  SELECT
       ounder.id AS office_id,
       ounder.name AS office_name,
       COALESCE(ml.total_outstanding_derived, 0) AS total_outstanding,
       COALESCE(laa.total_overdue_derived, 0) AS total_overdue,
       CASE
         WHEN laa.overdue_since_date_derived IS NULL THEN 0
         ELSE GREATEST(Extract(day FROM (CURRENT_DATE::timestamp - laa.overdue_since_date_derived::timestamp))::int, 0)
       END AS days_in_arrears,
       COALESCE(ml.is_npa, false) AS is_npa
  FROM m_client mc
  JOIN m_office ounder ON ounder.id = mc.office_id
       AND ounder.hierarchy LIKE concat('\${currentUserHierarchy}', '%')
  JOIN m_loan ml ON ml.client_id = mc.id
  LEFT JOIN m_loan_arrears_aging laa ON laa.loan_id = ml.id
  WHERE ml.loan_status_id = 300
)
SELECT office_id,
       office_name,
       COUNT(*) AS active_loan_count,
       COUNT(*) FILTER (WHERE total_overdue > 0) AS arrears_loan_count,
       COUNT(*) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 30) AS par30_loan_count,
       COUNT(*) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 60) AS par60_loan_count,
       COUNT(*) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 90) AS par90_loan_count,
       COUNT(*) FILTER (WHERE is_npa) AS npa_loan_count,
       COALESCE(SUM(total_outstanding), 0) AS outstanding_amount,
       COALESCE(SUM(total_overdue), 0) AS overdue_amount,
       COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 30), 0) AS par30_outstanding_amount,
       COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 60), 0) AS par60_outstanding_amount,
       COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 90), 0) AS par90_outstanding_amount,
       CASE
         WHEN COALESCE(SUM(total_outstanding), 0) > 0
         THEN ((COALESCE(SUM(total_outstanding), 0) - COALESCE(SUM(total_outstanding) FILTER (WHERE total_overdue > 0 AND days_in_arrears >= 30), 0)) / COALESCE(SUM(total_outstanding), 0)) * 100
         ELSE 0
       END AS current_rate
FROM base
GROUP BY office_id, office_name
ORDER BY par30_outstanding_amount DESC, office_name`,
    },
    {
      reportName: COURT_CASES_REPORT,
      reportType: "Table",
      reportSubType: "",
      reportCategory: "Recoveries",
      description: "List all loan court cases captured in the recovery court case datatable.",
      useReport: true,
      reportSql: `SELECT cc.id,
       cc.loan_id,
       ml.account_no AS loan_account_no,
       mc.id AS client_id,
       mc.display_name AS client_name,
       mo.name AS office_name,
       lp.name AS product_name,
       cc.case_number,
       cc.court_name,
       TO_CHAR(cc.filing_date, 'YYYY-MM-DD') AS filing_date,
       cc.lawyer_name,
       cc.status,
       cc.court_process_started,
       TO_CHAR(cc.started_on_date, 'YYYY-MM-DD') AS started_on_date,
       cc.started_by,
       TO_CHAR(cc.next_hearing_date, 'YYYY-MM-DD') AS next_hearing_date,
       cc.outcome,
       cc.notes
FROM ${RECOVERY_COURT_CASE_TABLE} cc
JOIN m_loan ml ON ml.id = cc.loan_id
JOIN m_client mc ON mc.id = ml.client_id
LEFT JOIN m_office mo ON mo.id = mc.office_id
LEFT JOIN m_product_loan lp ON lp.id = ml.product_id
ORDER BY cc.started_on_date DESC NULLS LAST, cc.id DESC`,
    },
    {
      reportName: COURT_PROCEEDINGS_REPORT,
      reportType: "Table",
      reportSubType: "",
      reportCategory: "Recoveries",
      description: "List all court proceedings captured against loans.",
      useReport: true,
      reportSql: `SELECT cp.id,
       cp.loan_id,
       ml.account_no AS loan_account_no,
       mc.id AS client_id,
       mc.display_name AS client_name,
       mo.name AS office_name,
       lp.name AS product_name,
       cp.case_number,
       TO_CHAR(cp.proceeding_date, 'YYYY-MM-DD') AS proceeding_date,
       cp.proceeding_type,
       cp.status,
       TO_CHAR(cp.next_hearing_date, 'YYYY-MM-DD') AS next_hearing_date,
       cp.outcome,
       cp.recorded_by,
       cp.notes
FROM ${RECOVERY_COURT_PROCEEDING_TABLE} cp
JOIN m_loan ml ON ml.id = cp.loan_id
JOIN m_client mc ON mc.id = ml.client_id
LEFT JOIN m_office mo ON mo.id = mc.office_id
LEFT JOIN m_product_loan lp ON lp.id = ml.product_id
ORDER BY cp.proceeding_date DESC, cp.id DESC`,
    },
  ];

  let existingReports: Array<{ id: number; reportName: string }> = [];
  try {
    existingReports = (await fetchFineractAPI("/reports")) ?? [];
  } catch {
    existingReports = [];
  }

  const existingMap = new Map(existingReports.map((report) => [report.reportName, report.id]));

  for (const report of reports) {
    const existingId = existingMap.get(report.reportName);
    try {
      if (existingId) {
        const reportUpdate = { ...report } as typeof report & { reportParameters?: unknown };
        delete reportUpdate.reportParameters;
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
  }

  return { success: true };
}

export async function addRecoveryLoanNote(loanId: number, note: string, actorName?: string): Promise<void> {
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Note is required");

  const author = actorName?.trim() || "System";
  await fetchFineractAPI(`/loans/${loanId}/notes`, {
    method: "POST",
    body: JSON.stringify({
      note: `[Recovery Follow-up] ${trimmed}\n\nRecorded by: ${author}`,
    }),
  });
}

export async function writeOffRecoveryLoan(loanId: number, note: string): Promise<unknown> {
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Note is required");

  return fetchFineractAPI(`/loans/${loanId}/transactions?command=writeoff`, {
    method: "POST",
    body: JSON.stringify({
      transactionDate: formatFineractDate(new Date()),
      note: trimmed,
      dateFormat: DATE_FORMAT,
      locale: LOCALE,
    }),
  });
}

async function fetchLoanDetails(loanId: number): Promise<FineractLoanLike> {
  return fetchFineractAPI(
    `/loans/${loanId}?associations=all&exclude=guarantors,futureSchedule`,
    { cache: "no-store" }
  );
}

export async function sendRecoveryReminder(options: {
  loanId: number;
  bucket?: "30" | "60" | "90";
  tenantSlug: string;
  actorName?: string;
  note?: string;
}): Promise<{
  success: boolean;
  smsSent: boolean;
  message: string;
  targetSource?: string;
}> {
  const loan = await fetchLoanDetails(options.loanId);
  const daysPastDue = getDaysPastDue(loan);
  const bucket = options.bucket || getBucket(daysPastDue) || "30";
  const tenant = await getTenantBySlug(options.tenantSlug);
  const tenantId = tenant?.id || options.tenantSlug;
  const target = await resolveLoanNotificationTarget({
    tenantId,
    tenantSlug: options.tenantSlug,
    loanId: options.loanId,
    clientId: loan.clientId ?? null,
  });

  const bucketLabel = bucket === "90" ? "90+ Day" : `${bucket} Day`;

  if (!target) {
    await fetchFineractAPI(`/loans/${options.loanId}/notes`, {
      method: "POST",
      body: JSON.stringify({
        note: `[${bucketLabel} Reminder] Reminder was not sent because no borrower phone number could be resolved.\n\nRecorded by: ${options.actorName || "System"}`,
      }),
    });

    return {
      success: false,
      smsSent: false,
      message: "No borrower phone number could be resolved.",
    };
  }

  const overdueAmount = getOverdueAmount(loan);
  const currencyCode = getCurrencyCode(loan);
  const accountNo = loan.accountNo || String(options.loanId);
  const message = `Dear ${target.clientName || "Customer"}, your loan account ${accountNo} is ${daysPastDue} days overdue with ${currencyCode} ${overdueAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} due. Please make payment or contact us to discuss your account.`;

  const smsSent = await sendSms([target.phone], message, {
    tenantId: tenant?.slug || options.tenantSlug,
    countryCode: target.countryCode,
    logLabel: "RecoveryReminder",
  });

  const noteLines = [
    `[${bucketLabel} Reminder] ${smsSent ? "SMS sent" : "SMS attempted"} to borrower.`,
    `Loan account: ${accountNo}`,
    `Days overdue: ${daysPastDue}`,
    `Overdue amount: ${currencyCode} ${overdueAmount.toFixed(2)}`,
    options.note?.trim() ? `Note: ${options.note.trim()}` : null,
    `Recorded by: ${options.actorName || "System"}`,
  ].filter(Boolean);

  await fetchFineractAPI(`/loans/${options.loanId}/notes`, {
    method: "POST",
    body: JSON.stringify({ note: noteLines.join("\n") }),
  });

  return {
    success: true,
    smsSent,
    message: smsSent ? "Reminder SMS sent." : "Reminder was logged, but SMS service did not confirm delivery.",
    targetSource: target.source,
  };
}

export async function triggerRecoveryReminders(options: {
  bucket: "30" | "60" | "90";
  tenantSlug: string;
  actorName?: string;
  limit?: number;
}): Promise<{
  bucket: "30" | "60" | "90";
  totalCandidates: number;
  processed: number;
  sent: number;
  failed: number;
  results: Array<{ loanId: number; success: boolean; smsSent: boolean; message: string }>;
}> {
  const dashboard = await getRecoveryDashboardData(options.bucket);
  const candidates = dashboard.rows.slice(0, options.limit ?? dashboard.rows.length);
  const results: Array<{ loanId: number; success: boolean; smsSent: boolean; message: string }> = [];

  for (const row of candidates) {
    try {
      const result = await sendRecoveryReminder({
        loanId: row.loanId,
        bucket: options.bucket,
        tenantSlug: options.tenantSlug,
        actorName: options.actorName || "K8s reminder trigger",
      });
      results.push({
        loanId: row.loanId,
        success: result.success,
        smsSent: result.smsSent,
        message: result.message,
      });
    } catch (error) {
      results.push({
        loanId: row.loanId,
        success: false,
        smsSent: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    bucket: options.bucket,
    totalCandidates: dashboard.rows.length,
    processed: results.length,
    sent: results.filter((result) => result.smsSent).length,
    failed: results.filter((result) => !result.success).length,
    results,
  };
}

export async function getLoanCourtData(loanId: number): Promise<{
  cases: unknown[];
  proceedings: unknown[];
}> {
  const [cases, proceedings] = await Promise.all([
    fetchFineractAPI(`/datatables/${RECOVERY_COURT_CASE_TABLE}/${loanId}`, { cache: "no-store" }).catch(() => []),
    fetchFineractAPI(`/datatables/${RECOVERY_COURT_PROCEEDING_TABLE}/${loanId}`, { cache: "no-store" }).catch(() => []),
  ]);

  return {
    cases: Array.isArray(cases) ? cases : cases ? [cases] : [],
    proceedings: Array.isArray(proceedings) ? proceedings : proceedings ? [proceedings] : [],
  };
}

export async function createCourtCase(loanId: number, input: CourtCaseInput, actorName?: string): Promise<unknown> {
  const startedOnDate = formatInputDate(input.startedOnDate) || formatFineractDate(new Date());

  return fetchFineractAPI(`/datatables/${RECOVERY_COURT_CASE_TABLE}/${loanId}`, {
    method: "POST",
    body: JSON.stringify({
      case_number: input.caseNumber?.trim() || undefined,
      court_name: input.courtName?.trim() || undefined,
      filing_date: formatInputDate(input.filingDate),
      lawyer_name: input.lawyerName?.trim() || undefined,
      status: input.status?.trim() || "STARTED",
      court_process_started: "YES",
      started_on_date: startedOnDate,
      started_by: actorName || "System",
      next_hearing_date: formatInputDate(input.nextHearingDate),
      outcome: input.outcome?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      dateFormat: DATE_FORMAT,
      locale: LOCALE,
    }),
  });
}

export async function createCourtProceeding(
  loanId: number,
  input: CourtProceedingInput,
  actorName?: string
): Promise<unknown> {
  return fetchFineractAPI(`/datatables/${RECOVERY_COURT_PROCEEDING_TABLE}/${loanId}`, {
    method: "POST",
    body: JSON.stringify({
      case_number: input.caseNumber?.trim() || undefined,
      proceeding_date: formatInputDate(input.proceedingDate) || formatFineractDate(new Date()),
      proceeding_type: input.proceedingType?.trim() || undefined,
      status: input.status?.trim() || "RECORDED",
      next_hearing_date: formatInputDate(input.nextHearingDate),
      outcome: input.outcome?.trim() || undefined,
      recorded_by: actorName || "System",
      notes: input.notes?.trim() || undefined,
      dateFormat: DATE_FORMAT,
      locale: LOCALE,
    }),
  });
}

export async function getCourtCasesReport(): Promise<unknown[]> {
  const data = await fetchFineractAPI(`/runreports/${COURT_CASES_REPORT}?genericResultSet=false`, {
    cache: "no-store",
  });
  return Array.isArray(data) ? data : parsePageItems(data);
}

export async function getCourtProceedingsReport(): Promise<unknown[]> {
  const data = await fetchFineractAPI(`/runreports/${COURT_PROCEEDINGS_REPORT}?genericResultSet=false`, {
    cache: "no-store",
  });
  return Array.isArray(data) ? data : parsePageItems(data);
}
