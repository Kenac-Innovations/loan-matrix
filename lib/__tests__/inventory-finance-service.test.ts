import { test } from "node:test";
import assert from "node:assert/strict";

import { Prisma } from "@/app/generated/prisma";

import { getInventoryFinanceSummary } from "../inventory/inventory-finance-service";

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

test("getInventoryFinanceSummary reconciles stock issues and money repayments", async () => {
  const db = {
    inventoryMovement: {
      findMany: async () => [
        { type: "RECEIPT", valueDelta: decimal("1000.00") },
        { type: "ISSUE", valueDelta: decimal("-300.00") },
      ],
    },
    inventoryBalance: {
      findMany: async () => [
        { stockValue: decimal("700.00") },
      ],
    },
    stockLoanIssue: {
      findMany: async () => [
        {
          id: "issue-1",
          borrowerName: "ARDA Farmer One",
          fineractOfficeName: "Head Office",
          totalValue: decimal("300.00"),
          currencyCode: "USD",
          status: "ISSUED",
          repayments: [
            { amount: decimal("125.00") },
          ],
        },
      ],
    },
    stockLoanRepayment: {
      findMany: async () => [
        { amount: decimal("125.00") },
      ],
    },
  };

  const result = await getInventoryFinanceSummary(db as never, {
    tenantId: "tenant-1",
    currencyCode: "USD",
  });

  assert.equal(result.receivedStockValue, "1000.00");
  assert.equal(result.issuedStockValue, "300.00");
  assert.equal(result.currentStockValue, "700.00");
  assert.equal(result.repaymentsCollected, "125.00");
  assert.equal(result.outstandingRecoveryValue, "175.00");
  assert.equal(result.reconciliationDifference, "0.00");
  assert.equal(result.openIssues[0].outstandingBalance, "175.00");
});

test("getInventoryFinanceSummary gives finance the issued cost, recovery, and profit view", async () => {
  const db = {
    inventoryMovement: {
      findMany: async () => [
        { type: "RECEIPT", quantityDelta: decimal("20"), valueDelta: decimal("800.00") },
        {
          type: "ISSUE",
          stockLoanIssueId: "issue-1",
          quantityDelta: decimal("-5"),
          valueDelta: decimal("-250.00"),
        },
      ],
    },
    inventoryBalance: {
      findMany: async () => [{ stockValue: decimal("550.00") }],
    },
    stockLoanIssue: {
      findMany: async () => [
        {
          id: "issue-1",
          borrowerName: "ARDA Farmer One",
          fineractOfficeName: "Head Office",
          totalValue: decimal("325.00"),
          currencyCode: "USD",
          status: "ISSUED",
          repayments: [{ amount: decimal("130.00") }],
        },
      ],
    },
    stockLoanRepayment: {
      findMany: async () => [{ amount: decimal("130.00") }],
    },
  };

  const result = await getInventoryFinanceSummary(db as never, {
    tenantId: "tenant-arda",
    currencyCode: "USD",
  });

  assert.equal(result.receivedStockQuantity, "20.000");
  assert.equal(result.issuedStockQuantity, "5.000");
  assert.equal(result.stockCostIssued, "250.00");
  assert.equal(result.disbursedStockValue, "325.00");
  assert.equal(result.realisedGrossProfit, "-120.00");
  assert.equal(result.expectedGrossProfit, "75.00");
  assert.equal(result.collectionRate, "40.00");
  assert.deepEqual(result.issues[0], {
    id: "issue-1",
    borrowerName: "ARDA Farmer One",
    loanAccountNo: "",
    fineractOfficeName: "Head Office",
    currencyCode: "USD",
    status: "ISSUED",
    stockCost: "250.00",
    totalValue: "325.00",
    disbursedValue: "325.00",
    totalPaid: "130.00",
    outstandingBalance: "195.00",
    realisedGrossProfit: "-120.00",
    expectedGrossProfit: "75.00",
    issuedAt: undefined,
  });
});
