import assert from "node:assert/strict";
import test from "node:test";

test("normalizes payment reference lookup responses", async () => {
  const mod = await import("../payment-reference-status.ts");

  const status = mod.normalizePaymentReferenceStatus({
    referenceNumber: "LA6319698",
    amount: "90.00",
    currency: "ZMW",
    phoneNumber: "260963003442",
    tenantId: "goodfellow",
    narration: "Loan Disbursement",
    status: "completed",
    type: "receive_money",
  });

  assert.deepEqual(status, {
    referenceNumber: "LA6319698",
    amount: 90,
    currency: "ZMW",
    phoneNumber: "260963003442",
    tenantId: "goodfellow",
    narration: "Loan Disbursement",
    status: "COMPLETED",
    type: "RECEIVE_MONEY",
  });
});

test("matches Yango USSD payment candidates by product id or name", async () => {
  const mod = await import("../payment-reference-status.ts");

  assert.equal(
    mod.isYangoUssdPaymentCandidate({
      referenceNumber: "LA123",
      loanMatrixLoanProductId: 12,
      loanProductName: "Driver Loan",
    }),
    true
  );
  assert.equal(
    mod.isYangoUssdPaymentCandidate({
      referenceNumber: "LA456",
      loanMatrixLoanProductId: 7,
      loanProductName: "Yango Driver Loan",
    }),
    true
  );
  assert.equal(
    mod.isYangoUssdPaymentCandidate({
      referenceNumber: "LA789",
      loanMatrixLoanProductId: 5,
      loanProductName: "Nano Loan New",
    }),
    false
  );
});
