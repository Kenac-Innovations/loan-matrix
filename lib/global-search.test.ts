import assert from "node:assert/strict";
import test from "node:test";
import {
  limitSearchResults,
  normalizeSearchResults,
  MAX_SEARCH_RESULTS,
  SEARCH_RESOURCES,
} from "./global-search";

test("maps client hits to client rows", () => {
  const results = normalizeSearchResults([
    {
      entityId: 7,
      entityAccountNo: "000000007",
      entityExternalId: "EXT-7",
      entityName: "Mary Moyo",
      entityType: "CLIENT",
      entityStatus: { value: "Active", code: "clientStatusType.active" },
    },
  ]);

  assert.deepEqual(results, [
    {
      id: 7,
      type: "client",
      name: "Mary Moyo",
      accountNo: "000000007",
      externalId: "EXT-7",
      clientId: 7,
      clientName: null,
      status: "Active",
      href: "/clients/7",
    },
  ]);
});

test("loan href uses parentId as the client id", () => {
  const results = normalizeSearchResults([
    {
      entityId: 42,
      entityAccountNo: "000000042",
      entityName: "Agri loan",
      entityType: "LOAN",
      parentId: 7,
      parentName: "Mary Moyo",
      entityStatus: { value: "Active" },
    },
  ]);

  assert.equal(results.length, 1);
  assert.equal(results[0].type, "loan");
  assert.equal(results[0].id, 42);
  assert.equal(results[0].clientId, 7);
  assert.equal(results[0].clientName, "Mary Moyo");
  assert.equal(results[0].status, "Active");
  assert.equal(results[0].href, "/clients/7/loans/42");
});

test("savings hits link to the savings detail page", () => {
  const results = normalizeSearchResults([
    { entityId: 3, entityType: "SAVING", parentId: 9, parentName: "John" },
  ]);

  assert.equal(results[0].type, "savings");
  assert.equal(results[0].href, "/clients/9/savings/3");
});

test("clientIdentifier hits dedupe against direct client hits", () => {
  const results = normalizeSearchResults([
    {
      entityId: 55,
      entityName: "NRC-123",
      entityType: "CLIENTIDENTIFIER",
      parentId: 7,
      parentName: "Mary Moyo",
    },
    {
      entityId: 7,
      entityAccountNo: "000000007",
      entityName: "Mary Moyo",
      entityType: "CLIENT",
      entityStatus: { value: "Active" },
    },
  ]);

  assert.equal(results.length, 1);
  assert.equal(results[0].type, "client");
  assert.equal(results[0].id, 7);
  assert.equal(results[0].accountNo, "000000007");
  assert.equal(results[0].status, "Active");
  assert.equal(results[0].href, "/clients/7");
});

test("clientIdentifier hits without a direct client hit become client rows", () => {
  const results = normalizeSearchResults([
    {
      entityId: 55,
      entityName: "NRC-123",
      entityType: "CLIENTIDENTIFIER",
      parentId: 7,
      parentName: "Mary Moyo",
    },
    {
      entityId: 8,
      entityName: "John",
      entityType: "CLIENTIDENTIFIER",
      parentId: 7,
      parentName: "Mary Moyo",
    },
  ]);

  assert.deepEqual(results, [
    {
      id: 7,
      type: "client",
      name: "Mary Moyo",
      accountNo: null,
      externalId: null,
      clientId: 7,
      clientName: null,
      status: null,
      href: "/clients/7",
    },
  ]);
});

test("unsupported entity types are dropped", () => {
  const results = normalizeSearchResults([
    { entityId: 1, entityName: "Grp", entityType: "GROUP" },
    { entityId: 2, entityName: "Ctr", entityType: "CENTER" },
    { entityId: 3, entityName: "Share", entityType: "SHARES" },
    { entityId: 4, entityName: "Mystery", entityType: "SOMETHING_NEW" },
    { entityId: 5, entityName: "No type" },
  ]);

  assert.deepEqual(results, []);
});

test("loan and savings without a parent client are dropped", () => {
  const results = normalizeSearchResults([
    { entityId: 10, entityName: "Orphan", entityType: "LOAN" },
    { entityId: 11, entityName: "Orphan", entityType: "SAVING", parentId: null },
  ]);

  assert.deepEqual(results, []);
});

test("accepts the pageItems response shape", () => {
  const results = normalizeSearchResults({
    pageItems: [
      { entityId: 7, entityName: "Mary Moyo", entityType: "CLIENT" },
      { entityId: 42, entityName: "Agri", entityType: "LOAN", parentId: 7 },
    ],
  });

  assert.equal(results.length, 2);
  assert.equal(results[0].href, "/clients/7");
  assert.equal(results[1].href, "/clients/7/loans/42");
});

test("returns empty results for unexpected payloads", () => {
  assert.deepEqual(normalizeSearchResults(null), []);
  assert.deepEqual(normalizeSearchResults({ foo: "bar" }), []);
  assert.deepEqual(normalizeSearchResults("oops"), []);
});

test("dedupes loans and savings by type and id", () => {
  const results = normalizeSearchResults([
    { entityId: 42, entityType: "LOAN", parentId: 7 },
    { entityId: 42, entityType: "SAVING", parentId: 7 },
    { entityId: 42, entityType: "LOAN", parentId: 7 },
  ]);

  assert.deepEqual(
    results.map((r) => r.type),
    ["loan", "savings"]
  );
});

test("limitSearchResults caps at the maximum and flags truncation", () => {
  const many = Array.from({ length: MAX_SEARCH_RESULTS + 5 }, (_, i) => ({
    entityId: i + 1,
    entityType: "CLIENT",
  }));
  const capped = limitSearchResults(normalizeSearchResults(many));

  assert.equal(capped.results.length, MAX_SEARCH_RESULTS);
  assert.equal(capped.truncated, true);

  const small = limitSearchResults(normalizeSearchResults(many.slice(0, 3)));
  assert.equal(small.results.length, 3);
  assert.equal(small.truncated, false);
});

test("search resource map excludes groups and centers", () => {
  assert.equal(SEARCH_RESOURCES.all, "clients,clientIdentifiers,loans,savings");
  assert.equal(SEARCH_RESOURCES.clients, "clients,clientIdentifiers");
  assert.equal(SEARCH_RESOURCES.loans, "loans");
  assert.equal(SEARCH_RESOURCES.savings, "savings");
});
