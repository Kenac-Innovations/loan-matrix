import { getTenantFromHeaders } from "./tenant-service";

/**
 * Mapping from application tenant slugs to Fineract tenant IDs
 * Add entries here when the Fineract tenant ID differs from the app tenant slug.
 */
const TENANT_TO_FINERACT_MAPPING: Record<string, string> = {};

/**
 * Get the Fineract tenant ID for the current request
 * Uses tenant slug mapping or falls back to slug directly
 */
export async function getFineractTenantId(): Promise<string> {
  try {
    const tenant = await getTenantFromHeaders();

    console.log("Tenant Debug:", {
      tenant,
      tenantSlug: tenant?.slug,
      tenantName: tenant?.name,
    });

  if (!tenant) {
    console.warn(
      "No tenant found, using goodfellow Fineract tenant"
    );
    return process.env.FINERACT_TENANT_ID || "goodfellow";
  }

  // Check if there's a specific mapping for this tenant
  // Otherwise use tenant slug directly, or "goodfellow" as fallback
  const fineractTenantId =
    TENANT_TO_FINERACT_MAPPING[tenant.slug] ||
    tenant.slug ||
    "goodfellow";

    console.log(
      `Mapped tenant ${tenant.slug} to Fineract tenant: ${fineractTenantId}`
    );

    return fineractTenantId;
  } catch (error) {
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
