export interface RepaymentCashierAutoResolveGateInput {
  tenantFeatureEnabled: boolean;
  userExempt: boolean;
}

export function isAutoResolveApplicableForUser(
  input: RepaymentCashierAutoResolveGateInput
): boolean {
  return input.tenantFeatureEnabled && !input.userExempt;
}

export interface RepaymentCashierAutoResolveDecisionInput {
  autoResolveApplicable: boolean;
  isCashier: boolean;
}

export type RepaymentCashierAutoResolveDecision =
  | { mode: "manual" }
  | { mode: "auto-resolved" }
  | { mode: "blocked" };

export function resolveRepaymentCashierAutoResolveDecision(
  input: RepaymentCashierAutoResolveDecisionInput
): RepaymentCashierAutoResolveDecision {
  if (!input.autoResolveApplicable) {
    return { mode: "manual" };
  }
  if (input.isCashier) {
    return { mode: "auto-resolved" };
  }
  return { mode: "blocked" };
}
