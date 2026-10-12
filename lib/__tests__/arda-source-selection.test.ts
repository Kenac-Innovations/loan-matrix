import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyArdaSourceRecord,
  isArdaSourceProduct,
} from "../arda-source-selection";

test("selects approved ARDA product external identifiers", () => {
  assert.equal(
    isArdaSourceProduct({ externalId: "ARDA-STOCK-MAIZE-SEED-6M" }),
    true,
  );
});

test("selects ARDA-coded inventory records", () => {
  assert.equal(
    classifyArdaSourceRecord({ externalId: "ARDA-INV-MAIZE-10KG" }).kind,
    "automatic",
  );
});

test("excludes ordinary Omama operational records", () => {
  assert.equal(
    classifyArdaSourceRecord({
      externalId: "OM-2026-0001",
      name: "Rutendo Mawere",
    }).kind,
    "excluded",
  );
});

test("does not automatically select free-text ARDA references", () => {
  assert.equal(
    classifyArdaSourceRecord({
      name: "ARDA discussion follow-up",
    }).kind,
    "review",
  );
});

test("marks explicitly tagged ARDA test records for review", () => {
  assert.equal(
    classifyArdaSourceRecord({
      externalId: "TEST-CLIENT-004",
      tags: ["ARDA_TEST"],
    }).kind,
    "review",
  );
});
