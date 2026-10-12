import assert from "node:assert/strict";
import test from "node:test";

import { getJournalEntriesData } from "../journalentries-route";

test("getJournalEntriesData forwards generic search filters to Fineract", async () => {
  const request = new Request(
    "https://example.com/api/fineract/journalentries?offset=0&limit=50&fromDate=01+August+2026&toDate=16+August+2026&dateFormat=dd+MMMM+yyyy&locale=en"
  );

  const payload = {
    totalFilteredRecords: 1,
    pageItems: [],
  };

  let requestedEndpoint = "";

  const result = await getJournalEntriesData(request, async (endpoint) => {
    requestedEndpoint = endpoint;
    return payload;
  });

  assert.equal(
    requestedEndpoint,
    "/journalentries?offset=0&limit=50&fromDate=01+August+2026&toDate=16+August+2026&dateFormat=dd+MMMM+yyyy&locale=en"
  );
  assert.deepEqual(result, payload);
});
