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

  assert.equal(
    getTenantFeatures(null).hasInventoryFinance,
    false,
    "inventory finance defaults to disabled for every tenant"
  );

  assert.equal(
    getTenantFeatures({
      settings: { features: { hasInventoryFinance: true } },
    }).hasInventoryFinance,
    true,
    "surfaces the database-backed inventory finance setting when enabled"
  );
}

run();
console.log("ok");
