import assert from "node:assert/strict";
import test from "node:test";

test("normalizes persisted auto-disbursement rules from tenant settings", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../tenant-auto-disbursement-rules.ts");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.getTenantAutoDisbursementRules, "function");

  const getTenantAutoDisbursementRules = mod.getTenantAutoDisbursementRules as (
    settings: Record<string, unknown> | null | undefined
  ) => Array<Record<string, unknown>>;

  const rules = getTenantAutoDisbursementRules({
    autoProgressToDisbursementRules: [
      {
        enabled: true,
        loanProductId: 12,
        triggerStageId: "stage-cde",
        allowedCdeDecisions: ["APPROVED", "MANUAL_REVIEW"],
      },
      {
        enabled: true,
        loanProductId: null,
      },
    ],
  });

  assert.deepEqual(rules, [
    {
      enabled: true,
      loanProductId: 12,
      triggerStageId: "stage-cde",
      allowedCdeDecisions: ["APPROVED", "MANUAL_REVIEW"],
      incomeEvaluationRequired: true,
      requireGeePaySettlement: false,
    },
  ]);
});

test("sanitizes incoming auto-disbursement rules payloads", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../tenant-auto-disbursement-rules.ts");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.sanitizeTenantAutoDisbursementRulesInput, "function");

  const sanitizeTenantAutoDisbursementRulesInput = mod
    .sanitizeTenantAutoDisbursementRulesInput as (
    input: unknown
  ) => Array<Record<string, unknown>>;

  const rules = sanitizeTenantAutoDisbursementRulesInput([
    {
      enabled: false,
      loanProductId: "12",
      triggerStageId: " stage-cde ",
      allowedCdeDecisions: ["APPROVED", "MANUAL_REVIEW", "INVALID"],
    },
  ]);

  assert.deepEqual(rules, [
    {
      enabled: false,
      loanProductId: 12,
      triggerStageId: "stage-cde",
      allowedCdeDecisions: ["APPROVED", "MANUAL_REVIEW"],
      incomeEvaluationRequired: true,
      requireGeePaySettlement: false,
    },
  ]);
});

test("preserves the explicit GeePay settlement gate and Payment Service tenant", async () => {
  const mod = await import("../tenant-auto-disbursement-rules.ts");
  const rules = mod.sanitizeTenantAutoDisbursementRulesInput([
    {
      loanProductId: 13,
      triggerStageId: "cde-stage",
      allowedCdeDecisions: ["APPROVED"],
      requireGeePaySettlement: true,
      paymentServiceTenantId: " goodfellow ",
    },
  ]);

  assert.deepEqual(rules, [
    {
      enabled: true,
      loanProductId: 13,
      triggerStageId: "cde-stage",
      allowedCdeDecisions: ["APPROVED"],
      incomeEvaluationRequired: true,
      requireGeePaySettlement: true,
      paymentServiceTenantId: "goodfellow",
    },
  ]);
});
