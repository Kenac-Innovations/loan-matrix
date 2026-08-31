import { test } from "node:test";
import assert from "node:assert/strict";

import { Prisma } from "@/app/generated/prisma";

import { recordInventoryRepayment } from "../inventory/inventory-repayment-service";

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

function createRepaymentDbStub(existingRepayment: Record<string, unknown> | null = null) {
  const db: any = {
    createdRepayments: [] as Record<string, unknown>[],
    updatedIssues: [] as Record<string, unknown>[],
    stockLoanIssue: {
      findFirst: async () => ({
        id: "issue-1",
        tenantId: "tenant-1",
        totalValue: decimal("100.00"),
        status: "ISSUED",
        repayments: [
          { amount: decimal("25.00") },
        ],
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        db.updatedIssues.push(data);
        return { id: "issue-1", ...data };
      },
    },
    stockLoanRepayment: {
      findFirst: async () => existingRepayment,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        db.createdRepayments.push(data);
        return { id: "repayment-1", ...data };
      },
    },
    inventoryItem: {},
    inventoryBalance: {},
    inventoryMovement: {},
    stockLoanIssueLine: {},
    $transaction: async <T>(callback: (tx: typeof db) => Promise<T>) => callback(db),
  };

  return db;
}

test("recordInventoryRepayment records money against an issued stock loan", async () => {
  const db = createRepaymentDbStub();

  const result = await recordInventoryRepayment(db as never, {
    tenantId: "tenant-1",
    stockLoanIssueId: "issue-1",
    amount: "75.00",
    currencyCode: "USD",
    paymentDate: new Date("2026-08-14T00:00:00.000Z"),
    reference: "REC-001",
    notes: "Cash collected",
    actorUserId: "user-1",
    actorUserName: "App Administrator",
    idempotencyKey: "repayment-001",
  });

  assert.equal(result.idempotentReplay, false);
  assert.equal(db.createdRepayments[0].amount, "75.00");
  assert.equal(db.createdRepayments[0].currencyCode, "USD");
  assert.equal(db.updatedIssues[0].status, "REPAID");
  assert.equal(result.totalPaid, "100.00");
  assert.equal(result.outstandingBalance, "0.00");
});

test("recordInventoryRepayment prevents payments above the stock issue value", async () => {
  const db = createRepaymentDbStub();

  await assert.rejects(
    () =>
      recordInventoryRepayment(db as never, {
        tenantId: "tenant-1",
        stockLoanIssueId: "issue-1",
        amount: "80.00",
        currencyCode: "USD",
        paymentDate: new Date("2026-08-14T00:00:00.000Z"),
        actorUserId: "user-1",
        idempotencyKey: "repayment-too-high",
      }),
    /greater than the outstanding stock issue value/
  );
});
