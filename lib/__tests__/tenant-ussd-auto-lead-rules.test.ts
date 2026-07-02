import assert from "node:assert/strict";
import test from "node:test";

test("normalizes persisted USSD auto-lead rules from tenant settings", async () => {
  const mod = await import("../tenant-ussd-auto-lead-rules.ts");

  assert.deepEqual(
    mod.getTenantUssdAutoLeadRules({
      ussdAutoLeadRules: [
        { enabled: true, loanProductId: 12 },
        { enabled: false, loanProductId: "14" },
        { enabled: true, loanProductId: null },
      ],
    }),
    [
      { enabled: true, loanProductId: 12 },
      { enabled: false, loanProductId: 14 },
    ]
  );
});

test("matches enabled rule by loan product id", async () => {
  const mod = await import("../tenant-ussd-auto-lead-rules.ts");

  assert.deepEqual(
    mod.findMatchingUssdAutoLeadRule(
      [{ enabled: true, loanProductId: 12 }],
      12
    ),
    { enabled: true, loanProductId: 12 }
  );
});
