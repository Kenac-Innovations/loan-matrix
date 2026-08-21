import { test } from "node:test";
import assert from "node:assert/strict";

import { Prisma } from "@/app/generated/prisma";

import { issueInventoryStock } from "../inventory/inventory-issue-service";

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

function createIssueDbStub() {
  const db: any = {
    createdIssues: [] as Record<string, unknown>[],
    createdLines: [] as Record<string, unknown>[],
    createdMovements: [] as Record<string, unknown>[],
    updatedBalances: [] as Record<string, unknown>[],
    inventoryItem: {
      findFirst: async () => ({ id: "item-1", tenantId: "tenant-1", isActive: true }),
    },
    inventoryBalance: {
      findFirst: async () => ({
        id: "balance-1",
        tenantId: "tenant-1",
        inventoryItemId: "item-1",
        fineractOfficeId: 3,
        fineractOfficeName: "Head Office",
        currencyCode: "USD",
        quantityOnHand: decimal("20"),
        quantityReserved: decimal("0"),
        stockValue: decimal("500"),
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        db.updatedBalances.push(data);
        return { id: "balance-1", ...data };
      },
    },
    inventoryMovement: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        db.createdMovements.push(data);
        return { id: `movement-${db.createdMovements.length}`, ...data };
      },
    },
    stockLoanIssue: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        db.createdIssues.push(data);
        return { id: "issue-1", ...data };
      },
    },
    stockLoanIssueLine: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        db.createdLines.push(data);
        return { id: "line-1", ...data };
      },
    },
    stockLoanRepayment: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => data,
    },
    $transaction: async <T>(callback: (tx: typeof db) => Promise<T>) => callback(db),
  };

  return db;
}

test("issueInventoryStock reduces branch stock and creates a money recovery issue", async () => {
  const db = createIssueDbStub();

  const result = await issueInventoryStock(db as never, {
    tenantId: "tenant-1",
    inventoryItemId: "item-1",
    fineractOfficeId: 3,
    fineractOfficeName: "Head Office",
    quantity: "4",
    unitValue: "25",
    currencyCode: "USD",
    borrowerName: "ARDA Farmer One",
    loanAccountNo: "LN-001",
    externalReference: "ARDA-ISSUE-001",
    actorUserId: "user-1",
    actorUserName: "App Administrator",
    notes: "Seed issued to borrower",
    idempotencyKey: "issue-001",
  });

  assert.equal(result.idempotentReplay, false);
  assert.equal(db.createdIssues[0].totalValue, "100.00");
  assert.equal(db.createdIssues[0].borrowerName, "ARDA Farmer One");
  assert.equal(db.createdLines[0].lineValue, "100.00");
  assert.equal(db.createdMovements[0].type, "RESERVATION");
  assert.equal(db.createdMovements[0].quantityDelta, "4");
  assert.equal(db.createdMovements[0].valueDelta, "0");
  assert.equal(db.createdMovements[1].type, "ISSUE");
  assert.equal(db.createdMovements[1].quantityDelta, "-4");
  assert.equal(db.createdMovements[1].valueDelta, "-100.00");
  assert.equal(db.updatedBalances[0].quantityOnHand, "16");
  assert.equal(db.updatedBalances[0].quantityReserved, "0");
  assert.equal(db.updatedBalances[0].stockValue, "400");
});
