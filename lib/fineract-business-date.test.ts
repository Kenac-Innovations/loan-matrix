import assert from "node:assert/strict";
import test from "node:test";

import {
  formatFineractBusinessDate,
  getFineractBusinessToday,
  isFineractBusinessDateAfter,
  normalizeFineractSubmittedOnDate,
} from "./fineract-business-date";

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

test("uses today's Harare calendar date after the UTC-day crossover", () => {
  const currentBusinessDay = getFineractBusinessToday(
    new Date("2026-09-03T22:30:00.000Z"),
  );

  assert.equal(
    formatFineractBusinessDate(currentBusinessDay),
    "04 September 2026",
  );
});

test("does not turn an invalid stored date into a different loan date", () => {
  assert.equal(formatFineractBusinessDate("not-a-date"), null);
});

test("compares submitted and expected-disbursement calendar days in Harare", () => {
  assert.equal(
    isFineractBusinessDateAfter(
      "2026-09-03T00:00:00.000Z",
      "2026-09-01T22:00:00.000Z",
    ),
    true,
  );
  assert.equal(
    isFineractBusinessDateAfter(
      "2026-09-01T22:00:00.000Z",
      "2026-09-03T00:00:00.000Z",
    ),
    false,
  );
});

test("normalizes a stale submitted date to its expected disbursement date", () => {
  assert.equal(
    normalizeFineractSubmittedOnDate(
      "2026-09-03T09:00:00.000Z",
      "2026-09-01T22:00:00.000Z",
      "2026-09-01T22:00:00.000Z",
    ),
    "2026-09-01T22:00:00.000Z",
  );
});

test("caps a future submitted date at the template business date", () => {
  assert.equal(
    normalizeFineractSubmittedOnDate(
      "2026-09-03T09:00:00.000Z",
      "2026-09-03T22:00:00.000Z",
      "2026-09-01T22:00:00.000Z",
    ),
    "2026-09-01T22:00:00.000Z",
  );
});

test("keeps a valid submitted date unchanged", () => {
  assert.equal(
    normalizeFineractSubmittedOnDate(
      "2026-09-01T22:00:00.000Z",
      "2026-09-03T22:00:00.000Z",
    ),
    "2026-09-01T22:00:00.000Z",
  );
});
