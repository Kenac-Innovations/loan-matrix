/**
 * Check if the lead contracts backend is enabled for a tenant
 *
 * Uses the LEAD_CONTRACTS_BACKEND_TENANTS env var:
 * - "*" means all tenants are enabled
 * - Unset or empty means disabled for all
 * - Comma-separated list of slugs means enabled for those tenants (case-insensitive, trimmed)
 */
export function isLeadContractsBackendEnabled(tenantSlug: string | null): boolean {
  if (!tenantSlug) {
    return false;
  }

  const enabledTenantsEnv = process.env.LEAD_CONTRACTS_BACKEND_TENANTS?.trim();
  if (!enabledTenantsEnv) {
    return false;
  }

  if (enabledTenantsEnv === "*") {
    return true;
  }

  const enabledTenants = enabledTenantsEnv
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return enabledTenants.includes(tenantSlug.toLowerCase());
}
