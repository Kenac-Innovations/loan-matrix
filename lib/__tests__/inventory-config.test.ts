import { test } from "node:test";
import assert from "node:assert/strict";

import {
  INVENTORY_CURRENCIES,
  INVENTORY_UNITS,
  normalizeInventoryBranches,
} from "../inventory/inventory-config";

test("inventory config exposes beginner-friendly unit and currency dropdowns", () => {
  assert.deepEqual(
    INVENTORY_UNITS.map((unit) => unit.value),
    ["bag", "kg", "tonne", "litre", "box", "unit"]
  );
  assert.deepEqual(
    INVENTORY_CURRENCIES.map((currency) => currency.value),
    ["USD", "ZMW", "ZWL"]
  );
});

test("inventory config normalizes Fineract office responses into branch options", () => {
  const branches = normalizeInventoryBranches([
    { id: 1, name: "Head Office" },
    { id: 2, name: "Mutare" },
    { id: null, name: "Broken Office" },
  ]);

  assert.deepEqual(branches, [
    { id: 1, name: "Head Office" },
    { id: 2, name: "Mutare" },
  ]);
});
