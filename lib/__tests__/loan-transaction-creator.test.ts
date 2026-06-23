import assert from "node:assert/strict";
import test from "node:test";

test("builds the journal transaction reference for a loan transaction", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../loan-transaction-creator");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.getLoanTransactionJournalReference, "function");

  const getLoanTransactionJournalReference = mod.getLoanTransactionJournalReference as (
    transaction: Record<string, unknown>
  ) => string | null;

  assert.equal(
    getLoanTransactionJournalReference({ transactionId: "L412707", id: 412707 }),
    "L412707"
  );
  assert.equal(
    getLoanTransactionJournalReference({ externalId: "L493655", id: 493655 }),
    "L493655"
  );
  assert.equal(getLoanTransactionJournalReference({ id: 1042324 }), "L1042324");
});

test("extracts the repayment creator name from journal entries", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../loan-transaction-creator");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.getJournalEntriesCreatorName, "function");

  const getJournalEntriesCreatorName = mod.getJournalEntriesCreatorName as (
    payload: Record<string, unknown>
  ) => string | null;

  assert.equal(
    getJournalEntriesCreatorName({
      pageItems: [
        { createdByUserName: "" },
        { createdByUserName: "ELIAH.NYIRENDA" },
      ],
    }),
    "ELIAH.NYIRENDA"
  );
});

test("returns null when journal entries do not expose a creator name", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../loan-transaction-creator");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.getJournalEntriesCreatorName, "function");

  const getJournalEntriesCreatorName = mod.getJournalEntriesCreatorName as (
    payload: Record<string, unknown>
  ) => string | null;

  assert.equal(
    getJournalEntriesCreatorName({
      pageItems: [{ createdByUserName: "" }, { createdByUserName: "   " }],
    }),
    null
  );
  assert.equal(getJournalEntriesCreatorName({ pageItems: [] }), null);
});

test("falls back to the loan transaction creator report when journal entries are absent", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../loan-transaction-creator");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.resolveLoanTransactionCreatorName, "function");

  const resolveLoanTransactionCreatorName = mod.resolveLoanTransactionCreatorName as (
    payload: Record<string, unknown>
  ) => string | null;

  assert.equal(
    resolveLoanTransactionCreatorName({
      journalEntriesPayload: { pageItems: [] },
      reportPayload: [{ created_by_user_name: "ELIAH.NYIRENDA" }],
    }),
    "ELIAH.NYIRENDA"
  );
});

test("prefers the loan transaction creator report over journal entries", async () => {
  let mod: Record<string, unknown>;

  try {
    mod = await import("../loan-transaction-creator");
  } catch {
    mod = {};
  }

  assert.equal(typeof mod.resolveLoanTransactionCreatorName, "function");

  const resolveLoanTransactionCreatorName = mod.resolveLoanTransactionCreatorName as (
    payload: Record<string, unknown>
  ) => string | null;

  assert.equal(
    resolveLoanTransactionCreatorName({
      journalEntriesPayload: {
        pageItems: [{ createdByUserName: "App Administrator" }],
      },
      reportPayload: [{ created_by_user_name: "system" }],
    }),
    "system"
  );
});
