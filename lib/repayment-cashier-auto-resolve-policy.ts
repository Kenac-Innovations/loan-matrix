export interface RepaymentCashierAutoResolveDecisionInput {
  autoResolveApplicable: boolean;
  isCashier: boolean;
  hasActiveSession: boolean;
}

export type RepaymentCashierAutoResolveDecision =
  | { mode: "manual" }
  | { mode: "auto-resolved" }
  | { mode: "cash-blocked" };

export function resolveRepaymentCashierAutoResolveDecision(
  input: RepaymentCashierAutoResolveDecisionInput
): RepaymentCashierAutoResolveDecision {
  if (!input.autoResolveApplicable) {
    return { mode: "manual" };
  }
  if (input.isCashier && input.hasActiveSession) {
    return { mode: "auto-resolved" };
  }
  return { mode: "cash-blocked" };
}
