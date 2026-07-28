export interface PaymentTypeLockGateInput {
  tenantFeatureEnabled: boolean;
  userExempt: boolean;
}

/**
 * Whether this user's payment type choice should be locked to cash only.
 * This gates payment-method visibility ONLY — it has no bearing on whether
 * teller/cashier get auto-resolved (see resolveRepaymentCashierAutoResolveDecision).
 */
export function isPaymentTypeLockedToCashForUser(
  input: PaymentTypeLockGateInput
): boolean {
  return input.tenantFeatureEnabled && !input.userExempt;
}

export interface RepaymentCashierAutoResolveDecisionInput {
  tenantFeatureEnabled: boolean;
  isCashier: boolean;
  hasActiveSession: boolean;
}

export type RepaymentCashierAutoResolveDecision =
  | { mode: "manual" }
  | { mode: "auto-resolved" }
  | { mode: "blocked" };

/**
 * Whether a cash repayment's teller/cashier should be auto-resolved,
 * blocked, or left to manual selection. Gated ONLY by the tenant feature
 * flag — applies to every user once the tenant has it on, exempt or not.
 */
export function resolveRepaymentCashierAutoResolveDecision(
  input: RepaymentCashierAutoResolveDecisionInput
): RepaymentCashierAutoResolveDecision {
  if (!input.tenantFeatureEnabled) {
    return { mode: "manual" };
  }
  if (input.isCashier && input.hasActiveSession) {
    return { mode: "auto-resolved" };
  }
  return { mode: "blocked" };
}
