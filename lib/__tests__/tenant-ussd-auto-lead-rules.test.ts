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
