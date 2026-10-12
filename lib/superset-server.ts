import "server-only";

import type { NextRequest } from "next/server";
import { getSession } from "./auth";
import {
  getTenantBySlug,
  extractTenantSlugFromRequest,
} from "./tenant-service";
import { getTenantFeatures } from "./tenant-features";
import {
  getTenantSupersetConfig,
  isTenantSupersetRequestedEnabled,
} from "./superset-config";
import {
  evaluateSupersetLaunchPolicy,
  type SupersetLaunchDecision,
} from "./superset-launch-policy";

export interface SupersetRequestContext {
  decision: SupersetLaunchDecision;
  displayName: string | null;
  email: string | null;
}

export async function resolveSupersetRequestContext(
  request: NextRequest
): Promise<SupersetRequestContext> {
  const [session, tenant] = await Promise.all([
    getSession(),
    getTenantBySlug(extractTenantSlugFromRequest(request)),
  ]);
  const settings = tenant?.settings;
  const decision = evaluateSupersetLaunchPolicy({
    sessionUser: session?.user
      ? {
          username: session.user.name,
          userId: session.user.userId,
        }
      : null,
    sessionTenantId: session?.user?.tenantId || null,
    tenantId: tenant?.id || null,
    tenantSlug: tenant?.slug || null,
    reportsEnabled: tenant ? getTenantFeatures(settings).reports : false,
    supersetRequestedEnabled: isTenantSupersetRequestedEnabled(settings),
    config: getTenantSupersetConfig(settings),
  });

  return {
    decision,
    displayName: session?.user?.name || null,
    email: session?.user?.email || null,
  };
}
