import { resolveFineractTenantId } from "./fineract-tenant-service";
import { prisma } from "./prisma";
import {
  getRequestedTenantSlugFromHeaders,
  getTenantBySlug,
} from "./tenant-service";

export interface LeadTenantContext {
  tenantId: string;
  tenantSlug: string;
  fineractTenantId: string;
}

export class LeadTenantContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadTenantContextError";
  }
}

/**
 * Produces the tenant context used for one lead operation request.
 *
 * The authenticated session is authoritative for local writes. The request
 * hostname must resolve to that same tenant so a stale or cross-tenant browser
 * context cannot create a local lead for a different tenant than Fineract.
 */
export function createLeadTenantContext(input: {
  sessionTenantId?: string | null;
  requestTenant: { id: string; slug: string };
  sessionTenant: { id: string; slug: string } | null;
}): LeadTenantContext {
  if (!input.sessionTenantId) {
    throw new LeadTenantContextError(
      "Your session has no tenant. Please sign out and sign in again."
    );
  }

  if (!input.sessionTenant || input.sessionTenant.id !== input.sessionTenantId) {
    throw new LeadTenantContextError(
      "The tenant in your session is no longer active. Please sign in again."
    );
  }

  if (input.requestTenant.id !== input.sessionTenant.id) {
    throw new LeadTenantContextError(
      "The request tenant does not match your signed-in tenant. Please return to your tenant workspace and try again."
    );
  }

  return Object.freeze({
    tenantId: input.sessionTenant.id,
    tenantSlug: input.sessionTenant.slug,
    fineractTenantId: resolveFineractTenantId({
      requestedSlug: input.requestTenant.slug,
      resolvedTenantSlug: input.sessionTenant.slug,
    }),
  });
}

/**
 * Resolves the tenant context for a Server Action that writes a lead.
 *
 * Server Actions do not receive a Request object, so this reads only the
 * browser-origin tenant headers. It intentionally has no environment or
 * default-tenant fallback: an authenticated user must write within the same
 * active tenant recorded in their session.
 */
export async function resolveLeadServerActionTenantContext(input: {
  sessionTenantId?: string | null;
}): Promise<LeadTenantContext> {
  const requestedTenantSlug = await getRequestedTenantSlugFromHeaders();

  if (!requestedTenantSlug) {
    throw new LeadTenantContextError(
      "Unable to determine your tenant workspace. Please return to your tenant workspace and try again."
    );
  }

  const [requestTenant, sessionTenant] = await Promise.all([
    getTenantBySlug(requestedTenantSlug),
    input.sessionTenantId
      ? prisma.tenant.findFirst({
          where: { id: input.sessionTenantId, isActive: true },
          select: { id: true, slug: true },
        })
      : Promise.resolve(null),
  ]);

  if (!requestTenant) {
    throw new LeadTenantContextError(
      "The requested tenant workspace is unavailable. Please sign in again."
    );
  }

  return createLeadTenantContext({
    sessionTenantId: input.sessionTenantId,
    requestTenant,
    sessionTenant,
  });
}
