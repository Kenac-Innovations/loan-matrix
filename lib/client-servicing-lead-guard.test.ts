import assert from "node:assert/strict";
import test from "node:test";
import {
  assertClientCanCreateLoanLead,
  ClientServicingLeadRestrictionError,
} from "./client-servicing-lead-guard";

test("allows a client with no assigned servicing status", async () => {
  await assertClientCanCreateLoanLead(42, async () => ({
    status: null,
    policies: {},
  }));
});

test("allows a servicing status that permits loan origination", async () => {
  await assertClientCanCreateLoanLead(42, async () => ({
    status: { code: "ACTIVE", name: "Active" },
    policies: { ORIGINATE_NEW_LOAN: true },
  }));
});

test("rejects lead creation when servicing policy denies loan origination", async () => {
  await assert.rejects(
    assertClientCanCreateLoanLead(42, async () => ({
      status: { code: "ON_HOLD", name: "On Hold" },
      policies: { ORIGINATE_NEW_LOAN: false },
    })),
    (error: unknown) =>
      error instanceof ClientServicingLeadRestrictionError &&
      error.clientId === 42 &&
      error.message.includes("On Hold"),
  );
});
