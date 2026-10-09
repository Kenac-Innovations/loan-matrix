import { headers } from "next/headers";
import {
  getRequestedTenantSlugFromHeaders,
  getTenantFromHeaders,
} from "./tenant-service";

/**
 * Mapping from application tenant slugs to Fineract tenant IDs
 * Add entries here when the Fineract tenant ID differs from the app tenant slug
 */
const TENANT_TO_FINERACT_MAPPING: Record<string, string> = {
  // goodfellow maps directly (no transformation needed)
  // Add more mappings as needed, e.g.:
  // "another-tenant": "another-fineract-id",
};

export class FineractTenantResolutionError extends Error {
  constructor(readonly tenantSlug: string) {
    super(`Fineract tenant \"${tenantSlug}\" is not configured for this request`);
    this.name = "FineractTenantResolutionError";
  }
}

export function resolveFineractTenantId(input: {
  requestedSlug: string;
  resolvedTenantSlug?: string | null;
  fallbackTenantId?: string;
}): string {
  const requestedSlug = input.requestedSlug.trim().toLowerCase();
  const resolvedTenantSlug = input.resolvedTenantSlug?.trim().toLowerCase();

  if (requestedSlug === "arda" && resolvedTenantSlug !== "arda") {
    throw new FineractTenantResolutionError("arda");
  }

  if (resolvedTenantSlug) {
    return TENANT_TO_FINERACT_MAPPING[resolvedTenantSlug] || resolvedTenantSlug;
  }

  if (requestedSlug) {
    throw new FineractTenantResolutionError(requestedSlug);
  }

  return input.fallbackTenantId || "goodfellow";
}

/**
 * Get the Fineract tenant ID for the current request
 * Uses tenant slug mapping or falls back to slug directly
 */
export async function getFineractTenantId(): Promise<string> {
  try {
    const requestedSlug = await getRequestedTenantSlugFromHeaders();
    const tenant = await getTenantFromHeaders();

    const fineractTenantId = resolveFineractTenantId({
      requestedSlug,
      resolvedTenantSlug: tenant?.slug,
      fallbackTenantId: process.env.FINERACT_TENANT_ID || "goodfellow",
    });

    console.log(
      `Mapped tenant ${tenant?.slug || "legacy fallback"} to Fineract tenant: ${fineractTenantId}`
    );

    return fineractTenantId;
  } catch (error) {
    if (error instanceof FineractTenantResolutionError) {
      throw error;
    }

    console.error("Error getting Fineract tenant ID:", error);
    return process.env.FINERACT_TENANT_ID || "goodfellow";
  }
}

/**
 * Get tenant info and Fineract tenant ID together
 */
export async function getTenantAndFineractInfo() {
  const tenant = await getTenantFromHeaders();
  const fineractTenantId = await getFineractTenantId();

  return {
    tenant,
    fineractTenantId,
  };
}
