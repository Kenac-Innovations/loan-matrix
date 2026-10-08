import assert from "node:assert/strict";
import {
  modeFromFlag,
  flagFromMode,
  isEnforcementMode,
  nextCashierEnforcementFields,
  nextTenantSessionSettings,
  type EnforcementMode,
} from "./cashier-session-admin";

const d = (iso: string) => new Date(iso);

function run() {
  // ===== modeFromFlag / flagFromMode roundtrip =====
  assert.equal(modeFromFlag(true), "ENFORCE");
  assert.equal(modeFromFlag(false), "EXEMPT");
  assert.equal(modeFromFlag(null), "INHERIT");

  assert.equal(flagFromMode("ENFORCE"), true);
  assert.equal(flagFromMode("EXEMPT"), false);
  assert.equal(flagFromMode("INHERIT"), null);

  // Roundtrip
  const modes: EnforcementMode[] = ["ENFORCE", "EXEMPT", "INHERIT"];
  modes.forEach((mode) => {
    assert.equal(modeFromFlag(flagFromMode(mode)), mode);
  });

  // ===== isEnforcementMode =====
  assert.equal(isEnforcementMode("ENFORCE"), true);
  assert.equal(isEnforcementMode("EXEMPT"), true);
  assert.equal(isEnforcementMode("INHERIT"), true);
  assert.equal(isEnforcementMode("UNKNOWN"), false);
  assert.equal(isEnforcementMode(null), false);
  assert.equal(isEnforcementMode(123), false);

  // ===== nextCashierEnforcementFields =====

  // Transition to ENFORCE (was INHERIT): set enforcedFrom to now
  let result = nextCashierEnforcementFields(
    { enforceSessionClosure: null, sessionClosureEnforcedFrom: null },
    "ENFORCE",
    "user-123",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(result.enforceSessionClosure, true);
  assert.deepEqual(result.sessionClosureEnforcedFrom, d("2026-10-08T10:00:00Z"));
  assert.equal(result.sessionClosureFlagUpdatedBy, "user-123");
  assert.deepEqual(result.sessionClosureFlagUpdatedAt, d("2026-10-08T10:00:00Z"));

  // Transition to ENFORCE (was ENFORCE): preserve enforcedFrom
  result = nextCashierEnforcementFields(
    {
      enforceSessionClosure: true,
      sessionClosureEnforcedFrom: d("2026-10-01T12:00:00Z"),
    },
    "ENFORCE",
    "user-456",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(result.enforceSessionClosure, true);
  assert.deepEqual(result.sessionClosureEnforcedFrom, d("2026-10-01T12:00:00Z"));
  assert.equal(result.sessionClosureFlagUpdatedBy, "user-456");
  assert.deepEqual(result.sessionClosureFlagUpdatedAt, d("2026-10-08T10:00:00Z"));

  // Transition to EXEMPT: clear enforcedFrom
  result = nextCashierEnforcementFields(
    {
      enforceSessionClosure: true,
      sessionClosureEnforcedFrom: d("2026-10-01T12:00:00Z"),
    },
    "EXEMPT",
    "user-789",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(result.enforceSessionClosure, false);
  assert.equal(result.sessionClosureEnforcedFrom, null);
  assert.equal(result.sessionClosureFlagUpdatedBy, "user-789");

  // Transition to INHERIT: clear enforcedFrom
  result = nextCashierEnforcementFields(
    {
      enforceSessionClosure: true,
      sessionClosureEnforcedFrom: d("2026-10-01T12:00:00Z"),
    },
    "INHERIT",
    "user-admin",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(result.enforceSessionClosure, null);
  assert.equal(result.sessionClosureEnforcedFrom, null);

  // ===== nextTenantSessionSettings =====

  // No change: preserves existing enforcedFrom
  let settingsResult = nextTenantSessionSettings(
    {
      isTellerManagementModuleOn: true,
      enforceSessionClosureByDefault: true,
      sessionClosureEnforcedFrom: d("2026-10-01T00:00:00Z"),
      tellerModuleEnabledAt: null,
      cashVarianceTolerance: 100,
    },
    {},
    "user-123",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(settingsResult.ok, true);
  if (settingsResult.ok) {
    assert.deepEqual(settingsResult.data.sessionClosureEnforcedFrom, d("2026-10-01T00:00:00Z"));
    assert.equal(settingsResult.data.cashVarianceTolerance, 100);
  }

  // Transition from off to both-on: set enforcedFrom to now
  settingsResult = nextTenantSessionSettings(
    {
      isTellerManagementModuleOn: false,
      enforceSessionClosureByDefault: false,
      sessionClosureEnforcedFrom: null,
      tellerModuleEnabledAt: null,
      cashVarianceTolerance: 0,
    },
    {
      isTellerManagementModuleOn: true,
      enforceSessionClosureByDefault: true,
      cashVarianceTolerance: 50,
    },
    "admin-user",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(settingsResult.ok, true);
  if (settingsResult.ok) {
    assert.equal(settingsResult.data.isTellerManagementModuleOn, true);
    assert.equal(settingsResult.data.enforceSessionClosureByDefault, true);
    assert.deepEqual(settingsResult.data.sessionClosureEnforcedFrom, d("2026-10-08T10:00:00Z"));
    assert.equal(settingsResult.data.cashVarianceTolerance, 50);
    assert.equal(settingsResult.data.sessionClosureSettingsUpdatedBy, "admin-user");
  }

  // Transition from both-on to module-off: clear enforcedFrom
  settingsResult = nextTenantSessionSettings(
    {
      isTellerManagementModuleOn: true,
      enforceSessionClosureByDefault: true,
      sessionClosureEnforcedFrom: d("2026-10-01T00:00:00Z"),
      tellerModuleEnabledAt: d("2026-10-01T00:00:00Z"),
      cashVarianceTolerance: 100,
    },
    { isTellerManagementModuleOn: false },
    "admin-user",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(settingsResult.ok, true);
  if (settingsResult.ok) {
    assert.equal(settingsResult.data.isTellerManagementModuleOn, false);
    assert.equal(settingsResult.data.enforceSessionClosureByDefault, true);
    assert.equal(settingsResult.data.sessionClosureEnforcedFrom, null);
  }

  // Transition from both-on to default-off (module still on): clear enforcedFrom
  settingsResult = nextTenantSessionSettings(
    {
      isTellerManagementModuleOn: true,
      enforceSessionClosureByDefault: true,
      sessionClosureEnforcedFrom: d("2026-10-01T00:00:00Z"),
      tellerModuleEnabledAt: null,
      cashVarianceTolerance: 100,
    },
    { enforceSessionClosureByDefault: false },
    "admin-user",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(settingsResult.ok, true);
  if (settingsResult.ok) {
    assert.equal(settingsResult.data.isTellerManagementModuleOn, true);
    assert.equal(settingsResult.data.enforceSessionClosureByDefault, false);
    assert.equal(settingsResult.data.sessionClosureEnforcedFrom, null);
  }

  // Partial transition: module-on -> off, default remains on (not both-on -> clear)
  settingsResult = nextTenantSessionSettings(
    {
      isTellerManagementModuleOn: true,
      enforceSessionClosureByDefault: true,
      sessionClosureEnforcedFrom: d("2026-10-01T00:00:00Z"),
      tellerModuleEnabledAt: null,
      cashVarianceTolerance: 100,
    },
    { isTellerManagementModuleOn: false, enforceSessionClosureByDefault: true },
    "admin-user",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(settingsResult.ok, true);
  if (settingsResult.ok) {
    assert.equal(settingsResult.data.sessionClosureEnforcedFrom, null);
  }

  // Invalid tolerance (negative)
  settingsResult = nextTenantSessionSettings(
    {
      isTellerManagementModuleOn: true,
      enforceSessionClosureByDefault: true,
      sessionClosureEnforcedFrom: d("2026-10-01T00:00:00Z"),
      tellerModuleEnabledAt: null,
      cashVarianceTolerance: 100,
    },
    { cashVarianceTolerance: -10 },
    "admin-user",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(settingsResult.ok, false);
  if (!settingsResult.ok) {
    assert.match(settingsResult.error, /finite number/);
  }

  // Invalid tolerance (NaN)
  settingsResult = nextTenantSessionSettings(
    {
      isTellerManagementModuleOn: true,
      enforceSessionClosureByDefault: true,
      sessionClosureEnforcedFrom: d("2026-10-01T00:00:00Z"),
      tellerModuleEnabledAt: null,
      cashVarianceTolerance: 100,
    },
    { cashVarianceTolerance: NaN },
    "admin-user",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(settingsResult.ok, false);

  // Invalid tolerance (Infinity)
  settingsResult = nextTenantSessionSettings(
    {
      isTellerManagementModuleOn: true,
      enforceSessionClosureByDefault: true,
      sessionClosureEnforcedFrom: d("2026-10-01T00:00:00Z"),
      tellerModuleEnabledAt: null,
      cashVarianceTolerance: 100,
    },
    { cashVarianceTolerance: Infinity },
    "admin-user",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(settingsResult.ok, false);

  // Valid zero tolerance
  settingsResult = nextTenantSessionSettings(
    {
      isTellerManagementModuleOn: true,
      enforceSessionClosureByDefault: true,
      sessionClosureEnforcedFrom: d("2026-10-01T00:00:00Z"),
      tellerModuleEnabledAt: null,
      cashVarianceTolerance: 100,
    },
    { cashVarianceTolerance: 0 },
    "admin-user",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(settingsResult.ok, true);
  if (settingsResult.ok) {
    assert.equal(settingsResult.data.cashVarianceTolerance, 0);
  }

  // ===== tellerModuleEnabledAt =====

  // Module stays off: preserve tellerModuleEnabledAt (stays null)
  settingsResult = nextTenantSessionSettings(
    {
      isTellerManagementModuleOn: false,
      enforceSessionClosureByDefault: false,
      sessionClosureEnforcedFrom: null,
      tellerModuleEnabledAt: null,
      cashVarianceTolerance: 0,
    },
    { isTellerManagementModuleOn: false },
    "user-123",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(settingsResult.ok, true);
  if (settingsResult.ok) {
    assert.equal(settingsResult.data.tellerModuleEnabledAt, null);
  }

  // Module goes off->on: set tellerModuleEnabledAt to now
  settingsResult = nextTenantSessionSettings(
    {
      isTellerManagementModuleOn: false,
      enforceSessionClosureByDefault: false,
      sessionClosureEnforcedFrom: null,
      tellerModuleEnabledAt: null,
      cashVarianceTolerance: 0,
    },
    { isTellerManagementModuleOn: true },
    "user-123",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(settingsResult.ok, true);
  if (settingsResult.ok) {
    assert.deepEqual(settingsResult.data.tellerModuleEnabledAt, d("2026-10-08T10:00:00Z"));
  }

  // Module goes on->on: preserve tellerModuleEnabledAt
  settingsResult = nextTenantSessionSettings(
    {
      isTellerManagementModuleOn: true,
      enforceSessionClosureByDefault: false,
      sessionClosureEnforcedFrom: null,
      tellerModuleEnabledAt: d("2026-10-01T06:00:00Z"),
      cashVarianceTolerance: 0,
    },
    { isTellerManagementModuleOn: true },
    "user-123",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(settingsResult.ok, true);
  if (settingsResult.ok) {
    assert.deepEqual(settingsResult.data.tellerModuleEnabledAt, d("2026-10-01T06:00:00Z"));
  }

  // Module goes on->off: preserve tellerModuleEnabledAt (historic timestamp)
  settingsResult = nextTenantSessionSettings(
    {
      isTellerManagementModuleOn: true,
      enforceSessionClosureByDefault: false,
      sessionClosureEnforcedFrom: null,
      tellerModuleEnabledAt: d("2026-10-01T06:00:00Z"),
      cashVarianceTolerance: 0,
    },
    { isTellerManagementModuleOn: false },
    "user-123",
    d("2026-10-08T10:00:00Z")
  );
  assert.equal(settingsResult.ok, true);
  if (settingsResult.ok) {
    assert.deepEqual(settingsResult.data.tellerModuleEnabledAt, d("2026-10-01T06:00:00Z"));
  }

    console.log("All cashier-session-admin tests passed!");
}

run();
