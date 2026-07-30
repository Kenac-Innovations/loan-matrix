import assert from "node:assert/strict";
import test from "node:test";

import { enrichDisbursalReportWithPayoutAttribution } from "./report-payout-attribution";

test("uses the linked cashier name for a disbursal row", () => {
  const report = {
    columnHeaders: [
      { columnName: "Loan ID" },
      { columnName: "Cashier / Recorded By" },
    ],
    data: [{ row: [101, "App Administrator"] }],
  };

  const result = enrichDisbursalReportWithPayoutAttribution(report, new Map([
    [101, { cashierName: "MUTALE, CHALWE", paidByName: "ELIAH NYIRENDA" }],
  ]));

  assert.ok(result.data);
  assert.equal(result.data[0].row[1], "MUTALE, CHALWE");
});

test("uses the Loan Matrix payout user when no cashier is linked", () => {
  const report = {
    columnHeaders: [
      { columnName: "Loan ID" },
      { columnName: "Cashier / Recorded By" },
    ],
    data: [{ row: [102, "App Administrator"] }],
  };

  const result = enrichDisbursalReportWithPayoutAttribution(report, new Map([
    [102, { cashierName: null, paidByName: "ROSEMARY HANYUKA" }],
  ]));

  assert.ok(result.data);
  assert.equal(result.data[0].row[1], "ROSEMARY HANYUKA");
});

test("keeps the Fineract value when no Loan Matrix payout matches the loan", () => {
  const report = {
    columnHeaders: [
      { columnName: "Loan ID" },
      { columnName: "Cashier / Recorded By" },
    ],
    data: [{ row: [103, "App Administrator"] }],
  };

  const result = enrichDisbursalReportWithPayoutAttribution(report, new Map());

  assert.ok(result.data);
  assert.equal(result.data[0].row[1], "App Administrator");
});
