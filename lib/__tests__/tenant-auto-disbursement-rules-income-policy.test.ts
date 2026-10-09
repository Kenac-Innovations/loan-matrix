import assert from "node:assert/strict";
import test from "node:test";

import { isIncomeEvaluationRequiredForLoanProduct } from "../tenant-auto-disbursement-rules";

test("income evaluation remains enabled when no product rule opts out", () => {
  assert.equal(
    isIncomeEvaluationRequiredForLoanProduct(
      {
        autoProgressToDisbursementRules: [
          {
            loanProductId: 12,
            triggerStageId: "cde",
            allowedCdeDecisions: ["APPROVED"],
          },
        ],
      },
      12
    ),
    true
  );
});

test("income evaluation is disabled only by an explicit false product rule", () => {
  assert.equal(
    isIncomeEvaluationRequiredForLoanProduct(
      {
        autoProgressToDisbursementRules: [
          {
            loanProductId: 12,
            triggerStageId: "cde",
            allowedCdeDecisions: ["APPROVED"],
            incomeEvaluationRequired: false,
          },
        ],
      },
      12
    ),
    false
  );
  assert.equal(isIncomeEvaluationRequiredForLoanProduct(null, 12), true);
});
