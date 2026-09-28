import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  getRequiredSalaryAdvancePaymentCallbackUrl,
  verifySalaryAdvancePaymentCallbackSignature,
} from "../salary-advance-payment-callback";

const originalEnvironment = {
  callbackUrl: process.env.SALARY_ADVANCE_PAYMENT_CALLBACK_URL,
  callbackSecret: process.env.SALARY_ADVANCE_PAYMENT_CALLBACK_SECRET,
  nodeEnv: process.env.NODE_ENV,
};

function restoreEnvironment() {
  for (const [key, value] of Object.entries({
    SALARY_ADVANCE_PAYMENT_CALLBACK_URL: originalEnvironment.callbackUrl,
    SALARY_ADVANCE_PAYMENT_CALLBACK_SECRET: originalEnvironment.callbackSecret,
    NODE_ENV: originalEnvironment.nodeEnv,
  })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

test.afterEach(restoreEnvironment);

test("requires a configured Salary Advance callback URL", () => {
  delete process.env.SALARY_ADVANCE_PAYMENT_CALLBACK_URL;
  assert.throws(
    () => getRequiredSalaryAdvancePaymentCallbackUrl(),
    /SALARY_ADVANCE_PAYMENT_CALLBACK_URL is required/
  );
});

test("verifies the exact HMAC-signed Payment Service callback body", () => {
  const body = JSON.stringify({
    status: "COMPLETED",
    transactionReference: "SA-123",
    amount: "100.00",
  });
  process.env.SALARY_ADVANCE_PAYMENT_CALLBACK_SECRET = "callback-test-secret";
  const signature = createHmac("sha256", "callback-test-secret")
    .update(body)
    .digest("hex");

  assert.equal(verifySalaryAdvancePaymentCallbackSignature(body, signature), true);
  assert.equal(verifySalaryAdvancePaymentCallbackSignature(`${body} `, signature), false);
  assert.equal(verifySalaryAdvancePaymentCallbackSignature(body, "not-a-signature"), false);
});

test("uses the callback path and does not poll pending Salary Advance payments", () => {
  const root = path.resolve(process.cwd());
  const settlementSource = readFileSync(
    path.join(root, "lib/salary-advance-geepay-settlement.ts"),
    "utf8"
  );
  const pollerSource = readFileSync(
    path.join(root, "lib/ussd-auto-processing-poller.ts"),
    "utf8"
  );

  assert.match(settlementSource, /callbackUrl,/);
  assert.doesNotMatch(pollerSource, /reconcileSalaryAdvanceGeePaySettlement/);
  assert.doesNotMatch(pollerSource, /status:\s*"PAYMENT_PENDING"[\s\S]*paymentStatus:\s*"PENDING"/);
});
