import assert from "node:assert/strict";
import test from "node:test";
import { requiresUssdLoanAdmission } from "../ussd-loan-admission.ts";

test("Yango is guarded by default and other products are unchanged", () => {
  const previous = process.env.USSD_LOAN_ADMISSION_PRODUCT_IDS;
  delete process.env.USSD_LOAN_ADMISSION_PRODUCT_IDS;

  try {
    assert.equal(requiresUssdLoanAdmission(12), true);
    assert.equal(requiresUssdLoanAdmission(9), false);
  } finally {
    if (previous === undefined) delete process.env.USSD_LOAN_ADMISSION_PRODUCT_IDS;
    else process.env.USSD_LOAN_ADMISSION_PRODUCT_IDS = previous;
  }
});

test("guarded products can be expanded through configuration", () => {
  const previous = process.env.USSD_LOAN_ADMISSION_PRODUCT_IDS;
  process.env.USSD_LOAN_ADMISSION_PRODUCT_IDS = "12, 9";

  try {
    assert.equal(requiresUssdLoanAdmission(12), true);
    assert.equal(requiresUssdLoanAdmission(9), true);
  } finally {
    if (previous === undefined) delete process.env.USSD_LOAN_ADMISSION_PRODUCT_IDS;
    else process.env.USSD_LOAN_ADMISSION_PRODUCT_IDS = previous;
  }
});
