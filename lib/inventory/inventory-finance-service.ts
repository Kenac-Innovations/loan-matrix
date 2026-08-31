import { Prisma } from "@/app/generated/prisma";

type FinanceDb = {
  inventoryMovement: {
    findMany(args?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  };
  inventoryBalance: {
    findMany(args?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  };
  stockLoanIssue: {
    findMany(args?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  };
  stockLoanRepayment: {
    findMany(args?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  };
};

type FinanceSummaryRequest = {
  tenantId: string;
  currencyCode?: string;
  startDate?: Date;
  endDate?: Date;
};

function decimalString(value: unknown) {
  if (value instanceof Prisma.Decimal) return value.toString();
  return String(value ?? "0");
}

function money(value: Prisma.Decimal) {
  return value.toFixed(2);
}

function sumDecimals(records: Record<string, unknown>[], key: string) {
  return records.reduce((total, record) => {
    return total.plus(decimalString(record[key]));
  }, new Prisma.Decimal(0));
}

function repaymentTotal(issue: Record<string, unknown>) {
  const repayments = issue.repayments;
  if (!Array.isArray(repayments)) return new Prisma.Decimal(0);

  return repayments.reduce((total, repayment) => {
    return total.plus(decimalString((repayment as Record<string, unknown>).amount));
  }, new Prisma.Decimal(0));
}

function dateRangeWhere(startDate?: Date, endDate?: Date) {
  if (!startDate && !endDate) return undefined;

  return {
    ...(startDate ? { gte: startDate } : {}),
    ...(endDate ? { lte: endDate } : {}),
  };
}

export async function getInventoryFinanceSummary(
  db: FinanceDb,
  request: FinanceSummaryRequest
) {
  const currencyCode = (request.currencyCode ?? "USD").toUpperCase();
  const createdAt = dateRangeWhere(request.startDate, request.endDate);
  const issuedAt = dateRangeWhere(request.startDate, request.endDate);

  const [movements, allMovements, balances, issues, repayments] = await Promise.all([
    db.inventoryMovement.findMany({
      where: {
        tenantId: request.tenantId,
        currencyCode,
        ...(createdAt ? { createdAt } : {}),
      },
    }),
    db.inventoryMovement.findMany({
      where: {
        tenantId: request.tenantId,
        currencyCode,
      },
    }),
    db.inventoryBalance.findMany({
      where: {
        tenantId: request.tenantId,
        currencyCode,
      },
    }),
    db.stockLoanIssue.findMany({
      where: {
        tenantId: request.tenantId,
        currencyCode,
        ...(issuedAt ? { issuedAt } : {}),
      },
      include: {
        repayments: true,
      },
      orderBy: { issuedAt: "desc" },
    }),
    db.stockLoanRepayment.findMany({
      where: {
        tenantId: request.tenantId,
        currencyCode,
        ...(createdAt ? { paymentDate: createdAt } : {}),
      },
    }),
  ]);

  const receivedStockValue = sumDecimals(
    movements.filter((movement) =>
      ["RECEIPT", "ADJUSTMENT_IN", "TRANSFER_IN"].includes(String(movement.type))
    ),
    "valueDelta"
  );
  const issuedStockValue = sumDecimals(
    movements.filter((movement) => String(movement.type) === "ISSUE"),
    "valueDelta"
  ).abs();
  const currentStockValue = sumDecimals(balances, "stockValue");

  // Repayments are financial activity, so report them by payment date rather
  // than by the date the original stock issue was created.
  const repaymentsCollected = sumDecimals(repayments, "amount");
  const totalIssuedForRecovery = sumDecimals(issues, "totalValue");
  const outstandingRecoveryValue = totalIssuedForRecovery.minus(repaymentsCollected);
  // Current stock is a live position. Reconcile it against all historical
  // movements, not only the date-filtered activity shown on the other cards.
  const expectedStockValue = sumDecimals(allMovements, "valueDelta");
  const reconciliationDifference = currentStockValue.minus(expectedStockValue);

  const openIssues = issues
    .map((issue) => {
      const totalValue = new Prisma.Decimal(decimalString(issue.totalValue));
      const totalPaid = repaymentTotal(issue);
      const outstandingBalance = totalValue.minus(totalPaid);

      return {
        id: String(issue.id),
        borrowerName: String(issue.borrowerName ?? "Unknown borrower"),
        loanAccountNo: String(issue.loanAccountNo ?? ""),
        fineractOfficeName: String(issue.fineractOfficeName ?? ""),
        currencyCode: String(issue.currencyCode ?? currencyCode),
        status: String(issue.status ?? "ISSUED"),
        totalValue: money(totalValue),
        totalPaid: money(totalPaid),
        outstandingBalance: money(outstandingBalance),
        issuedAt: issue.issuedAt instanceof Date ? issue.issuedAt.toISOString() : issue.issuedAt,
      };
    })
    .filter((issue) => new Prisma.Decimal(issue.outstandingBalance).gt(0));

  return {
    currencyCode,
    receivedStockValue: money(receivedStockValue),
    issuedStockValue: money(issuedStockValue),
    currentStockValue: money(currentStockValue),
    repaymentsCollected: money(repaymentsCollected),
    outstandingRecoveryValue: money(outstandingRecoveryValue),
    reconciliationDifference: money(reconciliationDifference),
    openIssues,
  };
}
