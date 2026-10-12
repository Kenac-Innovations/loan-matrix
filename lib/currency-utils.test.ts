import assert from "node:assert/strict";
import test from "node:test";

import { parseOrgCurrencyForWrite } from "./currency-contract";

test("normalizes selected ZMK to display ZMW while preserving the raw code", () => {
  assert.deepEqual(
    parseOrgCurrencyForWrite({
      selectedCurrencyOptions: [{ code: " zmk " }],
    }),
    { rawCode: "ZMK", displayCode: "ZMW" },
  );
});

test("rejects an empty selected currency", () => {
  assert.throws(
    () => parseOrgCurrencyForWrite({ selectedCurrencyOptions: [] }),
    /no selected organization currency/,
  );
});

test("rejects a malformed selected currency", () => {
  assert.throws(
    () => parseOrgCurrencyForWrite({ selectedCurrencyOptions: [{ code: "" }] }),
    /malformed selected organization currency/,
  );
});
