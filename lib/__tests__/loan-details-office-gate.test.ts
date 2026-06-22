import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

test("does not flag loan details actions as office-restricted", async () => {
  const {
    isLoanDetailsOfficeRestrictedAction,
  } = await import("../loan-details-office-gate");

  assert.equal(isLoanDetailsOfficeRestrictedAction("add-charge"), false);
  assert.equal(isLoanDetailsOfficeRestrictedAction("make-repayment"), false);
  assert.equal(isLoanDetailsOfficeRestrictedAction("reverse-payout"), false);
  assert.equal(isLoanDetailsOfficeRestrictedAction("approve-loan"), false);
  assert.equal(isLoanDetailsOfficeRestrictedAction(null), false);
});

test("does not require a transfer when the loan client belongs to another branch", async () => {
  const {
    getLoanDetailsOfficeTransferRequirement,
  } = await import("../loan-details-office-gate");

  const requirement = getLoanDetailsOfficeTransferRequirement({
    clientId: 104,
    clientDisplayName: "Jane Doe",
    clientOfficeId: 12,
    clientOfficeName: "Kitwe",
    userOfficeId: 5,
    userOfficeName: "Lusaka",
  });

  assert.equal(requirement, null);
});

test("does not require a transfer when only the loan office differs", async () => {
  const {
    getLoanDetailsOfficeTransferRequirement,
  } = await import("../loan-details-office-gate");

  const requirement = getLoanDetailsOfficeTransferRequirement({
    clientId: 104,
    clientDisplayName: "Jane Doe",
    clientOfficeId: undefined,
    clientOfficeName: undefined,
    loanOfficeId: 8,
    loanOfficeName: "Ndola",
    userOfficeId: 5,
    userOfficeName: "Lusaka",
  });

  assert.equal(requirement, null);
});

test("does not require a transfer when the loan client already belongs to the user's branch", async () => {
  const {
    getLoanDetailsOfficeTransferRequirement,
  } = await import("../loan-details-office-gate");

  const requirement = getLoanDetailsOfficeTransferRequirement({
    clientId: 104,
    clientDisplayName: "Jane Doe",
    clientOfficeId: 5,
    clientOfficeName: "Lusaka",
    userOfficeId: 5,
    userOfficeName: "Lusaka",
  });

  assert.equal(requirement, null);
});
