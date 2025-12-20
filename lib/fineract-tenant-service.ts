import { headers } from "next/headers";
import { getTenantFromHeaders } from "./tenant-service";

/**
 * Get the Fineract tenant ID for the current request
 * Uses tenant slug directly as Fineract tenant ID, with "demo" as fallback
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
      console.warn("No tenant found, using goodfellow-training Fineract tenant");
      return process.env.FINERACT_TENANT_ID || "goodfellow-training";
    }

    // Use tenant slug directly as Fineract tenant ID
    // If no tenant slug, use "goodfellow-training" as fallback
    const fineractTenantId = tenant.slug || "goodfellow-training";

    console.log(
      `Mapped tenant ${tenant.slug} to Fineract tenant: ${fineractTenantId}`
    );

    return fineractTenantId;
  } catch (error) {
    console.error("Error getting Fineract tenant ID:", error);
    return process.env.FINERACT_TENANT_ID || "goodfellow-training";
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
