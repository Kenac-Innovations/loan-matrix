import assert from "node:assert/strict";
import {
  isAutoResolveApplicableForUser,
  resolveRepaymentCashierAutoResolveDecision,
} from "./repayment-cashier-auto-resolve-policy";

function run() {
  // isAutoResolveApplicableForUser
  assert.equal(
    isAutoResolveApplicableForUser({
      tenantFeatureEnabled: true,
      userExempt: false,
    }),
    true,
    "applicable when tenant feature is on and user is not exempt"
  );

  assert.equal(
    isAutoResolveApplicableForUser({
      tenantFeatureEnabled: false,
      userExempt: false,
    }),
    false,
    "not applicable when tenant feature is off, regardless of exemption"
  );

  assert.equal(
    isAutoResolveApplicableForUser({
      tenantFeatureEnabled: true,
      userExempt: true,
    }),
    false,
    "not applicable when user is exempt, even if tenant feature is on"
  );

  assert.equal(
    isAutoResolveApplicableForUser({
      tenantFeatureEnabled: false,
      userExempt: true,
    }),
    false,
    "not applicable when both tenant feature is off and user is exempt"
  );

  // resolveRepaymentCashierAutoResolveDecision
  assert.deepEqual(
    resolveRepaymentCashierAutoResolveDecision({
      autoResolveApplicable: false,
      isCashier: true,
      hasActiveSession: true,
    }),
    { mode: "manual" },
    "falls back to manual pickers when not applicable, even for a cashier with an active session"
  );

  assert.deepEqual(
    resolveRepaymentCashierAutoResolveDecision({
      autoResolveApplicable: true,
      isCashier: true,
      hasActiveSession: true,
    }),
    { mode: "auto-resolved" },
    "auto-resolves when applicable and user is a cashier with an active session"
  );

  assert.deepEqual(
    resolveRepaymentCashierAutoResolveDecision({
      autoResolveApplicable: true,
      isCashier: true,
      hasActiveSession: false,
    }),
    { mode: "cash-blocked" },
    "blocks cash when applicable but the cashier has no active session"
  );

  assert.deepEqual(
    resolveRepaymentCashierAutoResolveDecision({
      autoResolveApplicable: true,
      isCashier: false,
      hasActiveSession: false,
    }),
    { mode: "cash-blocked" },
    "blocks cash when applicable but the user is not a cashier at all"
  );
}

run();
console.log("ok");
