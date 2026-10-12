import assert from "node:assert/strict";
import {
  isCashDisbursementSubjectToSessionClosure,
  isSessionCountedForEnforcement,
  resolveEnforcementPerCashier,
  resolveSessionClosureEnforcement,
  toBusinessDateString,
  type SessionClosureCashierSettings,
  type SessionClosureTenantSettings,
} from "./cashier-session-enforcement-policy";

const d = (iso: string) => new Date(iso);

function tenant(overrides: Partial<SessionClosureTenantSettings> = {}): SessionClosureTenantSettings {
  return {
    isTellerManagementModuleOn: true,
    enforceSessionClosureByDefault: false,
    sessionClosureEnforcedFrom: null,
    sessionClosureSettingsUpdatedAt: null,
    ...overrides,
  };
}

function cashier(overrides: Partial<SessionClosureCashierSettings> = {}): SessionClosureCashierSettings {
  return {
    enforceSessionClosure: null,
    sessionClosureEnforcedFrom: null,
    sessionClosureFlagUpdatedAt: null,
    createdAt: d("2026-01-01T08:00:00Z"),
    ...overrides,
  };
}

function run() {
  // Module off overrides everything, including an explicitly enforced cashier.
  assert.deepEqual(
    resolveSessionClosureEnforcement(
      tenant({ isTellerManagementModuleOn: false, enforceSessionClosureByDefault: true }),
      cashier({ enforceSessionClosure: true, sessionClosureEnforcedFrom: d("2026-10-07T06:00:00Z") })
    ),
    { enforced: false, reason: "MODULE_OFF" }
  );

  // Explicit exemption wins over tenant default.
  assert.deepEqual(
    resolveSessionClosureEnforcement(
      tenant({ enforceSessionClosureByDefault: true, sessionClosureEnforcedFrom: d("2026-10-01T06:00:00Z") }),
      cashier({ enforceSessionClosure: false })
    ),
    { enforced: false, reason: "CASHIER_EXEMPT" }
  );

  // Null flag with tenant default off: not enrolled (phased rollout).
  assert.deepEqual(resolveSessionClosureEnforcement(tenant(), cashier()), {
    enforced: false,
    reason: "NOT_ENROLLED",
  });

  // Explicit enforcement uses the cashier's own start date.
  assert.deepEqual(
    resolveSessionClosureEnforcement(
      tenant(),
      cashier({ enforceSessionClosure: true, sessionClosureEnforcedFrom: d("2026-10-07T06:00:00Z") })
    ),
    { enforced: true, source: "CASHIER", enforcedFrom: d("2026-10-07T06:00:00Z") }
  );

  // Explicit enforcement without a start date falls back to the flag change, then createdAt.
  assert.deepEqual(
    resolveSessionClosureEnforcement(
      tenant(),
      cashier({ enforceSessionClosure: true, sessionClosureFlagUpdatedAt: d("2026-10-05T10:00:00Z") })
    ),
    { enforced: true, source: "CASHIER", enforcedFrom: d("2026-10-05T10:00:00Z") }
  );
  assert.deepEqual(
    resolveSessionClosureEnforcement(tenant(), cashier({ enforceSessionClosure: true })),
    { enforced: true, source: "CASHIER", enforcedFrom: d("2026-01-01T08:00:00Z") }
  );

  // Tenant default: start is the later of the tenant start and the cashier's creation.
  const defaultOn = tenant({
    enforceSessionClosureByDefault: true,
    sessionClosureEnforcedFrom: d("2026-10-01T06:00:00Z"),
  });
  assert.deepEqual(resolveSessionClosureEnforcement(defaultOn, cashier()), {
    enforced: true,
    source: "TENANT_DEFAULT",
    enforcedFrom: d("2026-10-01T06:00:00Z"),
  });
  assert.deepEqual(
    resolveSessionClosureEnforcement(defaultOn, cashier({ createdAt: d("2026-11-15T08:00:00Z") })),
    { enforced: true, source: "TENANT_DEFAULT", enforcedFrom: d("2026-11-15T08:00:00Z") }
  );

  // Tenant default without a tenant start date falls back to the settings change.
  assert.deepEqual(
    resolveSessionClosureEnforcement(
      tenant({
        enforceSessionClosureByDefault: true,
        sessionClosureSettingsUpdatedAt: d("2026-10-03T06:00:00Z"),
      }),
      cashier()
    ),
    { enforced: true, source: "TENANT_DEFAULT", enforcedFrom: d("2026-10-03T06:00:00Z") }
  );

  // Per-cashier resolution keeps each record's own decision and start date.
  const exempt = cashier({ enforceSessionClosure: false });
  const enrolled = cashier({ enforceSessionClosure: true, sessionClosureEnforcedFrom: d("2026-10-07T06:00:00Z") });
  const perCashier = resolveEnforcementPerCashier(tenant(), [exempt, enrolled]);
  assert.equal(perCashier.length, 2);
  assert.equal(perCashier[0].cashier, exempt);
  assert.deepEqual(perCashier[0].enforcement, { enforced: false, reason: "CASHIER_EXEMPT" });
  assert.equal(perCashier[1].cashier, enrolled);
  assert.deepEqual(perCashier[1].enforcement, {
    enforced: true,
    source: "CASHIER",
    enforcedFrom: d("2026-10-07T06:00:00Z"),
  });
  assert.deepEqual(resolveEnforcementPerCashier(tenant(), []), []);

  // Cash only.
  assert.equal(isCashDisbursementSubjectToSessionClosure({ payoutMethod: "CASH" }), true);
  assert.equal(isCashDisbursementSubjectToSessionClosure({ paymentTypeIsCash: true }), true);
  assert.equal(isCashDisbursementSubjectToSessionClosure({ payoutMethod: "MOBILE_MONEY" }), false);
  assert.equal(isCashDisbursementSubjectToSessionClosure({ payoutMethod: "BANK_TRANSFER" }), false);
  assert.equal(isCashDisbursementSubjectToSessionClosure({ paymentTypeIsCash: false }), false);
  assert.equal(isCashDisbursementSubjectToSessionClosure({}), false);

  // Harare day boundary is 22:00Z.
  assert.equal(toBusinessDateString(d("2026-10-06T21:59:00Z")), "2026-10-06");
  assert.equal(toBusinessDateString(d("2026-10-06T22:00:00Z")), "2026-10-07");

  // Sessions on or after the Harare date of enforcedFrom are counted.
  const enforcedFrom = d("2026-10-06T23:30:00Z"); // Harare 2026-10-07 01:30
  assert.equal(isSessionCountedForEnforcement(d("2026-10-07"), enforcedFrom), true);
  assert.equal(isSessionCountedForEnforcement(d("2026-10-08"), enforcedFrom), true);
  assert.equal(isSessionCountedForEnforcement(d("2026-10-06"), enforcedFrom), false);
}

  // Module enabled later than cashier enforce date: use module enabled time
  assert.deepEqual(
    resolveSessionClosureEnforcement(
      tenant({
        isTellerManagementModuleOn: true,
        enforceSessionClosureByDefault: false,
        tellerModuleEnabledAt: d("2026-10-07T12:00:00Z"),
      }),
      cashier({ enforceSessionClosure: true, sessionClosureEnforcedFrom: d("2026-10-01T06:00:00Z") })
    ),
    { enforced: true, source: "CASHIER", enforcedFrom: d("2026-10-07T12:00:00Z") }
  );

  // Inherit after explicit: uses flag change time for enforcement start
  assert.deepEqual(
    resolveSessionClosureEnforcement(
      tenant({ enforceSessionClosureByDefault: true, sessionClosureEnforcedFrom: d("2026-10-05T06:00:00Z") }),
      cashier({ enforceSessionClosure: null, sessionClosureFlagUpdatedAt: d("2026-10-06T10:00:00Z") })
    ),
    { enforced: true, source: "TENANT_DEFAULT", enforcedFrom: d("2026-10-06T10:00:00Z") }
  );

  // Module enabled later than TENANT_DEFAULT start: use module enabled time
  assert.deepEqual(
    resolveSessionClosureEnforcement(
      tenant({
        isTellerManagementModuleOn: true,
        enforceSessionClosureByDefault: true,
        sessionClosureEnforcedFrom: d("2026-10-01T06:00:00Z"),
        tellerModuleEnabledAt: d("2026-10-08T12:00:00Z"),
      }),
      cashier()
    ),
    { enforced: true, source: "TENANT_DEFAULT", enforcedFrom: d("2026-10-08T12:00:00Z") }
  );

  run();
