/**
 * Cash session reconciliation report builder.
 *
 * Pure functions (no Prisma, no async) for building comprehensive cash session reports
 * with reconciliation analytics, variance tracking, and multi-currency support.
 */

// Input types

export type ReportSessionInput = {
  id: string;
  tenantId: string;
  tellerId: string;
  tellerName: string;
  officeId: number | null;
  officeName: string | null;
  cashierId: string;
  cashierName: string;
  sessionStatus:
    | "NOT_STARTED"
    | "ACTIVE"
    | "PENDING_CLOSURE"
    | "CLOSED"
    | "CLOSED_VERIFIED"
    | "REJECTED";
  sessionStartTime: Date | null;
  sessionEndTime: Date | null;
  openingFloat: number;
  allocatedBalance: number;
  cashIn: number;
  cashOut: number;
  netCash: number;
  expectedBalance: number | null;
  countedCashAmount: number | null;
  managerCountedAmount: number | null;
  declaredAmount: number | null;
  difference: number | null;
  businessDate: string; // YYYY-MM-DD, already resolved by caller
  currency: string; // display code, already resolved by caller
  closureInitiatedBy: string | null;
  closureInitiatedAt: Date | null;
  closedBy: string | null;
  closedAt: Date | null;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  variance?: {
    type: "SHORTAGE" | "OVERAGE";
    amount: number;
    currency: string; // display code
    status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
    resolutionType: string | null;
  } | null;
};

export type OpenVarianceInput = {
  id: string;
  businessDate: string; // YYYY-MM-DD
  type: "SHORTAGE" | "OVERAGE";
  amount: number;
  currency: string; // display code
  officeId: number | null;
  officeName: string | null;
  cashierName: string;
  status: "OPEN" | "UNDER_REVIEW";
};

// Output types

export type ReportSessionRow = {
  sessionId: string;
  businessDate: string;
  officeId: number | null;
  officeName: string | null;
  tellerId: string;
  tellerName: string;
  cashierId: string;
  cashierName: string;
  status: string;
  isClosed: boolean;
  closedState: "CLOSED" | "CLOSED_VERIFIED" | null;
  isOverdueUnclosed: boolean;
  currency: string;
  openingFloat: number;
  cashIn: number;
  cashOut: number;
  expectedBalance: number | null;
  declaredAmount: number | null;
  countedAmount: number | null;
  difference: number | null;
  closureInitiatedBy: string | null;
  closureInitiatedAt: Date | null;
  closedBy: string | null;
  closedAt: Date | null;
  variance: {
    type: "SHORTAGE" | "OVERAGE";
    amount: number;
    status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
    resolutionType: string | null;
  } | null;
};

export type ByBranchGroup = {
  officeId: number | null;
  officeName: string | null;
  currency: string;
  sessions: number;
  closed: number;
  overdueUnclosed: number;
  pendingClosure: number;
  shortageTotal: number;
  overageTotal: number;
  openVarianceTotal: number;
};

export type ByCashierGroup = {
  cashierId: string;
  cashierName: string;
  tellerName: string;
  officeName: string | null;
  currency: string;
  sessions: number;
  closed: number;
  overdueUnclosed: number;
  shortageTotal: number;
  overageTotal: number;
  openVarianceTotal: number;
};

export type AgeingBucket = {
  currency: string;
  bucket: "0-7" | "8-30" | "31+";
  count: number;
  total: number;
};

export type TotalGroup = {
  currency: string;
  sessions: number;
  closed: number;
  overdueUnclosed: number;
  shortageTotal: number;
  overageTotal: number;
  openVarianceTotal: number;
};

export type SessionReconciliationReport = {
  rows: ReportSessionRow[];
  byBranch: ByBranchGroup[];
  byCashier: ByCashierGroup[];
  ageing: AgeingBucket[];
  totals: TotalGroup[];
};

