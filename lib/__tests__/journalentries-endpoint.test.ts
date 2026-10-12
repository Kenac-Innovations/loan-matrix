import assert from "node:assert/strict";
import test from "node:test";

import { buildJournalEntriesEndpoint } from "../journalentries-endpoint";

test("buildJournalEntriesEndpoint forwards generic journal search filters", () => {
  const params = new URLSearchParams({
    offset: "0",
    limit: "50",
    fromDate: "01 August 2026",
    toDate: "16 August 2026",
    dateFormat: "dd MMMM yyyy",
    locale: "en",
  });

  const endpoint = buildJournalEntriesEndpoint(params);
  const parsed = new URL(endpoint, "https://example.com");

  assert.equal(parsed.pathname, "/journalentries");
  assert.equal(parsed.searchParams.get("offset"), "0");
  assert.equal(parsed.searchParams.get("limit"), "50");
  assert.equal(parsed.searchParams.get("fromDate"), "01 August 2026");
  assert.equal(parsed.searchParams.get("toDate"), "16 August 2026");
  assert.equal(parsed.searchParams.get("dateFormat"), "dd MMMM yyyy");
  assert.equal(parsed.searchParams.get("locale"), "en");
});

test("buildJournalEntriesEndpoint preserves transaction-specific lookups", () => {
  const params = new URLSearchParams({
    transactionId: "TX-123",
    transactionDetails: "true",
  });

  const endpoint = buildJournalEntriesEndpoint(params);
  const parsed = new URL(endpoint, "https://example.com");

  assert.equal(parsed.pathname, "/journalentries");
  assert.equal(parsed.searchParams.get("transactionId"), "TX-123");
  assert.equal(parsed.searchParams.get("transactionDetails"), "true");
});

test("buildJournalEntriesEndpoint supports an unfiltered journal search", () => {
  assert.equal(buildJournalEntriesEndpoint(new URLSearchParams()), "/journalentries");
});
