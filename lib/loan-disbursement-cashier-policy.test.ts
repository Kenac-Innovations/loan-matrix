import assert from "node:assert/strict";
import {
  shouldBypassCashierRestrictionsForLoanDisbursement,
  shouldSkipManualFineractCashierSettleForLoanDisbursement,
} from "./loan-disbursement-cashier-policy";

function run() {
  assert.equal(
    shouldSkipManualFineractCashierSettleForLoanDisbursement({
      transactionType: "DISBURSEMENT",
    }),
    true
  );

  assert.equal(
    shouldSkipManualFineractCashierSettleForLoanDisbursement({
      payoutMethod: "CASH",
    }),
    true
  );

  assert.equal(
    shouldSkipManualFineractCashierSettleForLoanDisbursement({
      transactionType: "EXPENSE",
    }),
    false
  );

  assert.equal(
    shouldBypassCashierRestrictionsForLoanDisbursement({
      transactionType: "DISBURSEMENT",
    }),
    true
  );

  assert.equal(
    shouldBypassCashierRestrictionsForLoanDisbursement({
      payoutMethod: "CASH",
    }),
    true
  );

  assert.equal(
    shouldBypassCashierRestrictionsForLoanDisbursement({
      transactionType: "EXPENSE",
    }),
    false
  );
}

run();
