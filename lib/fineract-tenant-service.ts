import { headers } from "next/headers";
import { getTenantFromHeaders } from "./tenant-service";

/**
 * Get the Fineract tenant ID for the current request
 * This extracts tenant info from subdomain and maps it to Fineract tenant ID
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
      console.warn("No tenant found, using default Fineract tenant");
      return "default";
    }

    // Map tenant slug to Fineract tenant ID
    // You can customize this mapping based on your Fineract setup
    const tenantMapping: Record<string, string> = {
      default: "default",
      demo: "demo",
      goodfellow: "goodfellow",
      acme: "acme",
      // Add more mappings as needed
    };

    const fineractTenantId = tenantMapping[tenant.slug] || tenant.slug;

    console.log(
      `Mapped tenant ${tenant.slug} to Fineract tenant: ${fineractTenantId}`
    );

    return fineractTenantId;
  } catch (error) {
    console.error("Error getting Fineract tenant ID:", error);
    return "default";
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
