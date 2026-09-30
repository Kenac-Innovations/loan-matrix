import type {
  TenantSettings,
  TenantUssdLoanChargeAttachment,
  TenantUssdAutoLeadRule,
} from "@/shared/types/tenant";

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return parsed > 0 ? parsed : null;
  }

  return null;
}

function sanitizeLoanChargeAttachment(
  value: unknown
): TenantUssdLoanChargeAttachment | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const mode = candidate.mode;

  if (mode === "NONE") {
    if (
      candidate.chargeIds !== undefined &&
      (!Array.isArray(candidate.chargeIds) || candidate.chargeIds.length > 0)
    ) {
      return null;
    }
    return { mode: "NONE" };
  }

  if (mode !== "SELECTED" || !Array.isArray(candidate.chargeIds)) {
    return null;
  }

  const chargeIds = candidate.chargeIds.map(parsePositiveInteger);
  if (
    chargeIds.some((chargeId) => chargeId === null) ||
    chargeIds.length === 0
  ) {
    return null;
  }

  const canonicalChargeIds = chargeIds as number[];
  if (new Set(canonicalChargeIds).size !== canonicalChargeIds.length) {
    return null;
  }

  return { mode: "SELECTED", chargeIds: canonicalChargeIds };
}

function sanitizeRule(rule: unknown): TenantUssdAutoLeadRule | null {
  if (!rule || typeof rule !== "object") {
    return null;
  }

  const candidate = rule as Record<string, unknown>;
  const loanProductId = parsePositiveInteger(candidate.loanProductId);

  if (loanProductId === null) {
    return null;
  }

  const loanChargeAttachment = sanitizeLoanChargeAttachment(
    candidate.loanChargeAttachment
  );
  if (loanChargeAttachment === null) {
    return null;
  }

  return {
    enabled: candidate.enabled !== false,
    loanProductId,
    ...(loanChargeAttachment ? { loanChargeAttachment } : {}),
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
  if (loanProductId == null || !Number.isInteger(loanProductId) || loanProductId <= 0) {
    return null;
  }

  return (
    rules.find((rule) => rule.enabled !== false && rule.loanProductId === loanProductId) ??
    null
  );
}
