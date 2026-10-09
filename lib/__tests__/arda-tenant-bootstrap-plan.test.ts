import assert from "node:assert/strict";
import test from "node:test";
import {
  ARDA_TENANT_DOMAIN,
  ARDA_TENANT_NAME,
  ARDA_TENANT_SLUG,
  buildArdaTenantBootstrapPlan,
} from "../arda-tenant-bootstrap-plan";

test("builds the fresh ARDA tenant with the operational stock-loan workflow", () => {
  const plan = buildArdaTenantBootstrapPlan();

  assert.deepEqual(plan.tenant, {
    name: ARDA_TENANT_NAME,
    slug: ARDA_TENANT_SLUG,
    domain: ARDA_TENANT_DOMAIN,
  });
  assert.deepEqual(
    plan.stages.map((stage) => stage.name),
    ["New Lead", "Approval", "Disburse", "Rejected"],
  );
  assert.equal(plan.stages[0]?.isInitialState, true);
  assert.equal(plan.stages[1]?.fineractAction, "approve");
  assert.equal(plan.stages[2]?.fineractAction, "disburse");
  assert.equal(plan.stages[3]?.isFinalState, true);
});

test("keeps ARDA's transition graph independent and deterministic", () => {
  const plan = buildArdaTenantBootstrapPlan();

  assert.deepEqual(plan.transitions, {
    "New Lead": ["Approval", "Rejected"],
    Approval: ["Disburse", "Rejected"],
    Disburse: [],
    Rejected: [],
  });
});
