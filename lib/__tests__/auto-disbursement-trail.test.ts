import assert from "node:assert/strict";
import test from "node:test";

test("buildAutoDisbursementTrail returns a readable stage trail", async () => {
  const mod = await import("../auto-disbursement-trail.ts");

  assert.equal(typeof mod.buildAutoDisbursementTrail, "function");

  const trail = mod.buildAutoDisbursementTrail({
    status: "completed",
    triggerStageName: "Loan Initiation",
    triggerStageId: "stage-initiation",
    cdeDecision: "APPROVED",
    attemptedStages: [
      { stageId: "stage-approval", stageName: "Approval" },
      { stageId: "stage-disburse", stageName: "Disburse" },
    ],
  });

  assert.deepEqual(trail.statusLabel, "Completed");
  assert.equal(trail.statusVariant, "default");
  assert.deepEqual(trail.stages, [
    { key: "stage-initiation", label: "Loan Initiation" },
    { key: "stage-approval", label: "Approval" },
    { key: "stage-disburse", label: "Disburse" },
  ]);
});

test("buildAutoDisbursementTrail omits empty metadata", async () => {
  const mod = await import("../auto-disbursement-trail.ts");

  const trail = mod.buildAutoDisbursementTrail(null);

  assert.equal(trail.statusLabel, null);
  assert.equal(trail.statusVariant, "outline");
  assert.deepEqual(trail.stages, []);
});
