import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { sanitizeFineractLoanCreatePayload } from "../fineract-loan-payload";

const repoRoot = path.resolve(process.cwd());

test("removes only the unsupported Fineract loan-create fields", () => {
  const payload = {
    clientId: 58902,
    productId: 13,
    principal: 1500,
    balloonPaymentAmount: 0,
    allowPartialPeriodInterestCalculation: false,
    allowPartialPeriodInterestCalcualtion: true,
    externalId: "lead-123",
    charges: [{ chargeId: 7, amount: 20 }],
  };

  const sanitized = sanitizeFineractLoanCreatePayload(payload);

  assert.deepEqual(sanitized, {
    clientId: 58902,
    productId: 13,
    principal: 1500,
    allowPartialPeriodInterestCalcualtion: true,
    externalId: "lead-123",
    charges: [{ chargeId: 7, amount: 20 }],
  });
  assert.strictEqual(sanitized.charges, payload.charges);
});

test("does not mutate the source payload", () => {
  const payload = {
    balloonPaymentAmount: 0,
    allowPartialPeriodInterestCalculation: false,
    allowPartialPeriodInterestCalcualtion: true,
    nested: { value: "preserved" },
  };
  const original = structuredClone(payload);

  const sanitized = sanitizeFineractLoanCreatePayload(payload);

  assert.deepEqual(payload, original);
  assert.notStrictEqual(sanitized, payload);
  assert.strictEqual(sanitized.nested, payload.nested);
});

test("both loan-create routes use the shared sanitizer before remote creation", () => {
  const genericRoute = readFileSync(
    path.join(repoRoot, "app/api/fineract/loans/route.ts"),
    "utf8"
  );
  const leadRoute = readFileSync(
    path.join(repoRoot, "app/api/leads/[id]/create-loan/route.ts"),
    "utf8"
  );

  assert.match(genericRoute, /sanitizeFineractLoanCreatePayload\(rawBody\)/);
  assert.match(leadRoute, /sanitizeFineractLoanCreatePayload\(/);
  assert.match(leadRoute, /import \{ sanitizeFineractLoanCreatePayload \}/);
  assert.ok(
    leadRoute.indexOf("sanitizeFineractLoanCreatePayload(") <
      leadRoute.indexOf("await reconcileLeadLoan")
  );
  assert.doesNotMatch(genericRoute, /function sanitizeCreateLoanPayload/);
});
