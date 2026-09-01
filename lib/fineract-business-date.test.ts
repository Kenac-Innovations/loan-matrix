import assert from "node:assert/strict";
import test from "node:test";

import { formatFineractBusinessDate } from "./fineract-business-date";

test("preserves a Harare loan calendar day when the server runs in UTC", () => {
  // 01 Sep 2026 at midnight in Harare is 31 Aug 2026 22:00 UTC.
  assert.equal(
    formatFineractBusinessDate("2026-08-31T22:00:00.000Z"),
    "01 September 2026",
  );
});

test("keeps ordinary Fineract calendar dates unchanged", () => {
  assert.equal(
    formatFineractBusinessDate("2026-09-01T04:57:00.000Z"),
    "01 September 2026",
  );
});

test("does not turn an invalid stored date into a different loan date", () => {
  assert.equal(formatFineractBusinessDate("not-a-date"), null);
});
