import assert from "node:assert/strict";
import test from "node:test";
import type { FineractClient } from "../fineract-api";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

test("detects when an existing client belongs to a different branch", async () => {
  const { getExistingClientTransferRequirement } = await import(
    "../fineract-client-office-transfer"
  );

  const requirement = getExistingClientTransferRequirement({
    clientId: 58902,
    clientDisplayName: "Jane Doe",
    clientOfficeId: 12,
    clientOfficeName: "Kitwe",
    creatorOfficeId: 5,
    creatorOfficeName: "Lusaka",
  });

  assert.deepEqual(requirement, {
    clientId: 58902,
    clientDisplayName: "Jane Doe",
    clientOfficeId: 12,
    clientOfficeName: "Kitwe",
    destinationOfficeId: 5,
    destinationOfficeName: "Lusaka",
  });
});

test("does not require transfer when the existing client already belongs to the user's branch", async () => {
  const { getExistingClientTransferRequirement } = await import(
    "../fineract-client-office-transfer"
  );

  const requirement = getExistingClientTransferRequirement({
    clientId: 58902,
    clientDisplayName: "Jane Doe",
    clientOfficeId: 5,
    clientOfficeName: "Lusaka",
    creatorOfficeId: 5,
    creatorOfficeName: "Lusaka",
  });

  assert.equal(requirement, null);
});

test("blocks existing-client lead creation until the client is transferred to the user's branch", async () => {
  const {
    assertExistingClientBranchTransferCompleted,
    ensureExistingClientInCreatorOffice,
  } = await import("../fineract-client-office-transfer");

  const client: FineractClient = {
    id: 58902,
    accountNo: "000000123",
    active: true,
    status: {
      id: 300,
      code: "clientStatusType.active",
      value: "Active",
    },
    firstname: "Jane",
    lastname: "Doe",
    displayName: "Jane Doe",
    officeId: 12,
    officeName: "Kitwe",
    timeline: {
      submittedOnDate: "2026-06-19",
      submittedByUsername: "maker",
    },
  };

  const transferState = ensureExistingClientInCreatorOffice({
    client,
    creatorOfficeId: 5,
    creatorOfficeName: "Lusaka",
  });

  assert.throws(
    () => assertExistingClientBranchTransferCompleted(transferState),
    /transfer this client to your branch before creating a lead/i
  );
});

test("builds a branch indicator for existing clients that need transfer", async () => {
  const { getExistingClientTransferUiState } = await import(
    "../fineract-client-office-transfer"
  );

  const uiState = getExistingClientTransferUiState({
    clientId: 58902,
    clientDisplayName: "Jane Doe",
    clientOfficeId: 12,
    clientOfficeName: "Kitwe",
    creatorOfficeId: 5,
    creatorOfficeName: "Head Office",
  });

  assert.deepEqual(uiState, {
    badgeLabel: "Different Branch",
    officeHint: "Needs transfer to Head Office",
  });
});

test("does not build a branch indicator when transfer is not required", async () => {
  const { getExistingClientTransferUiState } = await import(
    "../fineract-client-office-transfer"
  );

  const uiState = getExistingClientTransferUiState({
    clientId: 58902,
    clientDisplayName: "Jane Doe",
    clientOfficeId: 5,
    clientOfficeName: "Head Office",
    creatorOfficeId: 5,
    creatorOfficeName: "Head Office",
  });

  assert.equal(uiState, null);
});

test("uses the transfer error message when showing a modal failure", async () => {
  const { getExistingClientTransferErrorMessage } = await import(
    "../fineract-client-office-transfer"
  );

  const message = getExistingClientTransferErrorMessage(
    new Error("Transfer approval failed")
  );

  assert.equal(message, "Transfer approval failed");
});

test("falls back to a default modal failure message for unknown errors", async () => {
  const { getExistingClientTransferErrorMessage } = await import(
    "../fineract-client-office-transfer"
  );

  const message = getExistingClientTransferErrorMessage("unexpected");

  assert.equal(
    message,
    "Failed to transfer the client to your branch. Please try again."
  );
});
