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
  const paymentServiceTenantId =
    typeof candidate.paymentServiceTenantId === "string"
      ? candidate.paymentServiceTenantId.trim()
      : "";

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
    incomeEvaluationRequired: candidate.incomeEvaluationRequired !== false,
    requireGeePaySettlement: candidate.requireGeePaySettlement === true,
    ...(candidate.requireGeePaySettlement === true &&
    candidate.processInBackend === true
      ? { processInBackend: true }
      : {}),
    ...(paymentServiceTenantId ? { paymentServiceTenantId } : {}),
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

/**
 * CDE continues to use income unless the configured product rule explicitly
 * opts out. This preserves the behaviour of every pre-existing rule.
 */
export function isIncomeEvaluationRequiredForLoanProduct(
  settings: TenantSettings | Record<string, unknown> | null | undefined,
  loanProductId: number | null | undefined
): boolean {
  if (!Number.isInteger(loanProductId) || Number(loanProductId) <= 0) {
    return true;
  }

  return !getTenantAutoDisbursementRules(settings)
    .filter((rule) => Number(rule.loanProductId) === Number(loanProductId))
    .some((rule) => rule.incomeEvaluationRequired === false);
}

/**
 * A second guard for the old Next.js worker. The backend listener normally
 * gives these applications BACKEND_QUEUED status before this worker can see
 * them, but keeping the ownership check here prevents an accidental CREATED
 * row from being processed by both runtimes.
 */
export function isBackendOwnedSalaryAdvanceRule(
  settings: TenantSettings | Record<string, unknown> | null | undefined,
  loanProductId: number | null | undefined
): boolean {
  if (!Number.isInteger(loanProductId) || Number(loanProductId) <= 0) {
    return false;
  }

  return getTenantAutoDisbursementRules(settings).some(
    (rule) =>
      rule.enabled !== false &&
      rule.loanProductId === Number(loanProductId) &&
      rule.requireGeePaySettlement === true &&
      rule.processInBackend === true
  );
}
