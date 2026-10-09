import assert from "node:assert/strict";
import test from "node:test";

test("normalizes persisted USSD auto-lead rules from tenant settings", async () => {
  const mod = await import("../tenant-ussd-auto-lead-rules");

  assert.deepEqual(
    mod.getTenantUssdAutoLeadRules({
      ussdAutoLeadRules: [
        { enabled: true, loanProductId: 12 },
        {
          enabled: false,
          loanProductId: "14",
          loanChargeAttachment: { mode: "SELECTED", chargeIds: [8, 1] },
        },
        { enabled: true, loanProductId: true },
        { enabled: true, loanProductId: null },
      ],
    }),
    [
      { enabled: true, loanProductId: 12 },
      {
        enabled: false,
        loanProductId: 14,
        loanChargeAttachment: { mode: "SELECTED", chargeIds: [8, 1] },
      },
    ]
  );
});

test("rejects malformed, duplicate, and empty selected charge attachments", async () => {
  const mod = await import("../tenant-ussd-auto-lead-rules");

  assert.deepEqual(
    mod.sanitizeTenantUssdAutoLeadRulesInput([
      { loanProductId: 13, loanChargeAttachment: { mode: "SELECTED", chargeIds: [] } },
      { loanProductId: 13, loanChargeAttachment: { mode: "SELECTED", chargeIds: [8, 8] } },
      { loanProductId: 13, loanChargeAttachment: { mode: "NONE", chargeIds: [8] } },
      { loanProductId: 13, loanChargeAttachment: { mode: "SELECTED", chargeIds: [8, 1] } },
    ]),
    [
      {
        enabled: true,
        loanProductId: 13,
        loanChargeAttachment: { mode: "SELECTED", chargeIds: [8, 1] },
      },
    ]
  );
});

test("matches enabled rule by loan product id", async () => {
  const mod = await import("../tenant-ussd-auto-lead-rules");

  assert.deepEqual(
    mod.findMatchingUssdAutoLeadRule(
      [{ enabled: true, loanProductId: 12 }],
      12
    ),
    { enabled: true, loanProductId: 12 }
  );
});

test("accepts only active loan charges with an exact specified due date", async () => {
  const mod = await import("../tenant-ussd-auto-lead-rules");

  const chargePool = {
    pageItems: [
      {
        id: 8,
        active: true,
        chargeAppliesTo: { code: "chargeAppliesTo.loan", value: "Loan" },
        chargeTimeType: {
          code: "chargeTimeType.specifiedDueDate",
          value: "Specified due date",
        },
      },
      {
        id: 9,
        active: false,
        chargeAppliesTo: { code: "chargeAppliesTo.loan", value: "Loan" },
        chargeTimeType: { code: "chargeTimeType.specifiedDueDate" },
      },
      {
        id: 10,
        active: true,
        chargeAppliesTo: { code: "chargeAppliesTo.client", value: "Client" },
        chargeTimeType: { code: "chargeTimeType.specifiedDueDate" },
      },
      {
        id: 11,
        active: true,
        chargeAppliesTo: { code: "chargeAppliesTo.loan", value: "Loan" },
        chargeTimeType: { code: "chargeTimeType.overdueInstallment" },
      },
      {
        id: 12,
        active: true,
        chargeAppliesTo: { code: "chargeAppliesTo.loan", value: "Loan" },
        chargeTimeType: {
          code: "chargeTimeType.specifiedDueDateExtra",
          value: "Specified due date extra",
        },
      },
      {
        id: 13,
        active: true,
        penalty: true,
        chargeAppliesTo: { code: "chargeAppliesTo.loan", value: "Loan" },
        chargeTimeType: {
          code: "chargeTimeType.specifiedDueDate",
          value: "Specified due date",
        },
      },
    ],
  };

  assert.deepEqual(
    [...mod.getEligibleTenantUssdLoanChargeIds(chargePool)],
    [8]
  );
  assert.deepEqual(
    mod.getInvalidTenantUssdLoanChargeIds(
      [
        {
          loanProductId: 13,
          loanChargeAttachment: { mode: "SELECTED", chargeIds: [8, 9, 10, 11, 12, 13] },
        },
      ],
      chargePool
    ),
    [9, 10, 11, 12, 13]
  );
});

test("does not validate charge IDs attached to other products", async () => {
  const mod = await import("../tenant-ussd-auto-lead-rules");

  assert.deepEqual(
    mod.getInvalidTenantUssdLoanChargeIds(
      [
        {
          loanProductId: 12,
          loanChargeAttachment: { mode: "SELECTED", chargeIds: [999] },
        },
      ],
      []
    ),
    []
  );
});
