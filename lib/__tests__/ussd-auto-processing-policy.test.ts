import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyUssdAutoProcessingOutcome,
  runWithBoundedRetries,
  shouldAutoProgressFromCde,
} from "../ussd-auto-processing-policy";

test("only an APPROVED CDE decision is eligible for automatic progression", () => {
  assert.equal(shouldAutoProgressFromCde("APPROVED"), true);
  assert.equal(shouldAutoProgressFromCde(" approved "), true);
  assert.equal(shouldAutoProgressFromCde("MANUAL_REVIEW"), false);
  assert.equal(shouldAutoProgressFromCde("DECLINED"), false);
  assert.equal(shouldAutoProgressFromCde(null), false);
});

test("classifies completed and already-disbursed outcomes", () => {
  assert.equal(
    classifyUssdAutoProcessingOutcome({
      cdeDecision: "APPROVED",
      autoProgressMessage:
        "Auto disbursement completed after CDE APPROVED",
    }),
    "completed"
  );
  assert.equal(
    classifyUssdAutoProcessingOutcome({
      cdeDecision: "APPROVED",
      autoProgressMessage: "Auto disbursement skipped: already_disbursed",
    }),
    "completed"
  );
});

test("classifies decisions that require a stop", () => {
  assert.equal(
    classifyUssdAutoProcessingOutcome({
      cdeDecision: "MANUAL_REVIEW",
    }),
    "manual_review"
  );
  assert.equal(
    classifyUssdAutoProcessingOutcome({
      cdeDecision: "DECLINED",
    }),
    "stopped"
  );
  assert.equal(
    classifyUssdAutoProcessingOutcome({
      cdeDecision: "APPROVED",
      autoProgressMessage:
        "Auto disbursement stopped: no forward transition available",
    }),
    "stopped"
  );
  assert.equal(
    classifyUssdAutoProcessingOutcome({
      cdeDecision: null,
    }),
    "failed"
  );
});

test("bounded retry returns after a later successful attempt", async () => {
  let attempts = 0;

  const result = await runWithBoundedRetries(
    async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("temporary");
      }
      return "ok";
    },
    {
      maxAttempts: 3,
      shouldRetry: () => true,
    }
  );

  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("bounded retry stops after the configured maximum attempts", async () => {
  let attempts = 0;

  await assert.rejects(
    runWithBoundedRetries(
      async () => {
        attempts += 1;
        throw new Error("still failing");
      },
      {
        maxAttempts: 3,
        shouldRetry: () => true,
      }
    ),
    /still failing/
  );

  assert.equal(attempts, 3);
});

test("bounded retry does not repeat non-retryable failures", async () => {
  let attempts = 0;

  await assert.rejects(
    runWithBoundedRetries(
      async () => {
        attempts += 1;
        throw new Error("invalid data");
      },
      {
        maxAttempts: 3,
        shouldRetry: () => false,
      }
    ),
    /invalid data/
  );

  assert.equal(attempts, 1);
});
