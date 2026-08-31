import assert from "node:assert/strict";
import test from "node:test";
import {
  ArdaFineractProvisionOptionsError,
  parseArdaFineractProvisionOptions,
} from "@/lib/arda-fineract-provision-options";

test("uses the isolated ARDA defaults in dry-run mode", () => {
  assert.deepEqual(parseArdaFineractProvisionOptions([]), {
      apply: false,
      fineractImage: "ghcr.io/kenac-innovations/fineract-1.11.0:dev-e9d62dd",
      namespace: "fineract",
      registryDatabase: "fineract_tenants",
      setupDatabase: "fineract_tenants_arda_setup",
      targetDatabase: "fineract_tenant_arda",
  });
});

test("requires explicit apply mode before it can create databases", () => {
  assert.equal(parseArdaFineractProvisionOptions(["--apply"]).apply, true);
});

test("rejects unsafe database identifiers", () => {
  assert.throws(
    () =>
      parseArdaFineractProvisionOptions(["--target-database=fineract;drop"]),
    ArdaFineractProvisionOptionsError,
  );
});
