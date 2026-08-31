import { test } from "node:test";
import assert from "node:assert/strict";

import { parseInventoryFinanceDate } from "../inventory/inventory-finance-date-range";

test("inventory finance date filters include the complete selected end day", () => {
  assert.equal(
    parseInventoryFinanceDate("2026-08-19", "start")?.toISOString(),
    "2026-08-19T00:00:00.000Z"
  );
  assert.equal(
    parseInventoryFinanceDate("2026-08-19", "end")?.toISOString(),
    "2026-08-19T23:59:59.999Z"
  );
});
