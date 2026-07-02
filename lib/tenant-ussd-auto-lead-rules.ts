import type {
  TenantSettings,
  TenantUssdAutoLeadRule,
} from "@/shared/types/tenant";

function sanitizeRule(rule: unknown): TenantUssdAutoLeadRule | null {
  if (!rule || typeof rule !== "object") {
    return null;
  }

  const candidate = rule as Record<string, unknown>;
  const loanProductId = Number(candidate.loanProductId);

  if (!Number.isFinite(loanProductId) || loanProductId <= 0) {
    return null;
  }

  return {
    enabled: candidate.enabled !== false,
    loanProductId,
  };
}

export function getTenantUssdAutoLeadRules(
  settings: TenantSettings | Record<string, unknown> | null | undefined
): TenantUssdAutoLeadRule[] {
  if (!settings || typeof settings !== "object") {
    return [];
  }

  const rawRules = (settings as TenantSettings).ussdAutoLeadRules;
  if (!Array.isArray(rawRules)) {
    return [];
  }

  return rawRules
    .map((rule) => sanitizeRule(rule))
    .filter((rule): rule is TenantUssdAutoLeadRule => rule !== null);
}

export function sanitizeTenantUssdAutoLeadRulesInput(
  input: unknown
): TenantUssdAutoLeadRule[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((rule) => sanitizeRule(rule))
    .filter((rule): rule is TenantUssdAutoLeadRule => rule !== null);
}

export function findMatchingUssdAutoLeadRule(
  rules: TenantUssdAutoLeadRule[],
  loanProductId: number | null | undefined
): TenantUssdAutoLeadRule | null {
  if (!Number.isFinite(loanProductId) || loanProductId == null) {
    return null;
  }

  return (
    rules.find((rule) => rule.enabled !== false && rule.loanProductId === loanProductId) ??
    null
  );
}
