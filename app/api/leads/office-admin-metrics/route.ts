import { NextRequest, NextResponse } from "next/server";
import { startOfMonth, format as formatDate } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getFineractServiceWithSession, type FineractLoan } from "@/lib/fineract-api";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { getTenantFeatures } from "@/lib/tenant-features";
import {
  matchesOfficeName,
  shouldUseOmamaOfficeAdminDashboard,
} from "@/lib/omama-office-admin";

type SessionRole = {
  name?: string | null;
  disabled?: boolean | null;
};

function parseFineractDate(dateValue?: string | number[] | null): Date | null {
  if (!dateValue) return null;

  if (Array.isArray(dateValue) && dateValue.length >= 3) {
    const [year, month, day] = dateValue;
    return new Date(year, month - 1, day);
  }

  if (typeof dateValue === "string") {
    const parsed = new Date(dateValue);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function parseReportData(reportData: any): any[] {
  if (!reportData) return [];

  if (Array.isArray(reportData) && reportData.length > 0) {
    if (
      typeof reportData[0] === "object" &&
      !Array.isArray(reportData[0]) &&
      !reportData[0].row
    ) {
      return reportData;
    }
  }

  const { columnHeaders, data } = reportData;
  if (!columnHeaders || !data || !Array.isArray(data)) return [];

  const columns = columnHeaders.map((col: any) => {
    const name = col.columnName || col.name || col;
    return String(name).toLowerCase().replaceAll(" ", "_").replaceAll(/[()%]/g, "");
  });

  return data.map((item: any) => {
    const rowData = item.row || item;
    const obj: Record<string, any> = {};
    columns.forEach((col: string, index: number) => {
      obj[col] = rowData[index];
    });
    return obj;
  });
}

function parseNumericValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.trim().replaceAll(",", "").replaceAll(" ", "");
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function getCollectionStats(rows: any[]) {
  if (!rows.length) {
    return {
      totalAmount: 0,
      overdueAmount: 0,
      collectionSuccessPercentage: 0,
    };
  }

  const keys = Object.keys(rows[0]);
  const findKey = (patterns: string[]) =>
    keys.find((key) => {
      const lower = key.toLowerCase();
      return patterns.some((pattern) => lower.includes(pattern));
    }) || null;

  const amountCol = findKey(["total_due", "total_expected", "total", "amount_due", "amount"]);
  const overdueCol = findKey(["total_overdue", "overdue", "arrears", "past_due"]);

  let totalAmount = 0;
  let overdueAmount = 0;

  rows.forEach((row) => {
    if (amountCol) totalAmount += parseNumericValue(row[amountCol]);
    if (overdueCol) overdueAmount += parseNumericValue(row[overdueCol]);
  });

  const collectionSuccessPercentage =
    totalAmount > 0 ? ((totalAmount - overdueAmount) / totalAmount) * 100 : 0;

  return {
    totalAmount,
    overdueAmount,
    collectionSuccessPercentage,
  };
}

async function fetchAllLoans(fineractService: Awaited<ReturnType<typeof getFineractServiceWithSession>>) {
  const pageSize = 1000;
  const allLoans: FineractLoan[] = [];

  for (let offset = 0; offset < 10000; offset += pageSize) {
    const batch = await fineractService.getLoans(offset, pageSize);
    if (!Array.isArray(batch) || batch.length === 0) break;
    allLoans.push(...batch);
    if (batch.length < pageSize) break;
  }

  return allLoans;
}

function isLoanForOffice(
  loan: FineractLoan,
  officeId: number,
  officeName?: string | null
) {
  const loanOfficeId =
    typeof loan.clientOfficeId === "number"
      ? loan.clientOfficeId
      : typeof (loan as any).officeId === "number"
        ? (loan as any).officeId
        : null;

  if (loanOfficeId != null && loanOfficeId === officeId) {
    return true;
  }

  const candidateOfficeName =
    (loan as any).officeName ||
    (loan as any).clientOfficeName ||
    loan.clientName ||
    null;

  return matchesOfficeName(candidateOfficeName, officeName);
}

function getLoanPastDueDays(loan: FineractLoan): number {
  const delinquentPastDueDays = Number((loan as any)?.delinquent?.pastDueDays || 0);
  if (delinquentPastDueDays > 0) {
    return delinquentPastDueDays;
  }

  const directDaysInArrears = Number((loan as any)?.daysInArrears || 0);
  if (directDaysInArrears > 0) {
    return directDaysInArrears;
  }

  const overdueSinceDate = loan.summary?.overdueSinceDate;
  const overdueSince = parseFineractDate(overdueSinceDate);
  if (!overdueSince) {
    return 0;
  }

  const diffMs = Date.now() - overdueSince.getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

export async function GET(request: NextRequest) {
  try {
    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug, isActive: true },
      select: { settings: true },
    });

    const tenantFeatures = getTenantFeatures(tenant?.settings);
    const session = await getSession();
    const userRoles = ((session?.user as any)?.roles || []) as SessionRole[];
    const officeId = (session?.user as any)?.officeId as number | undefined;
    const officeName = ((session?.user as any)?.officeName as string | undefined) || null;

    const shouldUseOfficeDashboard = shouldUseOmamaOfficeAdminDashboard({
      tenantSlug,
      featureEnabled: tenantFeatures.officeScopedAdminLeadsDashboard,
      roles: userRoles,
    });

    if (!shouldUseOfficeDashboard) {
      return NextResponse.json(
        { error: "Office admin dashboard is not enabled for this user." },
        { status: 403 }
      );
    }

    if (!officeId) {
      return NextResponse.json(
        { error: "No office assigned to the current user." },
        { status: 400 }
      );
    }

    const fineractService = await getFineractServiceWithSession();
    const [allLoans, expectedPaymentsReport] = await Promise.all([
      fetchAllLoans(fineractService),
      fineractService.runReport("Expected Payments By Date - Basic", {
        startDate: formatDate(startOfMonth(new Date()), "yyyy-MM-dd"),
        endDate: formatDate(new Date(), "yyyy-MM-dd"),
        officeId,
        loanOfficerId: -1,
        locale: "en",
        dateFormat: "yyyy-MM-dd",
      }),
    ]);

    const officeLoans = allLoans.filter((loan) =>
      isLoanForOffice(loan, officeId, officeName)
    );
    const activeOfficeLoans = officeLoans.filter((loan) => loan.status?.active);

    const loanBookAmount = activeOfficeLoans.reduce(
      (sum, loan) => sum + (loan.summary?.totalOutstanding || 0),
      0
    );

    const par30OutstandingAmount = activeOfficeLoans.reduce((sum, loan) => {
      const totalOutstanding = loan.summary?.totalOutstanding || 0;
      const totalOverdue = loan.summary?.totalOverdue || 0;
      const pastDueDays = getLoanPastDueDays(loan);

      return totalOverdue > 0 && pastDueDays >= 30
        ? sum + totalOutstanding
        : sum;
    }, 0);

    const par30Percentage =
      loanBookAmount > 0 ? (par30OutstandingAmount / loanBookAmount) * 100 : 0;

    const currentMonthDisbursementAmount = officeLoans.reduce((sum, loan) => {
      const disbursementDate = loan.timeline?.actualDisbursementDate;
      const currentMonthStart = startOfMonth(new Date());
      const parsedDate = parseFineractDate(disbursementDate);

      if (!parsedDate || parsedDate < currentMonthStart) return sum;
      return sum + (loan.summary?.principalDisbursed || loan.principal || 0);
    }, 0);

    const collectionStats = getCollectionStats(parseReportData(expectedPaymentsReport));
    const currencyCode =
      officeLoans[0]?.currency?.code || activeOfficeLoans[0]?.currency?.code || "USD";

    return NextResponse.json({
      officeId,
      officeName,
      currencyCode,
      totalLoans: officeLoans.length,
      activeLoans: activeOfficeLoans.length,
      collectionSuccessPercentage: collectionStats.collectionSuccessPercentage,
      collectionExpectedAmount: collectionStats.totalAmount,
      collectionOverdueAmount: collectionStats.overdueAmount,
      par30Percentage,
      par30OutstandingAmount,
      currentMonthDisbursementAmount,
      loanBookAmount,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching office admin lead metrics:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch office admin dashboard metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
