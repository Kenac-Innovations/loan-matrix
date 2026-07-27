import assert from "node:assert/strict";
import { resolveRepaymentCashierAutoResolveDecision } from "./repayment-cashier-auto-resolve-policy";

function run() {
  assert.deepEqual(
    resolveRepaymentCashierAutoResolveDecision({
      autoResolveApplicable: false,
      isCashier: true,
      hasActiveSession: true,
    }),
    { mode: "manual" },
    "falls back to manual pickers when the tenant feature is off, even for a cashier with an active session"
  );

  assert.deepEqual(
    resolveRepaymentCashierAutoResolveDecision({
      autoResolveApplicable: true,
      isCashier: true,
      hasActiveSession: true,
    }),
    { mode: "auto-resolved" },
    "auto-resolves when the tenant feature is on and user is a cashier with an active session"
  );

  assert.deepEqual(
    resolveRepaymentCashierAutoResolveDecision({
      autoResolveApplicable: true,
      isCashier: true,
      hasActiveSession: false,
    }),
    { mode: "cash-blocked" },
    "blocks cash when the tenant feature is on but the cashier has no active session"
  );

  assert.deepEqual(
    resolveRepaymentCashierAutoResolveDecision({
      autoResolveApplicable: true,
      isCashier: false,
      hasActiveSession: false,
    }),
    { mode: "cash-blocked" },
    "blocks cash when the tenant feature is on but the user is not a cashier at all"
  );
}

run();
console.log("ok");
