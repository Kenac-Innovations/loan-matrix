import assert from "node:assert/strict";
import test from "node:test";

import {
  LeadLoanLinkingError,
  LeadLoanPersistenceError,
  reconcileLeadLoan,
  type LeadLoanLinkingDependencies,
  type LeadLoanRecord,
} from "./lead-loan-linking";

function setup(overrides: Partial<{
  lead: Partial<LeadLoanRecord>;
  search: unknown;
  created: unknown;
  remote: unknown;
}> = {}) {
  const lead: LeadLoanRecord = {
    id: "clead00000000000000000001",
    tenantId: "tenant-a",
    fineractLoanId: null,
    fineractClientId: 41,
    loanSubmittedToFineract: false,
    loanSubmissionDate: null,
    stateMetadata: { existing: true },
    ...(overrides.lead || {}),
  };
  let current = { ...lead };
  let searchCalls = 0;
  let createCalls = 0;
  const persisted: unknown[] = [];

  const dependencies: LeadLoanLinkingDependencies = {
    findLead: async ({ tenantId, leadId }) =>
      tenantId === current.tenantId && leadId === current.id ? current : null,
    searchLoansByExternalId: async () => {
      searchCalls += 1;
      return overrides.search ?? [];
    },
    getLoanById: async (loanId) =>
      overrides.remote ?? {
        id: loanId,
        externalId: lead.id,
        clientId: 41,
      },
    createLoan: async (payload) => {
      createCalls += 1;
      assert.equal(payload.externalId, lead.id);
      assert.equal(payload.clientId, 41);
      return overrides.created ?? { resourceId: 9001 };
    },
    persistLeadLink: async ({ data }) => {
      persisted.push(data);
      current = { ...current, ...data };
      return current;
    },
  };

  return {
    lead,
    dependencies,
    persisted,
    get searchCalls() {
      return searchCalls;
    },
    get createCalls() {
      return createCalls;
    },
  };
}

test("creates with the Lead external ID and persists before success", async () => {
  const state = setup();
  const result = await reconcileLeadLoan({
    tenantId: "tenant-a",
    leadId: state.lead.id,
    expectedClientId: 41,
    fineractPayload: { clientId: 999, externalId: "attacker-value", principal: 100 },
    dependencies: state.dependencies,
  });

  assert.equal(result.success, true);
  assert.equal(result.action, "created");
  assert.equal(result.loanId, 9001);
  assert.equal(state.searchCalls, 1);
  assert.equal(state.createCalls, 1);
  assert.equal(state.persisted.length, 1);
});

test("adopts one exact remote loan and never posts a duplicate", async () => {
  const state = setup({
    search: [
      {
        id: 9002,
        externalId: "clead00000000000000000001",
        clientId: 41,
      },
    ],
  });
  const result = await reconcileLeadLoan({
    tenantId: "tenant-a",
    leadId: state.lead.id,
    expectedClientId: 41,
    fineractPayload: {},
    dependencies: state.dependencies,
  });

  assert.equal(result.success, true);
  assert.equal(result.action, "linked");
  assert.equal(result.loanId, 9002);
  assert.equal(state.createCalls, 0);
  assert.equal(state.persisted.length, 1);
});

test("rejects multiple or wrong-client external-ID matches", async () => {
  const multiple = setup({
    search: [
      { id: 1, externalId: "clead00000000000000000001", clientId: 41 },
      { id: 2, externalId: "clead00000000000000000001", clientId: 41 },
    ],
  });
  await assert.rejects(
    reconcileLeadLoan({
      tenantId: "tenant-a",
      leadId: multiple.lead.id,
      expectedClientId: 41,
      dependencies: multiple.dependencies,
    }),
    (error: unknown) =>
      error instanceof LeadLoanLinkingError &&
      error.code === "LEAD_LOAN_EXTERNAL_ID_CONFLICT"
  );

  const wrongClient = setup({
    search: [
      { id: 3, externalId: "clead00000000000000000001", clientId: 99 },
    ],
  });
  await assert.rejects(
    reconcileLeadLoan({
      tenantId: "tenant-a",
      leadId: wrongClient.lead.id,
      expectedClientId: 41,
      dependencies: wrongClient.dependencies,
    }),
    (error: unknown) =>
      error instanceof LeadLoanLinkingError &&
      error.code === "LEAD_LOAN_CLIENT_CONFLICT"
  );
});

test("links a rejected remote loan but returns a terminal non-success result", async () => {
  const rejectedLoan = {
    id: 9004,
    externalId: "clead00000000000000000001",
    clientId: 41,
    status: { value: "Rejected" },
  };
  const state = setup({
    search: [rejectedLoan],
    remote: rejectedLoan,
  });
  const result = await reconcileLeadLoan({
    tenantId: "tenant-a",
    leadId: state.lead.id,
    expectedClientId: 41,
    dependencies: state.dependencies,
  });

  assert.equal(result.success, false);
  assert.equal(result.terminal, true);
  assert.equal(result.action, "terminal");
  assert.equal(state.persisted.length, 1);

  const retry = await reconcileLeadLoan({
    tenantId: "tenant-a",
    leadId: state.lead.id,
    expectedClientId: 41,
    dependencies: state.dependencies,
  });

  assert.equal(retry.success, false);
  assert.equal(retry.terminal, true);
  assert.equal(retry.action, "terminal");
  assert.equal(state.searchCalls, 1);
  assert.equal(state.createCalls, 0);
  assert.equal(state.persisted.length, 1);
});

test("surfaces a local persistence failure after remote creation", async () => {
  const state = setup();
  const dependencies: LeadLoanLinkingDependencies = {
    ...state.dependencies,
    persistLeadLink: async () => {
      throw new Error("database unavailable");
    },
  };

  await assert.rejects(
    reconcileLeadLoan({
      tenantId: "tenant-a",
      leadId: state.lead.id,
      expectedClientId: 41,
      dependencies,
    }),
    (error: unknown) =>
      error instanceof LeadLoanPersistenceError &&
      error.remoteLoanId === 9001
  );
});

test("a retry after local reconciliation does not search or create again", async () => {
  const state = setup({
    lead: {
      fineractLoanId: 9010,
      fineractClientId: 41,
      loanSubmittedToFineract: true,
      loanSubmissionDate: new Date(),
    },
  });
  const result = await reconcileLeadLoan({
    tenantId: "tenant-a",
    leadId: state.lead.id,
    expectedClientId: 41,
    dependencies: state.dependencies,
  });

  assert.equal(result.success, true);
  assert.equal(result.action, "already-linked");
  assert.equal(state.searchCalls, 0);
  assert.equal(state.createCalls, 0);
  assert.equal(state.persisted.length, 0);
});
