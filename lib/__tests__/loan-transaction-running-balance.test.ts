import assert from "node:assert/strict";
import test from "node:test";

import {
  attachRunningOutstandingBalances,
} from "../loan-transaction-running-balance";

test("builds a running outstanding balance from principal, interest, fees, and refunds", () => {
  const rows = attachRunningOutstandingBalances([
    {
      id: 1,
      amount: 100,
      principalPortion: 0,
      interestPortion: 0,
      feeChargesPortion: 0,
      penaltyChargesPortion: 0,
      type: { value: "Disbursement", disbursement: true },
    },
    {
      id: 2,
      amount: 10,
      principalPortion: 0,
      interestPortion: 0,
      feeChargesPortion: 10,
      penaltyChargesPortion: 0,
      type: { value: "Nano Loan Service Fee Production" },
    },
    {
      id: 3,
      amount: 3.3,
      principalPortion: 0,
      interestPortion: 3.3,
      feeChargesPortion: 0,
      penaltyChargesPortion: 0,
      type: { value: "Accrual", accrual: true },
    },
    {
      id: 4,
      amount: 143,
      principalPortion: 100,
      interestPortion: 3.3,
      feeChargesPortion: 10,
      penaltyChargesPortion: 0,
      type: { value: "Repayment", repayment: true },
    },
    {
      id: 5,
      amount: 29.7,
      principalPortion: 0,
      interestPortion: 0,
      feeChargesPortion: 0,
      penaltyChargesPortion: 0,
      type: { value: "Credit Balance Refund" },
    },
  ]);

  assert.deepEqual(
    rows.map((row) => row.outstandingBalanceMovement),
    [100, 10, 3.3, -143, 29.7]
  );
  assert.deepEqual(
    rows.map((row) => row.runningOutstandingBalance),
    [100, 110, 113.3, -29.7, 0]
  );
});

test("ignores manually reversed transactions when computing the running outstanding balance", () => {
  const rows = attachRunningOutstandingBalances([
    {
      id: 1,
      amount: 100,
      principalPortion: 0,
      interestPortion: 0,
      feeChargesPortion: 0,
      penaltyChargesPortion: 0,
      type: { value: "Disbursement", disbursement: true },
    },
    {
      id: 2,
      amount: 20,
      principalPortion: 0,
      interestPortion: 20,
      feeChargesPortion: 0,
      penaltyChargesPortion: 0,
      manuallyReversed: true,
      type: { value: "Accrual", accrual: true },
    },
  ]);

  assert.deepEqual(
    rows.map((row) => row.runningOutstandingBalance),
    [100, 100]
  );
});

test("ignores Fineract client-transfer status rows because they are not financial transactions", () => {
  const rows = attachRunningOutstandingBalances([
    {
      id: 1,
      amount: 1000,
      principalPortion: 0,
      interestPortion: 0,
      feeChargesPortion: 0,
      penaltyChargesPortion: 0,
      type: { value: "Disbursement", disbursement: true },
    },
    {
      id: 2,
      amount: 356.86,
      principalPortion: 0,
      interestPortion: 356.86,
      feeChargesPortion: 0,
      penaltyChargesPortion: 0,
      type: { value: "Accrual", accrual: true },
    },
    {
      id: 3,
      amount: 1356.86,
      principalPortion: 1000,
      interestPortion: 356.86,
      feeChargesPortion: 0,
      penaltyChargesPortion: 0,
      type: { value: "Transfer initiated" },
    },
    {
      id: 4,
      amount: 1356.86,
      principalPortion: 1000,
      interestPortion: 356.86,
      feeChargesPortion: 0,
      penaltyChargesPortion: 0,
      type: { value: "Transfer approved" },
    },
  ]);

  assert.deepEqual(
    rows.map((row) => row.outstandingBalanceMovement),
    [1000, 356.86, 0, 0]
  );
  assert.deepEqual(
    rows.map((row) => row.runningOutstandingBalance),
    [1000, 1356.86, 1356.86, 1356.86]
  );
});
