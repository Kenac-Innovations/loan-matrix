import type {
  AutoDisbursementDecision,
  TenantAutoProgressToDisbursementRule,
  TenantSettings,
} from "@/shared/types/tenant";

export const SUPPORTED_AUTO_DISBURSEMENT_DECISIONS: AutoDisbursementDecision[] =
  ["APPROVED", "MANUAL_REVIEW", "DECLINED"];

function isSupportedDecision(
  decision: unknown
): decision is AutoDisbursementDecision {
  return SUPPORTED_AUTO_DISBURSEMENT_DECISIONS.includes(
    decision as AutoDisbursementDecision
  );
}

function sanitizeRule(
  rule: unknown
): TenantAutoProgressToDisbursementRule | null {
  if (!rule || typeof rule !== "object") {
    return null;
  }

  const candidate = rule as Record<string, unknown>;
  const loanProductId = Number(candidate.loanProductId);
  const triggerStageId = String(candidate.triggerStageId || "").trim();
  const allowedCdeDecisions = Array.isArray(candidate.allowedCdeDecisions)
    ? candidate.allowedCdeDecisions.filter(isSupportedDecision)
    : [];

  if (!Number.isFinite(loanProductId) || loanProductId <= 0) {
    return null;
  }

  if (!triggerStageId || allowedCdeDecisions.length === 0) {
    return null;
  }

  return {
    enabled: candidate.enabled !== false,
    loanProductId,
    triggerStageId,
    allowedCdeDecisions: Array.from(new Set(allowedCdeDecisions)),
  };
}

export function getTenantAutoDisbursementRules(
  settings: TenantSettings | Record<string, unknown> | null | undefined
): TenantAutoProgressToDisbursementRule[] {
  if (!settings || typeof settings !== "object") {
    return [];
  }

  const rawRules = (settings as TenantSettings).autoProgressToDisbursementRules;
  if (!Array.isArray(rawRules)) {
    return [];
  }

  return rawRules
    .map((rule) => sanitizeRule(rule))
    .filter(
      (rule): rule is TenantAutoProgressToDisbursementRule => rule !== null
    );
}

export function sanitizeTenantAutoDisbursementRulesInput(
  input: unknown
): TenantAutoProgressToDisbursementRule[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((rule) => sanitizeRule(rule))
    .filter(
      (rule): rule is TenantAutoProgressToDisbursementRule => rule !== null
    );
}
