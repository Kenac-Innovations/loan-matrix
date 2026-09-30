import type {
  TenantSettings,
  TenantUssdLoanChargeAttachment,
  TenantUssdAutoLeadRule,
} from "@/shared/types/tenant";

export const SALARY_ADVANCE_LOAN_PRODUCT_ID = 13;

type FineractOption = {
  code?: unknown;
  value?: unknown;
};

type FineractCharge = {
  id?: unknown;
  active?: unknown;
  penalty?: unknown;
  chargeAppliesTo?: FineractOption;
  chargeTimeType?: FineractOption;
};

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

function normalizeOptionValue(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[\s_-]+/g, "")
    : "";
}

function isLoanCharge(charge: FineractCharge): boolean {
  const appliesToCode = normalizeOptionValue(charge.chargeAppliesTo?.code);
  const appliesToValue = normalizeOptionValue(charge.chargeAppliesTo?.value);

  return (
    appliesToCode === "chargeappliesto.loan" ||
    appliesToValue === "loan"
  );
}

function isSpecifiedDueDateCharge(charge: FineractCharge): boolean {
  const timeTypeCode = normalizeOptionValue(charge.chargeTimeType?.code);
  const timeTypeValue = normalizeOptionValue(charge.chargeTimeType?.value);

  return (
    timeTypeCode === "chargetimetype.specifiedduedate" ||
    timeTypeValue === "specifiedduedate"
  );
}

function getChargeId(charge: FineractCharge): number | null {
  return parsePositiveInteger(charge.id);
}

/**
 * Return true only for active, general Fineract charges that can be attached
 * to a loan at a specified due date. The client uses the same predicate for
 * display, but the API must always re-check it against the live pool.
 */
export function isEligibleTenantUssdLoanCharge(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const charge = value as FineractCharge;
  return (
    getChargeId(charge) !== null &&
    charge.active === true &&
    charge.penalty !== true &&
    isLoanCharge(charge) &&
    isSpecifiedDueDateCharge(charge)
  );
}

function extractChargePool(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const candidate = value as {
    pageItems?: unknown;
    content?: unknown;
    data?: unknown;
  };

  for (const items of [candidate.pageItems, candidate.content, candidate.data]) {
    if (Array.isArray(items)) {
      return items;
    }
  }

  return [];
}

/**
 * Resolve the IDs that are currently valid for the Salary Advance setting.
 * This accepts the response shapes used by the Fineract list endpoint so the
 * route can validate the exact live general charge pool without persisting
 * charge amounts, dates, or any other mutable charge fields.
 */
export function getEligibleTenantUssdLoanChargeIds(
  chargePool: unknown
): Set<number> {
  return new Set(
    extractChargePool(chargePool)
      .filter(isEligibleTenantUssdLoanCharge)
      .map((charge) => getChargeId(charge as FineractCharge))
      .filter((id): id is number => id !== null)
  );
}

/**
 * Find selected charge IDs that are not present as currently eligible live
 * Fineract charges. IDs are returned once, in the order they occur in rules.
 */
export function getInvalidTenantUssdLoanChargeIds(
  rules: TenantUssdAutoLeadRule[],
  chargePool: unknown
): number[] {
  const eligibleIds = getEligibleTenantUssdLoanChargeIds(chargePool);
  const invalidIds: number[] = [];
  const seen = new Set<number>();

  for (const rule of rules) {
    if (
      rule.loanProductId !== SALARY_ADVANCE_LOAN_PRODUCT_ID ||
      rule.loanChargeAttachment?.mode !== "SELECTED"
    ) {
      continue;
    }

    for (const chargeId of rule.loanChargeAttachment.chargeIds || []) {
      if (!eligibleIds.has(chargeId) && !seen.has(chargeId)) {
        seen.add(chargeId);
        invalidIds.push(chargeId);
      }
    }
  }

  return invalidIds;
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
