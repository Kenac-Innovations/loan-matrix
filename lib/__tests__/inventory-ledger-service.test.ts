import assert from "node:assert/strict";
import test from "node:test";

import {
  InventoryLedgerServiceError,
  issueReservedInventory,
  receiveInventory,
  reserveInventory,
} from "../inventory/inventory-ledger-service";

type RecordMap = Map<string, Record<string, unknown>>;

function makeTable(initial: Record<string, unknown>[] = []) {
  const rows: RecordMap = new Map(initial.map((row) => [String(row.id), { ...row }]));

  const matches = (row: Record<string, unknown>, where?: Record<string, unknown>): boolean => {
    if (!where) return true;

    return Object.entries(where).every(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        if ("not" in value) {
          return row[key] !== (value as { not: unknown }).not;
        }
      }

      return row[key] === value;
    });
  };

  return {
    rows,
    findFirst: async ({ where }: { where?: Record<string, unknown> } = {}) => {
      return Array.from(rows.values()).find((row) => matches(row, where)) ?? null;
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const id = String(data.id ?? `${rows.size + 1}`);
      const row = { id, ...data };
      rows.set(id, row);
      return row;
    },
    update: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => {
      const row = Array.from(rows.values()).find((candidate) => matches(candidate, where));
      if (!row) throw new Error("Record to update not found");
      Object.assign(row, data);
      return row;
    },
  };
}

function makePrismaTestDouble(): any {
  const inventoryItem = makeTable([
    {
      id: "seed-item",
      tenantId: "tenant-arda",
      isActive: true,
    },
  ]);
  const inventoryBalance = makeTable();
  const inventoryMovement = makeTable();
  const stockLoanIssue = makeTable();
  const stockLoanIssueLine = makeTable();
  const stockLoanRepayment = makeTable();

  return {
    inventoryItem,
    inventoryBalance,
    inventoryMovement,
    stockLoanIssue,
    stockLoanIssueLine,
    stockLoanRepayment,
    $transaction: async <T>(callback: (tx: any) => Promise<T>): Promise<T> =>
      callback({
        inventoryItem,
        inventoryBalance,
        inventoryMovement,
        stockLoanIssue,
        stockLoanIssueLine,
        stockLoanRepayment,
      }),
  };
}

test("records a receipt and updates the branch balance in one ledger action", async () => {
  const db = makePrismaTestDouble();

  const result = await receiveInventory(db, {
    tenantId: "tenant-arda",
    inventoryItemId: "seed-item",
    fineractOfficeId: 12,
    quantity: "100",
    value: "2500",
    idempotencyKey: "receipt-seed-item-12-001",
    actorUserId: "user-1",
    actorUserName: "Stock Admin",
    reason: "Opening stock",
  });

  assert.equal(result.balance.quantityOnHand, "100");
  assert.equal(result.balance.quantityReserved, "0");
  assert.equal(result.balance.stockValue, "2500");
  assert.equal(db.inventoryMovement.rows.size, 1);
  assert.equal(
    db.inventoryMovement.rows.get("1")?.type,
    "RECEIPT"
  );
});

test("receiveInventory stores branch name and currency on balances and movements", async () => {
  const db = makePrismaTestDouble();

  const result = await receiveInventory(db, {
    tenantId: "tenant-arda",
    inventoryItemId: "seed-item",
    fineractOfficeId: 12,
    fineractOfficeName: "Head Office",
    currencyCode: "USD",
    quantity: "100",
    value: "2500",
    idempotencyKey: "receipt-branch-currency",
    actorUserId: "user-1",
    actorUserName: "Stock Admin",
    reason: "Opening stock",
  });

  assert.equal(result.idempotentReplay, false);
  assert.equal(result.balance.fineractOfficeName, "Head Office");
  assert.equal(result.balance.currencyCode, "USD");
  assert.equal(db.inventoryMovement.rows.get("1")?.fineractOfficeName, "Head Office");
  assert.equal(db.inventoryMovement.rows.get("1")?.currencyCode, "USD");
});

test("returns the existing result when the same idempotency key is retried", async () => {
  const db = makePrismaTestDouble();

  await receiveInventory(db, {
    tenantId: "tenant-arda",
    inventoryItemId: "seed-item",
    fineractOfficeId: 12,
    quantity: "100",
    value: "2500",
    idempotencyKey: "receipt-seed-item-12-001",
    actorUserId: "user-1",
  });
  const retry = await receiveInventory(db, {
    tenantId: "tenant-arda",
    inventoryItemId: "seed-item",
    fineractOfficeId: 12,
    quantity: "100",
    value: "2500",
    idempotencyKey: "receipt-seed-item-12-001",
    actorUserId: "user-1",
  });

  assert.equal(retry.idempotentReplay, true);
  assert.equal(retry.balance.quantityOnHand, "100");
  assert.equal(db.inventoryMovement.rows.size, 1);
});

test("rejects reservations that exceed available branch stock", async () => {
  const db = makePrismaTestDouble();

  await receiveInventory(db, {
    tenantId: "tenant-arda",
    inventoryItemId: "seed-item",
    fineractOfficeId: 12,
    quantity: "10",
    value: "500",
    idempotencyKey: "receipt-small-stock",
    actorUserId: "user-1",
  });

  await assert.rejects(
    reserveInventory(db, {
      tenantId: "tenant-arda",
      inventoryItemId: "seed-item",
      fineractOfficeId: 12,
      quantity: "11",
      idempotencyKey: "reserve-too-much",
      actorUserId: "user-1",
    }),
    (error: unknown) =>
      error instanceof InventoryLedgerServiceError &&
      error.code === "INSUFFICIENT_STOCK"
  );
});

test("issues previously reserved stock and keeps the movement audit trail", async () => {
  const db = makePrismaTestDouble();

  await receiveInventory(db, {
    tenantId: "tenant-arda",
    inventoryItemId: "seed-item",
    fineractOfficeId: 12,
    quantity: "10",
    value: "500",
    idempotencyKey: "receipt-for-issue",
    actorUserId: "user-1",
  });
  await reserveInventory(db, {
    tenantId: "tenant-arda",
    inventoryItemId: "seed-item",
    fineractOfficeId: 12,
    quantity: "4",
    idempotencyKey: "reserve-for-issue",
    actorUserId: "user-1",
    stockLoanIssueId: "issue-1",
  });

  const result = await issueReservedInventory(db, {
    tenantId: "tenant-arda",
    inventoryItemId: "seed-item",
    fineractOfficeId: 12,
    quantity: "4",
    value: "200",
    idempotencyKey: "issue-stock-1",
    actorUserId: "user-1",
    stockLoanIssueId: "issue-1",
    fineractLoanId: 12345,
  });

  assert.deepEqual(result.balance, {
    id: "1",
    tenantId: "tenant-arda",
    fineractOfficeId: 12,
    fineractOfficeName: undefined,
    inventoryItemId: "seed-item",
    quantityOnHand: "6",
    quantityReserved: "0",
    stockValue: "300",
    currencyCode: "USD",
  });
  assert.equal(db.inventoryMovement.rows.size, 3);
  assert.equal(db.inventoryMovement.rows.get("3")?.fineractLoanId, 12345);
});
