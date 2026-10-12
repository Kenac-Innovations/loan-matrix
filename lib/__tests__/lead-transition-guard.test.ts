import assert from "node:assert/strict";
import test from "node:test";

import {
  getLeadFineractGuardActions,
  validateLeadFineractTransition,
} from "../lead-transition-guard";

const linkedLead = { fineractLoanId: 41 };

test("blocks loan actions when the lead has no local Fineract link", () => {
  const result = validateLeadFineractTransition({
    lead: {},
    actions: ["approve"],
    remoteLoan: { status: { pendingApproval: true } },
  });

  assert.equal(result.allowed, false);
  assert.match(result.message ?? "", /no linked Fineract loan/i);
});

test("allows approve and reject only for a pending-approval loan", () => {
  const remoteLoan = { status: { pendingApproval: true } };

  assert.equal(
    validateLeadFineractTransition({
      lead: linkedLead,
      actions: ["approve"],
      remoteLoan,
    }).allowed,
    true
  );
  assert.equal(
    validateLeadFineractTransition({
      lead: linkedLead,
      actions: ["reject"],
      remoteLoan,
    }).allowed,
    true
  );
  assert.match(
    validateLeadFineractTransition({
      lead: linkedLead,
      actions: ["approve"],
      remoteLoan: { status: { waitingForDisbursal: true } },
    }).message ?? "",
    /not pending approval/i
  );
});

test("allows disbursement only for an approved loan waiting for disbursal", () => {
  assert.equal(
    validateLeadFineractTransition({
      lead: linkedLead,
      actions: ["disburse"],
      remoteLoan: { status: { waitingForDisbursal: true } },
    }).allowed,
    true
  );
  assert.equal(
    validateLeadFineractTransition({
      lead: linkedLead,
      actions: ["disburse"],
      remoteLoan: { status: { value: "Approved" } },
    }).allowed,
    true
  );
  assert.match(
    validateLeadFineractTransition({
      lead: linkedLead,
      actions: ["disburse"],
      remoteLoan: { status: { pendingApproval: true } },
    }).message ?? "",
    /not approved and waiting for disbursement/i
  );
});

test("allows payout only for an active or disbursed loan", () => {
  assert.equal(
    validateLeadFineractTransition({
      lead: linkedLead,
      actions: ["payout"],
      remoteLoan: { status: { active: true } },
    }).allowed,
    true
  );
  assert.equal(
    validateLeadFineractTransition({
      lead: linkedLead,
      actions: ["payout"],
      remoteLoan: { status: { value: "Disbursed" } },
    }).allowed,
    true
  );
  assert.match(
    validateLeadFineractTransition({
      lead: linkedLead,
      actions: ["payout"],
      remoteLoan: { status: { waitingForDisbursal: true } },
    }).message ?? "",
    /not active or disbursed/i
  );
});

test("fails closed for terminal, unknown, and fetch-failure states", () => {
  const terminal = validateLeadFineractTransition({
    lead: linkedLead,
    actions: ["approve"],
    remoteLoan: { status: { value: "Rejected" } },
  });
  assert.equal(terminal.allowed, false);
  assert.match(terminal.message ?? "", /rejected or withdrawn/i);

  const unknown = validateLeadFineractTransition({
    lead: linkedLead,
    actions: ["approve"],
    remoteLoan: {},
  });
  assert.equal(unknown.allowed, false);
  assert.match(unknown.message ?? "", /lifecycle is unknown/i);

  const fetchFailure = validateLeadFineractTransition({
    lead: linkedLead,
    actions: ["approve"],
  });
  assert.equal(fetchFailure.allowed, false);
  assert.match(fetchFailure.message ?? "", /could not be verified/i);
});

test("keeps local-only and RCF savings transitions outside the loan guard", () => {
  assert.equal(
    validateLeadFineractTransition({
      lead: {},
      actions: [],
    }).allowed,
    true
  );
  assert.deepEqual(
    getLeadFineractGuardActions(
      {
        facilityType: "REVOLVING_CREDIT",
        fineractSavingsAccountId: 77,
      },
      ["approve", "activate_revolving"]
    ),
    []
  );
});

test("validates an approve-disburse-payout sequence against one remote snapshot", () => {
  assert.equal(
    validateLeadFineractTransition({
      lead: linkedLead,
      actions: ["approve", "disburse", "payout"],
      remoteLoan: { status: { pendingApproval: true } },
    }).allowed,
    true
  );
});
