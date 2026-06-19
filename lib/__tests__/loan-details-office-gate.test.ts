import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

test("flags loan details actions that must be blocked across branches", async () => {
  const {
    isLoanDetailsOfficeRestrictedAction,
  } = await import("../loan-details-office-gate");

  assert.equal(isLoanDetailsOfficeRestrictedAction("add-charge"), true);
  assert.equal(isLoanDetailsOfficeRestrictedAction("make-repayment"), true);
  assert.equal(isLoanDetailsOfficeRestrictedAction("reverse-payout"), true);
  assert.equal(isLoanDetailsOfficeRestrictedAction("approve-loan"), false);
  assert.equal(isLoanDetailsOfficeRestrictedAction(null), false);
});

test("builds a transfer requirement when the loan client belongs to another branch", async () => {
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

  assert.deepEqual(requirement, {
    clientId: 104,
    clientDisplayName: "Jane Doe",
    clientOfficeId: 12,
    clientOfficeName: "Kitwe",
    destinationOfficeId: 5,
    destinationOfficeName: "Lusaka",
  });
});

test("falls back to the loan office when the client payload does not include office details", async () => {
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

  assert.deepEqual(requirement, {
    clientId: 104,
    clientDisplayName: "Jane Doe",
    clientOfficeId: 8,
    clientOfficeName: "Ndola",
    destinationOfficeId: 5,
    destinationOfficeName: "Lusaka",
  });
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
