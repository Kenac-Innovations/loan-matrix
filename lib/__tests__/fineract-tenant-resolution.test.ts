import assert from "node:assert/strict";
import test from "node:test";
import {
  FineractTenantResolutionError,
  resolveFineractTenantId,
} from "../fineract-tenant-service";

test("uses ARDA only when the active application tenant is ARDA", () => {
  assert.equal(
    resolveFineractTenantId({
      requestedSlug: "arda",
      resolvedTenantSlug: "arda",
    }),
    "arda",
  );
});

test("does not fall back when the ARDA host has no active ARDA tenant", () => {
  assert.throws(
    () =>
      resolveFineractTenantId({
        requestedSlug: "arda",
        resolvedTenantSlug: null,
        fallbackTenantId: "goodfellow",
      }),
    (error: unknown) => {
      assert.ok(error instanceof FineractTenantResolutionError);
      assert.equal(error.tenantSlug, "arda");
      return true;
    },
  );
});

test("keeps the legacy fallback when no tenant hostname was supplied", () => {
  assert.equal(
    resolveFineractTenantId({
      requestedSlug: "",
      resolvedTenantSlug: null,
      fallbackTenantId: "goodfellow",
    }),
    "goodfellow",
  );
});
