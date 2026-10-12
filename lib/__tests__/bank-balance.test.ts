import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/testdb";

const load = async () => ({
  ...(await import("../bank-balance")),
  ...(await import("../gl-balance")),
});

const fromBank = (amount: number) => ({ amount, notes: "Fund allocation", allocatedBy: "user-1" });

test("GL bank: available is the GL balance — teller allocations are not subtracted again", async () => {
  const m = await load();
  // Bank GL already credited for everything sent to tellers.
  const balances = m.computeBankBalances({
    bankGl: { balance: 16_138_094.37, currency: "USD", source: "fineract_calculated" },
    hasGlAccount: true,
    tellerVaultBalances: [0],
    localBankAllocations: [fromBank(6_700_000)],
    localTellerAllocations: [fromBank(371_200_001)],
  });

  assert.equal(balances.availableBalance, 16_138_094.37);
  assert.equal(balances.allocatedToTellers, 0);
  assert.equal(balances.totalAllocated, 16_138_094.37);
  assert.equal(balances.source, "fineract_calculated");
  assert.equal(balances.currency, "USD");
});

test("GL bank: allocated to tellers is what currently sits in their vaults", async () => {
  const m = await load();
  const balances = m.computeBankBalances({
    bankGl: { balance: 80_000, currency: "USD", source: "fineract_calculated" },
    hasGlAccount: true,
    tellerVaultBalances: [15_000, 5_000, null],
    localBankAllocations: [],
    localTellerAllocations: [fromBank(999_999)],
  });

  assert.equal(balances.availableBalance, 80_000);
  assert.equal(balances.allocatedToTellers, 20_000);
  assert.equal(balances.totalAllocated, 100_000);
});

test("no GL: falls back to the local ledger, counting only allocations drawn from the bank", async () => {
  const m = await load();
  const balances = m.computeBankBalances({
    bankGl: null,
    hasGlAccount: false,
    tellerVaultBalances: [],
    localBankAllocations: [fromBank(1_000), fromBank(500)],
    localTellerAllocations: [
      fromBank(300),
      { amount: 200, notes: "Opening balance", allocatedBy: "user-1" },
      { amount: 100, notes: "Return from cashier", allocatedBy: "user-1" },
    ],
  });

  assert.equal(balances.totalAllocated, 1_500);
  assert.equal(balances.allocatedToTellers, 300);
  assert.equal(balances.availableBalance, 1_200);
  assert.equal(balances.source, "local");
});

test("GL configured but unreachable is reported as local_fallback", async () => {
  const m = await load();
  const balances = m.computeBankBalances({
    bankGl: null,
    hasGlAccount: true,
    tellerVaultBalances: [],
    localBankAllocations: [fromBank(1_000)],
    localTellerAllocations: [],
  });

  assert.equal(balances.source, "local_fallback");
  assert.equal(balances.availableBalance, 1_000);
});

test("isAllocationFromBank excludes imports, reversals, returns and session closes", async () => {
  const m = await load();
  assert.equal(m.isAllocationFromBank({ notes: "Fund allocation", allocatedBy: "u" }), true);
  assert.equal(m.isAllocationFromBank({ notes: "x", allocatedBy: "SYSTEM-IMPORT" }), false);
  assert.equal(m.isAllocationFromBank({ notes: "x", allocatedBy: "SYSTEM-REVERSAL" }), false);
  assert.equal(m.isAllocationFromBank({ notes: "Session close", allocatedBy: "u" }), false);
  assert.equal(m.isAllocationFromBank({ notes: "Cash returned to vault", allocatedBy: "u" }), false);
});

test("sumJournalEntries nets debits against credits", async () => {
  const m = await load();
  assert.equal(
    m.sumJournalEntries([
      { amount: 100, entryType: { value: "DEBIT" } },
      { amount: 30, entryType: { value: "CREDIT" } },
      { amount: 5, entryType: { value: "UNKNOWN" } },
      { amount: null, entryType: { value: "DEBIT" } },
    ]),
    70
  );
});
