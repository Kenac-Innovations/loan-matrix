"use client";

import { useCurrency } from "@/contexts/currency-context";
import useSWR from 'swr';
import {
  CreditCard,
  DollarSign,
  Calendar,
  AlertCircle,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDisplayLoanStatus } from "@/lib/loan-status";
import {
  extractTenantSlugFromHostname,
  isOmamaTenantSlug,
} from "@/lib/omama-tenant";

interface FineractLoan {
  id: number;
  accountNo: string;
  loanProductName: string;
  principal: number;
  approvedPrincipal: number;
  interestRatePerPeriod: number;
  numberOfRepayments: number;
  currency?: {
    code: string;
  };
  status: {
    id: number;
    code: string;
    value: string;
    active: boolean;
    closed: boolean;
    closedObligationsMet?: boolean;
  };
  displayStatus: string;
  chargedOff?: boolean;
  inArrears?: boolean;
  timeline: {
    submittedOnDate: string;
    approvedOnDate?: string;
    expectedDisbursementDate?: string;
    actualDisbursementDate?: string;
    expectedMaturityDate?: string;
  };
  summary: {
    principalOutstanding: number;
    totalOutstanding: number;
    totalOverdue: number;
    overdueSinceDate?: string | number[] | null;
  };
  isTopup?: boolean;
}

interface ClientLoansProps {
  clientId: number;
  readOnly?: boolean;
}

interface RawClientLoan {
  id: number;
  accountNo: string;
  productName?: string;
  loanProductName?: string;
  originalLoan?: number;
  principal?: number;
  approvedPrincipal?: number;
  interestRatePerPeriod?: number;
  numberOfRepayments?: number;
  currency?: {
    code?: string;
  };
  status?: {
    id?: number;
    code?: string;
    value?: string;
    active?: boolean;
    closed?: boolean;
    closedObligationsMet?: boolean;
    closedWrittenOff?: boolean;
  };
  timeline?: {
    submittedOnDate?: string;
    approvedOnDate?: string;
    actualDisbursementDate?: string;
    expectedMaturityDate?: string;
  };
  summary?: {
    totalOverdue?: number;
    totalOutstanding?: number;
    principalOutstanding?: number;
    overdueSinceDate?: string | number[] | null;
  };
  loanBalance?: number;
  inArrears?: boolean;
  chargedOff?: boolean;
  delinquent?: {
    pastDueDays?: number;
    delinquentDays?: number;
    delinquentAmount?: number;
  };
}

interface ClientLoanSequenceItem {
  id: number;
  timeline?: {
    submittedOnDate?: string;
    approvedOnDate?: string;
    actualDisbursementDate?: string;
    expectedDisbursementDate?: string;
  };
}

interface LoanDetailsForTable {
  id: number;
  status?: {
    closedObligationsMet?: boolean;
  };
  summary?: {
    totalOverdue?: number;
    overdueSinceDate?: string | number[] | null;
  };
  repaymentSchedule?: {
    periods?: Array<{
      period?: number;
      dueDate?: string | number[];
      obligationsMetOnDate?: string | number[];
      totalOverdue?: number;
    }>;
  };
}

