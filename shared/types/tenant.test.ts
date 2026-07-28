import assert from "node:assert/strict";
import { DEFAULT_FEATURES, getTenantFeatures } from "./tenant";

function run() {
  assert.deepEqual(
    getTenantFeatures(null),
    DEFAULT_FEATURES,
    "returns defaults when tenant is null"
  );

  assert.deepEqual(
    getTenantFeatures({ settings: null }),
    DEFAULT_FEATURES,
    "returns defaults when tenant has no settings"
  );

  assert.deepEqual(
    getTenantFeatures({ settings: {} }),
    DEFAULT_FEATURES,
    "returns defaults when settings has no features"
  );

  assert.deepEqual(
    getTenantFeatures({ settings: { features: { receiptRanges: true } } }),
    { ...DEFAULT_FEATURES, receiptRanges: true },
    "merges stored features over defaults"
  );

  assert.equal(
    getTenantFeatures({
      settings: { features: { autoResolveRepaymentCashier: true } },
    }).autoResolveRepaymentCashier,
    true,
    "surfaces the new autoResolveRepaymentCashier flag when set"
  );

  assert.equal(
    getTenantFeatures(null).autoResolveRepaymentCashier,
    false,
    "autoResolveRepaymentCashier defaults to false"
  );
}

run();
console.log("ok");
