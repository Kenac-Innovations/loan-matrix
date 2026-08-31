import assert from "node:assert/strict";
import test from "node:test";
import {
  ARDA_FINERACT_TENANT_IDENTIFIER,
  buildArdaFineractProvisionPlan,
} from "@/lib/arda-fineract-provision-plan";

test("creates only the isolated ARDA databases and registry entry", () => {
  const plan = buildArdaFineractProvisionPlan({
      fineractImage: "example/fineract:exact-build",
      namespace: "fineract",
      registryDatabase: "fineract_tenants",
      setupDatabase: "fineract_tenants_arda_setup",
      targetDatabase: "fineract_tenant_arda",
    });

  assert.equal(plan.tenantIdentifier, ARDA_FINERACT_TENANT_IDENTIFIER);
  assert.deepEqual(plan.databasesToCreate, [
      "fineract_tenant_arda",
      "fineract_tenants_arda_setup",
  ]);
  assert.equal(plan.migrationJob.image, "example/fineract:exact-build");
  assert.equal(
    plan.migrationJob.environment.SPRING_PROFILES_ACTIVE,
    "liquibase-only",
  );
  assert.match(plan.registrySql, /'arda'/);
  assert.match(plan.registrySql, /'fineract_tenant_arda'/);
  assert.match(plan.registrySql, /WHERE t.identifier = 'goodfellow'/);
  assert.doesNotMatch(plan.registrySql, /omama/);
});
