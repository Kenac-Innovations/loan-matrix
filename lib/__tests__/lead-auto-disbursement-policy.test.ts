import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

test("matches an enabled auto-disbursement rule by product and trigger stage", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../lead-auto-disbursement-policy.ts");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.findMatchingAutoDisbursementRule, "function");

  const findMatchingAutoDisbursementRule = mod
    .findMatchingAutoDisbursementRule as (
    settings: Record<string, unknown> | null | undefined,
    lead: Record<string, unknown>
  ) => Record<string, unknown> | null;

  const rule = findMatchingAutoDisbursementRule(
    {
      autoProgressToDisbursementRules: [
        {
          enabled: true,
          loanProductId: 12,
          triggerStageId: "stage-cde",
          allowedCdeDecisions: ["APPROVED", "MANUAL_REVIEW"],
        },
      ],
    },
    {
      loanProductId: 12,
      currentStageId: "stage-cde",
    }
  );

  assert.deepEqual(rule, {
    enabled: true,
    loanProductId: 12,
    triggerStageId: "stage-cde",
    allowedCdeDecisions: ["APPROVED", "MANUAL_REVIEW"],
  });
});

test("matches an enabled auto-disbursement rule when the lead has already moved past the trigger stage", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../lead-auto-disbursement-policy.ts");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.findMatchingAutoDisbursementRule, "function");

  const findMatchingAutoDisbursementRule = mod
    .findMatchingAutoDisbursementRule as (
    settings: Record<string, unknown> | null | undefined,
    lead: Record<string, unknown>,
    stageOrderLookup?: Map<string, number>
  ) => Record<string, unknown> | null;

  const rule = findMatchingAutoDisbursementRule(
    {
      autoProgressToDisbursementRules: [
        {
          enabled: true,
          loanProductId: 12,
          triggerStageId: "stage-initiation",
          allowedCdeDecisions: ["APPROVED"],
        },
      ],
    },
    {
      loanProductId: 12,
      currentStageId: "stage-approval",
      currentStage: {
        order: 20,
      },
    },
    new Map([
      ["stage-initiation", 10],
      ["stage-approval", 20],
    ])
  );

  assert.deepEqual(rule, {
    enabled: true,
    loanProductId: 12,
    triggerStageId: "stage-initiation",
    allowedCdeDecisions: ["APPROVED"],
  });
});

test("allows MANUAL_REVIEW when the rule explicitly enables it", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../lead-auto-disbursement-policy.ts");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.isAutoDisbursementDecisionAllowed, "function");

  const isAutoDisbursementDecisionAllowed = mod
    .isAutoDisbursementDecisionAllowed as (
    rule: Record<string, unknown> | null | undefined,
    decision: string | null | undefined
  ) => boolean;

  assert.equal(
    isAutoDisbursementDecisionAllowed(
      {
        allowedCdeDecisions: ["APPROVED", "MANUAL_REVIEW"],
      },
      "MANUAL_REVIEW"
    ),
    true
  );

  assert.equal(
    isAutoDisbursementDecisionAllowed(
      {
        allowedCdeDecisions: ["APPROVED", "MANUAL_REVIEW"],
      },
      "DECLINED"
    ),
    false
  );
});

test("treats already completed automation or disbursed payout state as ineligible", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../lead-auto-disbursement-policy.ts");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.getAutoDisbursementIneligibilityReason, "function");

  const getAutoDisbursementIneligibilityReason = mod
    .getAutoDisbursementIneligibilityReason as (
    lead: Record<string, unknown>
  ) => string | null;

  assert.equal(
    getAutoDisbursementIneligibilityReason({
      stateMetadata: {
        autoDisbursement: {
          status: "completed",
        },
      },
    }),
    "already_completed"
  );

  assert.equal(
    getAutoDisbursementIneligibilityReason({
      currentStage: { fineractStatus: "disbursed" },
    }),
    "already_disbursed"
  );
});

test("prefers the lead originator as the auto-disbursement trigger user", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../lead-auto-disbursement-policy.ts");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.resolveAutoProgressTriggeredBy, "function");

  const resolveAutoProgressTriggeredBy = mod
    .resolveAutoProgressTriggeredBy as (
    lead: Record<string, unknown>,
    fallbackTriggeredBy: string
  ) => string;

  assert.equal(
    resolveAutoProgressTriggeredBy(
      {
        userId: "42",
        designatedDisburserUserId: 42,
      },
      "system"
    ),
    "42"
  );

  assert.equal(
    resolveAutoProgressTriggeredBy(
      {
        userId: "not-a-number",
      },
      "system"
    ),
    "system"
  );
});
