import assert from "node:assert/strict";
import test from "node:test";
import { UssdLoanApplicationStatus } from "@/shared/types/ussd";

test("resolveUssdLinkedLeadEffectiveStatus promotes final disbursement and rejection outcomes", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../ussd-linked-leads.ts");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.resolveUssdLinkedLeadEffectiveStatus, "function");

  const resolveUssdLinkedLeadEffectiveStatus = mod
    .resolveUssdLinkedLeadEffectiveStatus as (
    lead: Record<string, unknown>
  ) => UssdLoanApplicationStatus | null;

  assert.equal(
    resolveUssdLinkedLeadEffectiveStatus({
      fineractLoanId: 167437,
      currentStage: {
        name: "Disburse",
        isFinalState: true,
        fineractAction: "disburse",
      },
      stateMetadata: {
        cdeResult: {
          decision: "APPROVED",
        },
      },
    }),
    UssdLoanApplicationStatus.DISBURSED
  );

  assert.equal(
    resolveUssdLinkedLeadEffectiveStatus({
      currentStage: {
        name: "Rejected",
        isFinalState: true,
        fineractAction: "reject",
      },
      stateMetadata: {
        cdeResult: {
          decision: "DECLINED",
        },
      },
    }),
    UssdLoanApplicationStatus.REJECTED
  );
});

test("resolveUssdLinkedLeadEffectiveStatus surfaces approval and manual-review states before final payout", async () => {
  const mod = await import("../ussd-linked-leads.ts");

  assert.equal(typeof mod.resolveUssdLinkedLeadEffectiveStatus, "function");

  const resolveUssdLinkedLeadEffectiveStatus = mod
    .resolveUssdLinkedLeadEffectiveStatus as (
    lead: Record<string, unknown>
  ) => UssdLoanApplicationStatus | null;

  assert.equal(
    resolveUssdLinkedLeadEffectiveStatus({
      currentStage: {
        name: "Approval",
        isFinalState: false,
        fineractAction: "approve",
      },
      stateMetadata: {
        cdeResult: {
          decision: "APPROVED",
        },
      },
    }),
    UssdLoanApplicationStatus.APPROVED
  );

  assert.equal(
    resolveUssdLinkedLeadEffectiveStatus({
      currentStage: {
        name: "Loan Initiation",
        isFinalState: false,
        fineractAction: null,
      },
      stateMetadata: {
        cdeResult: {
          decision: "MANUAL_REVIEW",
        },
      },
    }),
    UssdLoanApplicationStatus.UNDER_REVIEW
  );
});