const getLoanSequenceSortTime = (loan: ClientLoanSequenceItem): number => {
  const candidateDates = [
    loan.timeline?.submittedOnDate,
    loan.timeline?.approvedOnDate,
    loan.timeline?.actualDisbursementDate,
    loan.timeline?.expectedDisbursementDate,
  ];

  for (const value of candidateDates) {
    if (typeof value === "string" && value) {
      const parsed = new Date(value).getTime();
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return Number.MAX_SAFE_INTEGER;
};

// Simple fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => res.json());

export function ClientLoans({ clientId, readOnly = false }: ClientLoansProps) {
  const router = useRouter();
  const tenantSlug =
    typeof globalThis.window !== "undefined"
      ? extractTenantSlugFromHostname(globalThis.location.hostname)
      : null;
  const isOmamaTenant = isOmamaTenantSlug(tenantSlug);

  // Use accounts endpoint to get loanAccounts for accuracy
  const { data, error, isLoading } = useSWR(`/api/fineract/clients/${clientId}/accounts`, fetcher);

  // Handle different response formats and transform the loan data
  const loans: FineractLoan[] = (() => {
    if (!data) return [];
    
    let rawLoans: RawClientLoan[] = [];
    
    // If data is directly an array
    if (Array.isArray(data)) {
      rawLoans = data;
    }
    // If data has pageItems (Fineract pagination format)
    else if (data.pageItems && Array.isArray(data.pageItems)) {
      rawLoans = data.pageItems;
    }
    // If data has content (another Fineract format)
    else if (data.content && Array.isArray(data.content)) {
      rawLoans = data.content;
    }
    // If data has loans property
    else if (data.loans && Array.isArray(data.loans)) {
      rawLoans = data.loans;
    }
    // If data has loanAccounts (from /clients/{id}/accounts)
    else if (data.loanAccounts && Array.isArray(data.loanAccounts)) {
      rawLoans = data.loanAccounts;
    }
    
    const CUTOFF = new Date("2026-01-01T00:00:00Z");

    const parseFineractDate = (
      d: string | number[] | null | undefined
    ): Date | null => {
      if (!d) return null;
      if (Array.isArray(d) && d.length >= 3) return new Date(d[0], d[1] - 1, d[2]);
      if (typeof d === "string") return new Date(d);
      return null;
    };

    return rawLoans
      .filter((loan: RawClientLoan) => {
        const date = parseFineractDate(loan.timeline?.actualDisbursementDate)
          ?? parseFineractDate(loan.timeline?.submittedOnDate);
        return !date || date >= CUTOFF;
      })
      .map((loan) => ({
      id: loan.id,
      accountNo: loan.accountNo,
      loanProductName: loan.productName || loan.loanProductName || "",
      principal:
        loan.originalLoan ||
        loan.principal ||
        loan.approvedPrincipal ||
        0,
      approvedPrincipal:
        loan.originalLoan ||
        loan.approvedPrincipal ||
        loan.principal ||
        0,
      interestRatePerPeriod: loan.interestRatePerPeriod || 0,
      numberOfRepayments: loan.numberOfRepayments || 0,
      currency: loan.currency ? { code: loan.currency.code } : undefined,
      status: {
        id: loan.status?.id || 0,
        code: loan.status?.code || "",
        value: loan.status?.value || "",
        active: loan.status?.active || false,
        closed: loan.status?.closed || false,
        closedObligationsMet: loan.status?.closedObligationsMet || false,
      },
      displayStatus: getDisplayLoanStatus(loan),
      chargedOff: loan.chargedOff || false,
      inArrears: loan.inArrears || false,
      timeline: {
        submittedOnDate: loan.timeline?.submittedOnDate || "",
        approvedOnDate: loan.timeline?.approvedOnDate || "",
        actualDisbursementDate: loan.timeline?.actualDisbursementDate || "",
        expectedMaturityDate: loan.timeline?.expectedMaturityDate || "",
      },
      summary: {
        principalOutstanding:
          loan.summary?.principalOutstanding ||
          loan.loanBalance ||
          0,
        totalOutstanding:
          loan.summary?.totalOutstanding ||
          loan.loanBalance ||
          0,
        totalOverdue:
          loan.summary?.totalOverdue ||
          (loan.inArrears ? (loan.loanBalance || 0) : 0),
        overdueSinceDate: loan.summary?.overdueSinceDate || null,
      },
    }));
  })();

  const shouldFetchOmamaLoanDetails =
    isOmamaTenant &&
    loans.some(
      (loan) => loan.summary.totalOverdue > 0 || loan.status.closedObligationsMet
    );

  const { data: omamaLoanDetails } = useSWR<Record<number, LoanDetailsForTable>>(
    shouldFetchOmamaLoanDetails
      ? [
          "omama-client-loan-details",
          ...loans
            .filter(
              (loan) =>
                loan.summary.totalOverdue > 0 || loan.status.closedObligationsMet
            )
            .map((loan) => loan.id)
            .sort((a, b) => a - b),
        ]
      : null,
    async ([, ...loanIds]) => {
      const detailEntries = await Promise.all(
        loanIds.map(async (loanId) => {
          const response = await fetch(`/api/fineract/loans/${loanId}/details`);
          if (!response.ok) {
            return [loanId, null] as const;
          }

          const detail = (await response.json()) as LoanDetailsForTable;
          return [loanId, detail] as const;
        })
      );

      return Object.fromEntries(
        detailEntries.filter((entry): entry is readonly [number, LoanDetailsForTable] =>
          Boolean(entry[1])
        )
      );
    }
  );

  const getStatusBadge = (loan: FineractLoan) => {
    const status = loan.displayStatus;
    const statusLower = status.toLowerCase();

    if (statusLower.includes("written off") || statusLower.includes("closed")) {
      return (
        <Badge variant="outline" className="bg-gray-500 text-white border-0">
          {status}
        </Badge>
      );
    }
    if (statusLower.includes("overdue") || statusLower.includes("arrears")) {
      return (
        <Badge variant="outline" className="bg-orange-500 text-white border-0">
          {status}
        </Badge>
      );
    }
    if (statusLower.includes("active")) {
      return (
        <Badge variant="outline" className="bg-green-500 text-white border-0">
          {status}
        </Badge>
      );
    }
    if (statusLower.includes("approved") && !statusLower.includes("pending")) {
      return (
        <Badge variant="outline" className="bg-blue-500 text-white border-0">
          {status}
        </Badge>
      );
    }
    if (statusLower.includes("pending") || statusLower.includes("submitted")) {
      return (
        <Badge variant="outline" className="bg-yellow-500 text-white border-0">
          {status}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-purple-500 text-white border-0">
        {status}
      </Badge>
    );
  };

  const { currencyCode: orgCurrency } = useCurrency();
  const normalizeCurrencyCode = (code: string | undefined | null): string => {
    if (!code) return orgCurrency;
    if (code.toUpperCase() === "ZMK") return "ZMW";
    return code;
  };

  const formatCurrency = (amount: number, currencyCode: string = orgCurrency) => {
    // Return empty string if amount is undefined, null, NaN, or 0
    if (amount === undefined || amount === null || isNaN(amount) || amount === 0) {
      return "";
    }
    
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizeCurrencyCode(currencyCode),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const toDate = (value: string | number[] | null | undefined): Date | null => {
    if (!value) return null;
    if (Array.isArray(value) && value.length >= 3) {
      return new Date(value[0], value[1] - 1, value[2]);
    }

    if (typeof value === "string") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  };

  const getDifferenceInDays = (startDate: Date, endDate: Date): number => {
    const msPerDay = 1000 * 60 * 60 * 24;
    const start = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate()
    ).getTime();
    const end = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate()
    ).getTime();

    return Math.max(0, Math.floor((end - start) / msPerDay));
  };

  const formatDayCount = (days: number | null): string => {
    if (days === null) return "Current";
    if (days === 1) return "1 day overdue";
    return `${days} days overdue`;
  };

  const getOmamaLoanDetail = (loanId: number) => omamaLoanDetails?.[loanId] ?? null;

  const getOverdueDays = (loan: FineractLoan): number | null => {
    const detail = getOmamaLoanDetail(loan.id);
    const overdueSinceDate = toDate(
      detail?.summary?.overdueSinceDate ?? loan.summary.overdueSinceDate
    );

    if (!overdueSinceDate || loan.summary.totalOverdue <= 0) {
      return null;
    }

    return getDifferenceInDays(overdueSinceDate, new Date());
  };

  const getClosedObligationsPaidOnTime = (loan: FineractLoan): boolean | null => {
    if (!loan.status.closedObligationsMet) {
      return null;
    }

    const repaymentPeriods =
      getOmamaLoanDetail(loan.id)?.repaymentSchedule?.periods || [];

    if (repaymentPeriods.length === 0) {
      return null;
    }

    return repaymentPeriods
      .filter((period) => Number(period?.period ?? 0) > 0)
      .every((period) => {
        const dueDate = toDate(period?.dueDate);
        const settledDate = toDate(period?.obligationsMetOnDate);

        if ((period?.totalOverdue ?? 0) > 0) return false;
        if (!dueDate || !settledDate) return true;

        return settledDate.getTime() <= dueDate.getTime();
      });
  };

  // Calculate summary metrics
  const totalPrincipal = loans.reduce(
    (sum, loan) => sum + (loan.approvedPrincipal || loan.principal || 0),
    0
  );
  const totalOutstanding = loans.reduce(
    (sum, loan) => sum + loan.summary.totalOutstanding,
    0
  );
  const totalOverdue = loans.reduce(
    (sum, loan) => sum + loan.summary.totalOverdue,
    0
  );
  const activeLoans = loans.filter((loan) => {
    const statusLower = loan.displayStatus.toLowerCase();
    return statusLower.includes("active") || statusLower.includes("overdue");
  }).length;
  const orderedLoans = [...loans].sort((left, right) => {
    const timeDiff =
      getLoanSequenceSortTime(left) - getLoanSequenceSortTime(right);

    if (timeDiff !== 0) {
      return timeDiff;
    }

    return left.id - right.id;
  });
  const loanSequenceNumbers = new Map(
    orderedLoans.map((loan, index) => [loan.id, index + 1])
  );

  // Get currency for display - use first loan's currency when all share same currency
  const summaryCurrency =
    loans.length > 0 &&
    loans.every((l) => !l.currency || l.currency.code === loans[0]?.currency?.code)
      ? loans[0]?.currency?.code
      : undefined;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-32 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load client loans from Fineract</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Loan Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loans.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeLoans} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Principal
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalPrincipal, summaryCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">Approved amount</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalOutstanding, summaryCurrency)}
            </div>
            <p className="text-xs text-muted-foreground">Current balance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle
              className={`h-4 w-4 ${
                totalOverdue > 0 ? "text-red-400" : "text-green-400"
              }`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalOverdue, summaryCurrency)}
            </div>
            <p
              className={`text-xs ${
                totalOverdue > 0 ? "text-red-400" : "text-green-400"
              }`}
            >
              {totalOverdue > 0 ? "Requires attention" : "All current"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Loans Table */}
      <Card>
        <CardHeader>
          <CardTitle>Loan Details</CardTitle>
          <CardDescription>
            Complete list of loans for this client
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No loans found for this client
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[72px]"></TableHead>
                    <TableHead>Loan Product</TableHead>
                    <TableHead>Account No</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Outstanding</TableHead>
                    {isOmamaTenant && <TableHead>Overdue By</TableHead>}
                    <TableHead>Status</TableHead>
                    {isOmamaTenant && <TableHead>Closed Obligations Met</TableHead>}
                    <TableHead>Maturity Date</TableHead>
                    <TableHead className="w-[48px] text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderedLoans.map((loan) => {
                    const overdueDays = isOmamaTenant
                      ? getOverdueDays(loan)
                      : null;
                    const closedObligationsPaidOnTime = isOmamaTenant
                      ? getClosedObligationsPaidOnTime(loan)
                      : null;

                    return (
                    <TableRow
                      key={loan.id}
                      className={readOnly ? "" : "cursor-pointer transition-colors hover:bg-muted/50"}
                      onClick={() => {
                        if (readOnly) return;
                        router.push(`/clients/${clientId}/loans/${loan.id}`);
                      }}
                      onKeyDown={(event) => {
                        if (readOnly) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/clients/${clientId}/loans/${loan.id}`);
                        }
                      }}
                      tabIndex={readOnly ? -1 : 0}
                      role={readOnly ? undefined : "link"}
                      aria-label={
                        readOnly
                          ? undefined
                          : `Open loan ${loan.accountNo || loan.id} details`
                      }
                    >
                      <TableCell>
                        <div className="flex justify-center">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            {loanSequenceNumbers.get(loan.id) ?? "?"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {loan.loanProductName}
                            </span>
                            {loan.isTopup && (
                              <Badge className="bg-amber-500/15 text-amber-600 border-amber-300 text-[10px] px-1.5 py-0 font-medium">
                                Top-Up
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {loan.interestRatePerPeriod}% •{" "}
                            {loan.numberOfRepayments} payments
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm">
                          {loan.accountNo}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {formatCurrency(loan.principal, loan.currency?.code)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {formatCurrency(loan.summary.totalOutstanding, loan.currency?.code)}
                          </div>
                          {loan.summary.totalOverdue > 0 && (
                            <div className="text-sm text-red-500">
                              {formatCurrency(loan.summary.totalOverdue, loan.currency?.code)}{" "}
                              overdue
                            </div>
                          )}
                        </div>
                      </TableCell>
                      {isOmamaTenant && (
                        <TableCell>
                          <div className="text-sm">
                            {loan.summary.totalOverdue > 0
                              ? formatDayCount(overdueDays)
                              : "Current"}
                          </div>
                        </TableCell>
                      )}
                      <TableCell>{getStatusBadge(loan)}</TableCell>
                      {isOmamaTenant && (
                        <TableCell>
                          <div className="text-sm">
                            {loan.status.closedObligationsMet
                              ? closedObligationsPaidOnTime === null
                                ? "Closed in full"
                                : closedObligationsPaidOnTime
                                  ? "Paid in full and on time"
                                  : "Paid in full, but not all on time"
                              : "—"}
                          </div>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {loan.timeline.expectedMaturityDate
                            ? formatDate(loan.timeline.expectedMaturityDate)
                            : "Not set"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {!readOnly && (
                          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
