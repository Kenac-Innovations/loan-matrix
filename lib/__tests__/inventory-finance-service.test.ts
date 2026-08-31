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
