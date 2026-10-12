import {
  resolveSupersetRole,
  type ResolvedTenantSupersetConfig,
  type SupersetRole,
} from "./superset-config";

export interface SupersetLaunchPolicyInput {
  sessionUser: { username?: string | null; userId?: number | null } | null;
  sessionTenantId: string | null;
  tenantId: string | null;
  tenantSlug: string | null;
  reportsEnabled: boolean;
  supersetRequestedEnabled: boolean;
  config: ResolvedTenantSupersetConfig;
}

export type SupersetLaunchDecision =
  | {
      allowed: true;
      status: 200;
      role: SupersetRole;
      username: string;
      userId: number;
      tenantSlug: string;
      baseUrl: string;
    }
  | {
      allowed: false;
      status: 401 | 403 | 404 | 503;
      reason:
        | "unauthenticated"
        | "tenant_not_found"
        | "tenant_mismatch"
        | "reports_disabled"
        | "superset_disabled"
        | "superset_misconfigured";
    };

export function evaluateSupersetLaunchPolicy(
  input: SupersetLaunchPolicyInput
): SupersetLaunchDecision {
  const username = input.sessionUser?.username?.trim();
  const userId = input.sessionUser?.userId;
  if (!username || typeof userId !== "number") {
    return { allowed: false, status: 401, reason: "unauthenticated" };
  }

  if (!input.tenantId || !input.tenantSlug) {
    return { allowed: false, status: 404, reason: "tenant_not_found" };
  }

  if (input.sessionTenantId !== input.tenantId) {
    return { allowed: false, status: 403, reason: "tenant_mismatch" };
  }

  if (input.tenantSlug !== "goodfellow") {
    return { allowed: false, status: 404, reason: "superset_disabled" };
  }

  if (!input.reportsEnabled) {
    return { allowed: false, status: 403, reason: "reports_disabled" };
  }

  if (!input.supersetRequestedEnabled) {
    return { allowed: false, status: 404, reason: "superset_disabled" };
  }

  if (!input.config.enabled || !input.config.baseUrl) {
    return {
      allowed: false,
      status: 503,
      reason: "superset_misconfigured",
    };
  }

  return {
    allowed: true,
    status: 200,
    role: resolveSupersetRole(username, input.config.creatorUsernames),
    username,
    userId,
    tenantSlug: input.tenantSlug,
    baseUrl: input.config.baseUrl,
  };
}
