import assert from "node:assert/strict";
import { buildTellerVaultTransactions } from "./teller-vault-transactions";

function run() {
  const base = { currency: "ZMW", allocatedBy: "u1", cashierId: null, fineractAllocationId: null };

  // A reversed vault row (reopened variance resolution) is shown but doesn't move the balance.
  const transactions = buildTellerVaultTransactions([
    { ...base, id: "a", allocatedDate: "2026-10-01T08:00:00Z", amount: 1000, notes: "Opening balance", status: "ACTIVE" },
    { ...base, id: "b", allocatedDate: "2026-10-02T08:00:00Z", amount: 100, notes: "Variance shortage CASHIER_REPAID — event e1", status: "REVERSED" },
    { ...base, id: "c", allocatedDate: "2026-10-03T08:00:00Z", amount: 100, notes: "Variance shortage CASHIER_REPAID — event e1", status: "ACTIVE" },
  ]);

  assert.deepEqual(
    transactions.map((t) => [t.id, t.amount, t.runningBalance, t.status]),
    [
      ["a", 1000, 1000, "ACTIVE"],
      ["b", 0, 1000, "REVERSED"],
      ["c", 100, 1100, "ACTIVE"],
    ]
  );
}

run();