// Helper functions

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function getAgeingBucket(
  businessDate: string,
  today: string
): "0-7" | "8-30" | "31+" {
  const bdParts = businessDate.split("-");
  const todayParts = today.split("-");

  const bd = Date.UTC(
    parseInt(bdParts[0], 10),
    parseInt(bdParts[1], 10) - 1,
    parseInt(bdParts[2], 10)
  );
  const tdDate = Date.UTC(
    parseInt(todayParts[0], 10),
    parseInt(todayParts[1], 10) - 1,
    parseInt(todayParts[2], 10)
  );

  const daysDiff = Math.floor((tdDate - bd) / 86400000);

  if (daysDiff <= 7) return "0-7";
  if (daysDiff <= 30) return "8-30";
  return "31+";
}

function isSessionClosed(
  status: string
): status is "CLOSED" | "CLOSED_VERIFIED" {
  return status === "CLOSED" || status === "CLOSED_VERIFIED";
}

// Main builder function

export function buildSessionReconciliationReport(input: {
  sessions: ReportSessionInput[];
  openVariances: OpenVarianceInput[];
  today: string;
}): SessionReconciliationReport {
  const { sessions, openVariances, today } = input;

  // Build rows
  const rows: ReportSessionRow[] = sessions
    .map((session) => {
      const countedAmount = session.managerCountedAmount ?? session.countedCashAmount;
      const isOverdueUnclosed =
        (session.sessionStatus === "ACTIVE" ||
          session.sessionStatus === "PENDING_CLOSURE") &&
        session.businessDate < today;
      const isClosed = isSessionClosed(session.sessionStatus);
      const closedState = isClosed ? (session.sessionStatus as "CLOSED" | "CLOSED_VERIFIED") : null;

      return {
        sessionId: session.id,
        businessDate: session.businessDate,
        officeId: session.officeId,
        officeName: session.officeName,
        tellerId: session.tellerId,
        tellerName: session.tellerName,
        cashierId: session.cashierId,
        cashierName: session.cashierName,
        status: session.sessionStatus,
        isClosed,
        closedState,
        isOverdueUnclosed,
        currency: session.currency,
        openingFloat: roundMoney(session.openingFloat),
        cashIn: roundMoney(session.cashIn),
        cashOut: roundMoney(session.cashOut),
        expectedBalance: session.expectedBalance !== null ? roundMoney(session.expectedBalance) : null,
        declaredAmount: session.declaredAmount !== null ? roundMoney(session.declaredAmount) : null,
        countedAmount: countedAmount !== null ? roundMoney(countedAmount) : null,
        difference: session.difference !== null ? roundMoney(session.difference) : null,
        closureInitiatedBy: session.closureInitiatedBy,
        closureInitiatedAt: session.closureInitiatedAt,
        closedBy: session.closedBy,
        closedAt: session.closedAt,
        variance: session.variance
          ? {
              type: session.variance.type,
              amount: roundMoney(session.variance.amount),
              status: session.variance.status,
              resolutionType: session.variance.resolutionType,
            }
          : null,
      };
    })
    .sort((a, b) => {
      // Sort by businessDate desc, then officeName, then tellerName, then cashierName
      if (a.businessDate !== b.businessDate) {
        return b.businessDate.localeCompare(a.businessDate);
      }
      const officeCompare =
        (a.officeName ?? "").localeCompare(b.officeName ?? "");
      if (officeCompare !== 0) return officeCompare;
      const tellerCompare = a.tellerName.localeCompare(b.tellerName);
      if (tellerCompare !== 0) return tellerCompare;
      return a.cashierName.localeCompare(b.cashierName);
    });

  // Build by branch groups
  const branchMap = new Map<
    string,
    {
      officeId: number | null;
      officeName: string | null;
      currency: string;
      sessions: number;
      closed: number;
      overdueUnclosed: number;
      pendingClosure: number;
      shortageTotal: number;
      overageTotal: number;
      openVarianceTotal: number;
    }
  >();

  for (const row of rows) {
    const key = `${row.officeId}|${row.officeName}|${row.currency}`;
    let group = branchMap.get(key);
    if (!group) {
      group = {
        officeId: row.officeId,
        officeName: row.officeName,
        currency: row.currency,
        sessions: 0,
        closed: 0,
        overdueUnclosed: 0,
        pendingClosure: 0,
        shortageTotal: 0,
        overageTotal: 0,
        openVarianceTotal: 0,
      };
      branchMap.set(key, group);
    }
    group.sessions += 1;
    if (
      row.status === "CLOSED" ||
      row.status === "CLOSED_VERIFIED"
    ) {
      group.closed += 1;
    }
    if (row.isOverdueUnclosed) {
      group.overdueUnclosed += 1;
    }
    if (row.status === "PENDING_CLOSURE") {
      group.pendingClosure += 1;
    }
    if (row.variance) {
      if (row.variance.type === "SHORTAGE") {
        group.shortageTotal += row.variance.amount;
      } else {
        group.overageTotal += row.variance.amount;
      }
      if (row.variance.status === "OPEN" || row.variance.status === "UNDER_REVIEW") {
        group.openVarianceTotal += row.variance.amount;
      }
    }
  }

  const byBranch = Array.from(branchMap.values())
    .map((g) => ({
      ...g,
      shortageTotal: roundMoney(g.shortageTotal),
      overageTotal: roundMoney(g.overageTotal),
      openVarianceTotal: roundMoney(g.openVarianceTotal),
    }))
    .sort((a, b) => {
      const officeCompare =
        (a.officeName ?? "").localeCompare(b.officeName ?? "");
      if (officeCompare !== 0) return officeCompare;
      return a.currency.localeCompare(b.currency);
    });

  // Build by cashier groups
  const cashierMap = new Map<
    string,
    {
      cashierId: string;
      cashierName: string;
      tellerName: string;
      officeName: string | null;
      currency: string;
      sessions: number;
      closed: number;
      overdueUnclosed: number;
      shortageTotal: number;
      overageTotal: number;
      openVarianceTotal: number;
    }
  >();

  for (const row of rows) {
    const key = `${row.cashierId}|${row.currency}`;
    let group = cashierMap.get(key);
    if (!group) {
      group = {
        cashierId: row.cashierId,
        cashierName: row.cashierName,
        tellerName: row.tellerName,
        officeName: row.officeName,
        currency: row.currency,
        sessions: 0,
        closed: 0,
        overdueUnclosed: 0,
        shortageTotal: 0,
        overageTotal: 0,
        openVarianceTotal: 0,
      };
      cashierMap.set(key, group);
    }
    group.sessions += 1;
    if (
      row.status === "CLOSED" ||
      row.status === "CLOSED_VERIFIED"
    ) {
      group.closed += 1;
    }
    if (row.isOverdueUnclosed) {
      group.overdueUnclosed += 1;
    }
    if (row.variance) {
      if (row.variance.type === "SHORTAGE") {
        group.shortageTotal += row.variance.amount;
      } else {
        group.overageTotal += row.variance.amount;
      }
      if (row.variance.status === "OPEN" || row.variance.status === "UNDER_REVIEW") {
        group.openVarianceTotal += row.variance.amount;
      }
    }
  }

  const byCashier = Array.from(cashierMap.values())
    .map((g) => ({
      ...g,
      shortageTotal: roundMoney(g.shortageTotal),
      overageTotal: roundMoney(g.overageTotal),
      openVarianceTotal: roundMoney(g.openVarianceTotal),
    }))
    .sort((a, b) => {
      const nameCompare = a.cashierName.localeCompare(b.cashierName);
      if (nameCompare !== 0) return nameCompare;
      return a.currency.localeCompare(b.currency);
    });

  // Build ageing groups
  const ageingMap = new Map<
    string,
    { currency: string; bucket: "0-7" | "8-30" | "31+"; count: number; total: number }
  >();

  for (const variance of openVariances) {
    const bucket = getAgeingBucket(variance.businessDate, today);
    const key = `${variance.currency}|${bucket}`;
    let group = ageingMap.get(key);
    if (!group) {
      group = {
        currency: variance.currency,
        bucket,
        count: 0,
        total: 0,
      };
      ageingMap.set(key, group);
    }
    group.count += 1;
    group.total += variance.amount;
  }

  const ageing = Array.from(ageingMap.values())
    .map((g) => ({
      ...g,
      total: roundMoney(g.total),
    }))
    .sort((a, b) => {
      const currencyCompare = a.currency.localeCompare(b.currency);
      if (currencyCompare !== 0) return currencyCompare;
      const bucketOrder: Record<"0-7" | "8-30" | "31+", number> = {
        "0-7": 0,
        "8-30": 1,
        "31+": 2,
      };
      return bucketOrder[a.bucket] - bucketOrder[b.bucket];
    });

  // Build totals by currency
  const totalsMap = new Map<
    string,
    {
      currency: string;
      sessions: number;
      closed: number;
      overdueUnclosed: number;
      shortageTotal: number;
      overageTotal: number;
      openVarianceTotal: number;
    }
  >();

  for (const row of rows) {
    let group = totalsMap.get(row.currency);
    if (!group) {
      group = {
        currency: row.currency,
        sessions: 0,
        closed: 0,
        overdueUnclosed: 0,
        shortageTotal: 0,
        overageTotal: 0,
        openVarianceTotal: 0,
      };
      totalsMap.set(row.currency, group);
    }
    group.sessions += 1;
    if (
      row.status === "CLOSED" ||
      row.status === "CLOSED_VERIFIED"
    ) {
      group.closed += 1;
    }
    if (row.isOverdueUnclosed) {
      group.overdueUnclosed += 1;
    }
    if (row.variance) {
      if (row.variance.type === "SHORTAGE") {
        group.shortageTotal += row.variance.amount;
      } else {
        group.overageTotal += row.variance.amount;
      }
      if (row.variance.status === "OPEN" || row.variance.status === "UNDER_REVIEW") {
        group.openVarianceTotal += row.variance.amount;
      }
    }
  }

  const totals = Array.from(totalsMap.values())
    .map((g) => ({
      ...g,
      shortageTotal: roundMoney(g.shortageTotal),
      overageTotal: roundMoney(g.overageTotal),
      openVarianceTotal: roundMoney(g.openVarianceTotal),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return {
    rows,
    byBranch,
    byCashier,
    ageing,
    totals,
  };
}

// CSV export

export function toCsv(rows: ReportSessionRow[]): string {
  const headers = [
    "Session ID",
    "Business Date",
    "Office ID",
    "Office Name",
    "Teller ID",
    "Teller Name",
    "Cashier ID",
    "Cashier Name",
    "Status",
    "Closed/Verified",
    "Overdue Unclosed",
    "Currency",
    "Opening Float",
    "Cash In",
    "Cash Out",
    "Expected Balance",
    "Declared Amount",
    "Counted Amount",
    "Difference",
    "Closure Initiated By",
    "Closure Initiated At",
    "Closed By",
    "Closed At",
    "Variance Type",
    "Variance Amount",
    "Variance Status",
    "Variance Resolution",
  ];

  function escapeCsvField(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }

    // For numeric values, return as-is without neutralizing
    if (typeof value === "number") {
      return value.toString();
    }

    let str: string;
    if (value instanceof Date) {
      str = value.toISOString();
    } else {
      str = String(value);
    }

    // Neutralize formula injection for strings: prefix =, +, -, @ with single quote
    if (str.match(/^[=+\-@\t\r]/)) {
      str = "'" + str;
    }

    // RFC 4180: quote if contains comma, quote, newline, or carriage return
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }

    return str;
  }

  const csvLines = [headers.map(escapeCsvField).join(",")];

  for (const row of rows) {
    const values = [
      row.sessionId,
      row.businessDate,
      row.officeId,
      row.officeName,
      row.tellerId,
      row.tellerName,
      row.cashierId,
      row.cashierName,
      row.status,
      row.closedState,
      row.isOverdueUnclosed,
      row.currency,
      row.openingFloat,
      row.cashIn,
      row.cashOut,
      row.expectedBalance,
      row.declaredAmount,
      row.countedAmount,
      row.difference,
      row.closureInitiatedBy,
      row.closureInitiatedAt,
      row.closedBy,
      row.closedAt,
      row.variance?.type,
      row.variance?.amount,
      row.variance?.status,
      row.variance?.resolutionType,
    ];
    csvLines.push(values.map(escapeCsvField).join(","));
  }

  return csvLines.join("\n");
}
