import assert from "node:assert/strict";
import test from "node:test";

import {
  InventoryLedgerError,
  applyInventoryMovement,
  type InventoryBalanceSnapshot,
} from "../inventory/inventory-ledger";

const emptyBalance: InventoryBalanceSnapshot = {
  quantityOnHand: "0",
  quantityReserved: "0",
  stockValue: "0",
};

test("receiving stock increases branch quantity and value", () => {
  assert.deepEqual(
    applyInventoryMovement(emptyBalance, {
      type: "RECEIPT",
      quantity: "10",
      value: "2000",
    }),
    {
      quantityOnHand: "10",
      quantityReserved: "0",
      stockValue: "2000",
    }
  );
});

test("reserving stock reduces availability without reducing quantity on hand", () => {
  assert.deepEqual(
    applyInventoryMovement(
      { quantityOnHand: "10", quantityReserved: "0", stockValue: "2000" },
      { type: "RESERVATION", quantity: "4", value: "0" }
    ),
    { quantityOnHand: "10", quantityReserved: "4", stockValue: "2000" }
  );
});

test("issuing reserved stock reduces both on hand and reserved quantity", () => {
  assert.deepEqual(
    applyInventoryMovement(
      { quantityOnHand: "10", quantityReserved: "4", stockValue: "2000" },
      { type: "ISSUE", quantity: "4", value: "800" }
    ),
    { quantityOnHand: "6", quantityReserved: "0", stockValue: "1200" }
  );
});

test("rejects a reservation larger than available branch stock", () => {
  assert.throws(
    () =>
      applyInventoryMovement(
        { quantityOnHand: "10", quantityReserved: "8", stockValue: "2000" },
        { type: "RESERVATION", quantity: "3", value: "0" }
      ),
    (error: unknown) =>
      error instanceof InventoryLedgerError && error.code === "INSUFFICIENT_STOCK"
  );
});

test("rejects an issue that exceeds the existing reservation", () => {
  assert.throws(
    () =>
      applyInventoryMovement(
        { quantityOnHand: "10", quantityReserved: "2", stockValue: "2000" },
        { type: "ISSUE", quantity: "3", value: "600" }
      ),
    (error: unknown) =>
      error instanceof InventoryLedgerError && error.code === "INSUFFICIENT_RESERVATION"
  );
});
