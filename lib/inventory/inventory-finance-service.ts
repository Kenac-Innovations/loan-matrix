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

function quantity(value: Prisma.Decimal) {
  return value.toFixed(3);
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
  const receivedStockQuantity = sumDecimals(
    movements.filter((movement) =>
      ["RECEIPT", "ADJUSTMENT_IN", "TRANSFER_IN"].includes(String(movement.type))
    ),
    "quantityDelta"
  );
  const issuedStockQuantity = sumDecimals(
    movements.filter((movement) => String(movement.type) === "ISSUE"),
    "quantityDelta"
  ).abs();
  const currentStockValue = sumDecimals(balances, "stockValue");

  const issuedCostByIssueId = new Map<string, Prisma.Decimal>();
  for (const movement of allMovements) {
    if (String(movement.type) !== "ISSUE" || !movement.stockLoanIssueId) continue;

    const issueId = String(movement.stockLoanIssueId);
    const existingCost = issuedCostByIssueId.get(issueId) ?? new Prisma.Decimal(0);
    issuedCostByIssueId.set(
      issueId,
      existingCost.plus(decimalString(movement.valueDelta)).abs()
    );
  }

  // Repayments are financial activity, so report them by payment date rather
  // than by the date the original stock issue was created.
  const repaymentsCollected = sumDecimals(repayments, "amount");
  const totalIssuedForRecovery = sumDecimals(issues, "totalValue");
  const stockCostIssued = issuedStockValue;
  const outstandingRecoveryValue = issues.reduce((total, issue) => {
    const disbursedValue = new Prisma.Decimal(decimalString(issue.totalValue));
    return total.plus(disbursedValue.minus(repaymentTotal(issue)));
  }, new Prisma.Decimal(0));
  const realisedGrossProfit = repaymentsCollected.minus(stockCostIssued);
  const expectedGrossProfit = totalIssuedForRecovery.minus(stockCostIssued);
  const totalRecoveredForIssues = issues.reduce(
    (total, issue) => total.plus(repaymentTotal(issue)),
    new Prisma.Decimal(0)
  );
  const collectionRate = totalIssuedForRecovery.eq(0)
    ? new Prisma.Decimal(0)
    : totalRecoveredForIssues.div(totalIssuedForRecovery).mul(100);
  // Current stock is a live position. Reconcile it against all historical
  // movements, not only the date-filtered activity shown on the other cards.
  const expectedStockValue = sumDecimals(allMovements, "valueDelta");
  const reconciliationDifference = currentStockValue.minus(expectedStockValue);

  const issueRows = issues
    .map((issue) => {
      const totalValue = new Prisma.Decimal(decimalString(issue.totalValue));
      const totalPaid = repaymentTotal(issue);
      const outstandingBalance = totalValue.minus(totalPaid);
      const stockCost = issuedCostByIssueId.get(String(issue.id)) ?? totalValue;

      return {
        id: String(issue.id),
        borrowerName: String(issue.borrowerName ?? "Unknown borrower"),
        loanAccountNo: String(issue.loanAccountNo ?? ""),
        fineractOfficeName: String(issue.fineractOfficeName ?? ""),
        currencyCode: String(issue.currencyCode ?? currencyCode),
        status: String(issue.status ?? "ISSUED"),
        totalValue: money(totalValue),
        stockCost: money(stockCost),
        disbursedValue: money(totalValue),
        totalPaid: money(totalPaid),
        outstandingBalance: money(outstandingBalance),
        realisedGrossProfit: money(totalPaid.minus(stockCost)),
        expectedGrossProfit: money(totalValue.minus(stockCost)),
        issuedAt: issue.issuedAt instanceof Date ? issue.issuedAt.toISOString() : issue.issuedAt,
      };
    });

  const openIssues = issueRows.filter((issue) =>
    new Prisma.Decimal(issue.outstandingBalance).gt(0)
  );

  return {
    currencyCode,
    receivedStockValue: money(receivedStockValue),
    issuedStockValue: money(issuedStockValue),
    receivedStockQuantity: quantity(receivedStockQuantity),
    issuedStockQuantity: quantity(issuedStockQuantity),
    stockCostIssued: money(stockCostIssued),
    disbursedStockValue: money(totalIssuedForRecovery),
    currentStockValue: money(currentStockValue),
    repaymentsCollected: money(repaymentsCollected),
    outstandingRecoveryValue: money(outstandingRecoveryValue),
    realisedGrossProfit: money(realisedGrossProfit),
    expectedGrossProfit: money(expectedGrossProfit),
    collectionRate: money(collectionRate),
    reconciliationDifference: money(reconciliationDifference),
    issues: issueRows,
    openIssues,
  };
}
