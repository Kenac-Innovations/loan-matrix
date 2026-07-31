import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveRepaymentTransactionForUndoFromTransactions,
  type FineractLoanTransaction,
} from "../bulk-repayment-reverse";

function repayment(
  input: Partial<FineractLoanTransaction>
): FineractLoanTransaction {
  return {
    id: 1,
    amount: 100,
    date: [2026, 7, 23],
    manuallyReversed: false,
    type: { repayment: true },
    ...input,
  };
}

test("resolves an exact active stored repayment as undoable", () => {
  const result = resolveRepaymentTransactionForUndoFromTransactions({
    transactions: [
      repayment({ id: 1283462, amount: 1000, manuallyReversed: false }),
    ],
    storedTransactionId: "1283462",
    transactionDate: new Date("2026-07-23T00:00:00Z"),
    amount: 1000,
  });

  assert.deepEqual(result, {
    status: "UNDOABLE",
    transactionId: "1283462",
  });
});

test("treats an exact already-reversed stored repayment as successful", () => {
  const result = resolveRepaymentTransactionForUndoFromTransactions({
    transactions: [
      repayment({ id: 1283462, amount: 1000, manuallyReversed: true }),
    ],
    storedTransactionId: "1283462",
    transactionDate: new Date("2026-07-23T00:00:00Z"),
    amount: 1000,
  });

  assert.deepEqual(result, {
    status: "ALREADY_REVERSED",
    transactionId: "1283462",
  });
});

test("keeps active amount and date fallback for replayed transaction ids", () => {
  const result = resolveRepaymentTransactionForUndoFromTransactions({
    transactions: [
      repayment({ id: 1284000, amount: 1000, manuallyReversed: false }),
    ],
    storedTransactionId: "1283462",
    transactionDate: new Date("2026-07-23T00:00:00Z"),
    amount: 1000,
  });

  assert.deepEqual(result, {
    status: "UNDOABLE",
    transactionId: "1284000",
  });
});

test("uses a unique already-reversed amount and date match as reconciliation success", () => {
  const result = resolveRepaymentTransactionForUndoFromTransactions({
    transactions: [
      repayment({ id: 1284000, amount: 1000, manuallyReversed: true }),
    ],
    storedTransactionId: "1283462",
    transactionDate: new Date("2026-07-23T00:00:00Z"),
    amount: 1000,
  });

  assert.deepEqual(result, {
    status: "ALREADY_REVERSED",
    transactionId: "1284000",
  });
});
