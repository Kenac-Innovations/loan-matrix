import test from "node:test";
import assert from "node:assert/strict";
import {
  inventoryReportQuery,
  formatInventoryReportCell,
} from "../inventory/inventory-report-view-model";
test("current position reports do not send misleading activity dates", () => {
  const p = inventoryReportQuery({
    kind: "availability",
    currencyCode: "USD",
    page: 1,
    pageSize: 50,
    startDate: "2026-01-01",
  });
  assert.equal(p.has("startDate"), false);
  assert.equal(
    inventoryReportQuery({
      kind: "movements",
      currencyCode: "USD",
      page: 1,
      pageSize: 50,
      startDate: "2026-01-01",
    }).get("startDate"),
    "2026-01-01",
  );
});
test("decimal formatting preserves precision and missing values remain explicit", () => {
  assert.equal(
    formatInventoryReportCell("123456789012345.670", "decimal"),
    "123456789012345.670",
  );
  assert.equal(formatInventoryReportCell(null, "text"), "Not captured");
  assert.equal(
    formatInventoryReportCell("2026-10-13T00:00:00.000Z", "date"),
    "2026-10-13 00:00 UTC",
  );
});
