import assert from "node:assert/strict";
import {
  isPaymentTypeLockedToCashForUser,
  resolveRepaymentCashierAutoResolveDecision,
} from "./repayment-cashier-auto-resolve-policy";

function run() {
  // isPaymentTypeLockedToCashForUser: only gates which payment types are
  // selectable. It must NOT affect whether teller/cashier get auto-resolved.
  assert.equal(
    isPaymentTypeLockedToCashForUser({
      tenantFeatureEnabled: true,
      userExempt: false,
    }),
    true,
    "locked to cash when tenant feature is on and user is not exempt"
  );

  assert.equal(
    isPaymentTypeLockedToCashForUser({
      tenantFeatureEnabled: true,
      userExempt: true,
    }),
    false,
    "not locked (free choice of payment methods) when user is exempt, even if tenant feature is on"
  );

  assert.equal(
    isPaymentTypeLockedToCashForUser({
      tenantFeatureEnabled: false,
      userExempt: false,
    }),
    false,
    "not locked when tenant feature is off"
  );

  assert.equal(
    isPaymentTypeLockedToCashForUser({
      tenantFeatureEnabled: false,
      userExempt: true,
    }),
    false,
    "not locked when tenant feature is off, regardless of exemption"
  );

  // resolveRepaymentCashierAutoResolveDecision: gated ONLY by the tenant
  // feature flag. Exemption must have no bearing here — auto-resolution
  // (or blocking) of teller/cashier applies to every user once the tenant
  // flag is on, exempt or not.
  assert.deepEqual(
    resolveRepaymentCashierAutoResolveDecision({
      tenantFeatureEnabled: false,
      isCashier: true,
      hasActiveSession: true,
    }),
    { mode: "manual" },
    "manual pickers when the tenant feature is off"
  );

  assert.deepEqual(
    resolveRepaymentCashierAutoResolveDecision({
      tenantFeatureEnabled: true,
      isCashier: true,
      hasActiveSession: true,
    }),
    { mode: "auto-resolved" },
    "auto-resolves when the tenant feature is on, user is a cashier, and their session is active"
  );

  assert.deepEqual(
    resolveRepaymentCashierAutoResolveDecision({
      tenantFeatureEnabled: true,
      isCashier: true,
      hasActiveSession: false,
    }),
    { mode: "blocked" },
    "blocks when the tenant feature is on and the cashier's session is not active"
  );

  assert.deepEqual(
    resolveRepaymentCashierAutoResolveDecision({
      tenantFeatureEnabled: true,
      isCashier: false,
      hasActiveSession: false,
    }),
    { mode: "blocked" },
    "blocks when the tenant feature is on and the user is not a cashier at all"
  );
}

run();
console.log("ok");
