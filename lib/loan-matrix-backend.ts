import { getSession } from "@/lib/auth";
import { getTenantAndFineractInfo } from "@/lib/fineract-tenant-service";

/**
 * Context needed to call the loan-matrix backend
 */
export interface LoanMatrixBackendContext {
  fineractTenantId: string;
  tenantSlug: string | null;
  actingUserId: number;
  actingUsername: string;
}

/**
 * Get the loan-matrix backend context from the current session
 * Throws if not signed in or tenant cannot be resolved
 */
export async function getLoanMatrixBackendContext(): Promise<LoanMatrixBackendContext> {
  const [session, tenantInfo] = await Promise.all([
    getSession(),
    getTenantAndFineractInfo(),
  ]);

  if (!session?.user?.id || !session.user.userId || !session.user.name) {
    throw new Error("You must be signed in to access backend services");
  }

  const fineractTenantId = tenantInfo.fineractTenantId;
  if (!fineractTenantId) {
    throw new Error("Could not resolve tenant for backend services");
  }

  return {
    fineractTenantId,
    tenantSlug: tenantInfo.tenant?.slug ?? null,
    actingUserId: session.user.userId,
    actingUsername: session.user.name,
  };
}

/**
 * Fetch from the loan-matrix backend with proper headers
 * @param path The API path (e.g., "/api/v1/leads/123/contracts")
 * @param init Request init options
 * @param ctx Backend context with tenant and user info
 * @param options Additional options
 * @param options.actingUser Whether to include X-Acting-User-Id and X-Acting-Username headers
 * @returns The response from the backend
 */
export async function loanMatrixBackendFetch(
  path: string,
  init: RequestInit = {},
  ctx: LoanMatrixBackendContext,
  options: { actingUser?: boolean } = {}
): Promise<Response> {
  const baseUrl = process.env.LOAN_MATRIX_BACKEND_URL?.trim();
  if (!baseUrl) {
    throw new Error("LOAN_MATRIX_BACKEND_URL is not configured");
  }

  const url = `${baseUrl.replace(/\/+$/, "")}${path}`;
  const apiKey = process.env.LOAN_MATRIX_BE_INTERNAL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("LOAN_MATRIX_BE_INTERNAL_API_KEY is not configured");
  }

  const headers: Record<string, string> = {
    "X-Tenant-Id": ctx.fineractTenantId,
    "X-Internal-Api-Key": apiKey,
  };

  if (init.headers) {
    Object.assign(headers, init.headers);
  }

  if (options.actingUser) {
    headers["X-Acting-User-Id"] = String(ctx.actingUserId);
    headers["X-Acting-Username"] = ctx.actingUsername;
  }

  return fetch(url, {
    ...init,
    cache: "no-store",
    headers,
  });
}
