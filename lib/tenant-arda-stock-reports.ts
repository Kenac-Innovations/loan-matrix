import { isArdaTenantSlug } from "@/lib/arda-tenant";

export function isArdaStockReportsEnabled(input: {
  tenantSlug?: string | null;
  tenantSettings?: unknown;
}): boolean {
  if (!isArdaTenantSlug(input.tenantSlug)) return false;
  if (
    !input.tenantSettings ||
    typeof input.tenantSettings !== "object" ||
    Array.isArray(input.tenantSettings)
  ) {
    return false;
  }

  const features = (input.tenantSettings as { features?: unknown }).features;
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    return false;
  }

  return (
    (features as { ardaStockReports?: unknown }).ardaStockReports === true
  );
}
