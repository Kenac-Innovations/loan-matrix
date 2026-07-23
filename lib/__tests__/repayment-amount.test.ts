import assert from "node:assert/strict";
import test from "node:test";

import { resolveRepaymentDisplayAmounts } from "../repayment-amount";

test("uses the loan outstanding balance when Fineract omits accrued arrears from the repayment template", () => {
  const amounts = resolveRepaymentDisplayAmounts(
    {
      amount: 624.5,
      principalPortion: 500,
      interestPortion: 124.5,
      feeChargesPortion: 0,
      penaltyChargesPortion: 0,
    },
    {
      totalOutstanding: 874.5,
      principalOutstanding: 500,
      interestOutstanding: 124.5,
      feeChargesOutstanding: 0,
      penaltyChargesOutstanding: 250,
    }
  );

  assert.deepEqual(amounts, {
    amount: 874.5,
    principal: 500,
    interest: 124.5,
    fees: 0,
    arrears: 250,
  });
});

test("falls back to the repayment template when no positive outstanding balance is available", () => {
  const amounts = resolveRepaymentDisplayAmounts({
    amount: 721.5,
    principalPortion: 500,
    interestPortion: 125,
    feeChargesPortion: 96.5,
    penaltyChargesPortion: 0,
  });

  assert.deepEqual(amounts, {
    amount: 721.5,
    principal: 500,
    interest: 125,
    fees: 96.5,
    arrears: 0,
  });
});

test("reconciles the visible breakdown to the reported outstanding balance", () => {
  const amounts = resolveRepaymentDisplayAmounts(
    {
      amount: 100,
      principalPortion: 100,
      interestPortion: 0,
      feeChargesPortion: 0,
      penaltyChargesPortion: 0,
    },
    {
      totalOutstanding: 160,
      principalOutstanding: 100,
      interestOutstanding: 10,
      feeChargesOutstanding: 20,
    }
  );

  assert.equal(amounts.arrears, 30);
  assert.equal(amounts.amount, amounts.principal + amounts.interest + amounts.fees + amounts.arrears);
});
