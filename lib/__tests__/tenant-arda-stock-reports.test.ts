import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_FEATURES } from "@/shared/types/tenant";
import { isArdaStockReportsEnabled } from "@/lib/tenant-arda-stock-reports";

test("enables ARDA stock reports only for the ARDA tenant with an explicit true flag", () => {
  assert.equal(
    isArdaStockReportsEnabled({
      tenantSlug: "arda",
      tenantSettings: { features: { ardaStockReports: true } },
    }),
    true
  );
});

test("keeps ARDA stock reports disabled when the database flag is absent or false", () => {
  assert.equal(isArdaStockReportsEnabled({ tenantSlug: "arda" }), false);
  assert.equal(
    isArdaStockReportsEnabled({ tenantSlug: "arda", tenantSettings: {} }),
    false
  );
  assert.equal(
    isArdaStockReportsEnabled({
      tenantSlug: "arda",
      tenantSettings: { features: { ardaStockReports: false } },
    }),
    false
  );
});

test("rejects truthy non-boolean flags and non-ARDA tenants", () => {
  assert.equal(
    isArdaStockReportsEnabled({
      tenantSlug: "arda",
      tenantSettings: { features: { ardaStockReports: "true" } },
    }),
    false
  );
  assert.equal(
    isArdaStockReportsEnabled({
      tenantSlug: "goodfellow",
      tenantSettings: { features: { ardaStockReports: true } },
    }),
    false
  );
});

test("defaults the ARDA stock reports feature to disabled", () => {
  assert.equal(DEFAULT_FEATURES.ardaStockReports, false);
});
