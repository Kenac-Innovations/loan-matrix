import assert from "node:assert/strict";
import test from "node:test";

test("resolveReusableUssdLoanId prefers the lead's stored Fineract loan id", async () => {
  const mod = await import("../ussd-loan-submission.ts");

  assert.equal(typeof mod.resolveReusableUssdLoanId, "function");

  const loanId = mod.resolveReusableUssdLoanId({
    lead: {
      fineractLoanId: 421,
      stateMetadata: { loanId: 999 },
    },
    externalId: "cmr123",
    loansByExternalId: [
      { id: 777, externalId: "cmr123" },
    ],
  });

  assert.equal(loanId, 421);
});

test("resolveReusableUssdLoanId falls back to a matching external-id loan", async () => {
  const mod = await import("../ussd-loan-submission.ts");

  const loanId = mod.resolveReusableUssdLoanId({
    lead: {
      fineractLoanId: null,
      stateMetadata: { loanId: null },
    },
    externalId: "cmr123",
    loansByExternalId: [
      { id: 777, externalId: "cmr123" },
      { id: 888, externalId: "something-else" },
    ],
  });

  assert.equal(loanId, 777);
});

