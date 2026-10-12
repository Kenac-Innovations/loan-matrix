import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { getRequiredLoanMatrixBackendPaymentCallbackUrl } from "../loan-matrix-be-payment-callback";

const originalBackendUrl = process.env.LOAN_MATRIX_BACKEND_URL;

test.afterEach(() => {
  if (originalBackendUrl === undefined) {
    delete process.env.LOAN_MATRIX_BACKEND_URL;
  } else {
    process.env.LOAN_MATRIX_BACKEND_URL = originalBackendUrl;
  }
});

test("uses the existing internal Loan Matrix Backend URL for the payment callback", () => {
  process.env.LOAN_MATRIX_BACKEND_URL =
    "http://loan-matrix-be-prod.loan-matrix-prod.svc.cluster.local:80";

  assert.equal(
    getRequiredLoanMatrixBackendPaymentCallbackUrl(),
    "http://loan-matrix-be-prod.loan-matrix-prod.svc.cluster.local/api/v1/ussd-loans/payment-callback"
  );
});

test("requires the established Loan Matrix Backend URL", () => {
  delete process.env.LOAN_MATRIX_BACKEND_URL;

  assert.throws(
    () => getRequiredLoanMatrixBackendPaymentCallbackUrl(),
    /LOAN_MATRIX_BACKEND_URL is required/
  );
});

test("does not retain a frontend callback route or settlement polling", () => {
  const root = path.resolve(process.cwd());
  const settlementSource = readFileSync(
    path.join(root, "lib/salary-advance-geepay-settlement.ts"),
    "utf8"
  );
  const pollerSource = readFileSync(
    path.join(root, "lib/ussd-auto-processing-poller.ts"),
    "utf8"
  );

  assert.match(settlementSource, /getRequiredLoanMatrixBackendPaymentCallbackUrl/);
  assert.doesNotMatch(settlementSource, /applySalaryAdvanceGeePayCallback/);
  assert.doesNotMatch(pollerSource, /reconcileSalaryAdvanceGeePaySettlement/);
  assert.doesNotMatch(pollerSource, /status:\s*"PAYMENT_PENDING"[\s\S]*paymentStatus:\s*"PENDING"/);
});
