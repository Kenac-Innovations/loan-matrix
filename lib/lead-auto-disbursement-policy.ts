import type {
  AutoDisbursementDecision,
  TenantAutoProgressToDisbursementRule,
  TenantSettings,
} from "@/shared/types/tenant";

type LeadLike = {
  userId?: string | null;
  loanProductId?: number | null;
  currentStageId?: string | null;
  currentStage?: {
    order?: number | null;
    fineractStatus?: string | null;
    name?: string | null;
  } | null;
  stateMetadata?: unknown;
};

type StageOrderLookup =
  | Map<string, number | null | undefined>
  | Record<string, number | null | undefined>
  | null
  | undefined;

function getRules(
  settings: TenantSettings | Record<string, unknown> | null | undefined
): TenantAutoProgressToDisbursementRule[] {
  if (!settings || typeof settings !== "object") {
    return [];
  }

  const rules = (settings as TenantSettings).autoProgressToDisbursementRules;
  return Array.isArray(rules) ? rules : [];
}

export function findMatchingAutoDisbursementRule(
  settings: TenantSettings | Record<string, unknown> | null | undefined,
  lead: LeadLike,
  stageOrderLookup?: StageOrderLookup
): TenantAutoProgressToDisbursementRule | null {
  const loanProductId = lead.loanProductId ?? null;
  const currentStageId = lead.currentStageId ?? null;
  const currentStageOrder = resolveStageOrder(
    lead.currentStage?.order ?? null,
    currentStageId,
    stageOrderLookup
  );

  if (!loanProductId || !currentStageId) {
    return null;
  }

  const eligibleRules = getRules(settings).filter(
    (rule) =>
      rule.enabled !== false &&
      Number(rule.loanProductId) === Number(loanProductId)
  );

  if (eligibleRules.length === 0) {
    return null;
  }

  if (currentStageOrder == null) {
    return eligibleRules.find((rule) => rule.triggerStageId === currentStageId) || null;
  }

  const orderedMatches = eligibleRules
    .map((rule) => ({
      rule,
      triggerStageOrder: resolveStageOrder(null, rule.triggerStageId, stageOrderLookup),
    }))
    .filter(
      (
        candidate
      ): candidate is {
        rule: TenantAutoProgressToDisbursementRule;
        triggerStageOrder: number;
      } => Number.isFinite(candidate.triggerStageOrder)
    )
    .filter((candidate) => candidate.triggerStageOrder <= currentStageOrder)
    .sort((left, right) => right.triggerStageOrder - left.triggerStageOrder);

  if (orderedMatches.length > 0) {
    return orderedMatches[0].rule;
  }

  return (
    eligibleRules.find((rule) => rule.triggerStageId === currentStageId) || null
  );
}

function resolveStageOrder(
  fallbackOrder: number | null | undefined,
  stageId: string | null | undefined,
  stageOrderLookup: StageOrderLookup
): number | null {
  if (Number.isFinite(fallbackOrder as number)) {
    return Number(fallbackOrder);
  }

  if (!stageId || !stageOrderLookup) {
    return null;
  }

  const lookupValue =
    stageOrderLookup instanceof Map
      ? stageOrderLookup.get(stageId)
      : stageOrderLookup[stageId];

  return Number.isFinite(lookupValue as number) ? Number(lookupValue) : null;
}

export function isAutoDisbursementDecisionAllowed(
  rule: Pick<TenantAutoProgressToDisbursementRule, "allowedCdeDecisions"> | null | undefined,
  decision: string | null | undefined
): boolean {
  if (!rule || !decision) {
    return false;
  }

  return rule.allowedCdeDecisions.includes(
    decision as AutoDisbursementDecision
  );
}

export function getAutoDisbursementIneligibilityReason(
  lead: LeadLike
): string | null {
  const autoDisbursement =
    (lead.stateMetadata as Record<string, unknown> | null | undefined)
      ?.autoDisbursement as
      | {
          status?: string | null;
        }
      | undefined;

  if (autoDisbursement?.status === "completed") {
    return "already_completed";
  }

  const fineractStatus = (lead.currentStage?.fineractStatus || "")
    .trim()
    .toLowerCase();
  const stageName = (lead.currentStage?.name || "").trim().toLowerCase();

  if (
    fineractStatus.includes("disburs") ||
    stageName.includes("disburs")
  ) {
    return "already_disbursed";
  }

  return null;
}

export function resolveAutoProgressTriggeredBy(
  lead: LeadLike,
  fallbackTriggeredBy: string
): string {
  const originatorUserId = Number.parseInt(lead.userId ?? "", 10);

  if (Number.isFinite(originatorUserId) && originatorUserId > 0) {
    return String(originatorUserId);
  }

  return fallbackTriggeredBy;
}
