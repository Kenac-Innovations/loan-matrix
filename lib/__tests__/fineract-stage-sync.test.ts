import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

test("maps active Fineract loans to the Disburse pipeline stage", async () => {
  const mod = await import("../fineract-stage-sync.ts");

  assert.equal(mod.getPipelineStageNameForFineractStatus("active"), "Disburse");
  assert.equal(mod.getPipelineStageNameForFineractStatus("closed"), "Disburse");
});

test("maps disburse loan actions to the Disburse pipeline stage", async () => {
  const mod = await import("../fineract-stage-sync.ts");

  assert.equal(mod.getPipelineStageNameForLoanAction("disburse"), "Disburse");
});
