import assert from "node:assert/strict";
import test from "node:test";

import {
  getClientSubmittedOnDate,
  withClientSubmittedOnDate,
} from "./lead-client-submitted-date";

test("stores the client registration date without replacing other lead metadata", () => {
  const metadata = withClientSubmittedOnDate(
    { source: "client-form", firstRepaymentOn: "2026-09-10" },
    new Date("2026-09-04T10:00:00.000Z"),
  );

  assert.deepEqual(metadata, {
    source: "client-form",
    firstRepaymentOn: "2026-09-10",
    clientSubmittedOnDate: "2026-09-04T10:00:00.000Z",
  });
  assert.equal(
    getClientSubmittedOnDate(metadata)?.toISOString(),
    "2026-09-04T10:00:00.000Z",
  );
});

test("does not treat an invalid client registration date as a loan date", () => {
  assert.equal(
    getClientSubmittedOnDate({ clientSubmittedOnDate: "not-a-date" }),
    undefined,
  );
  assert.deepEqual(
    withClientSubmittedOnDate({ source: "client-form" }, new Date("invalid")),
    { source: "client-form" },
  );
});
