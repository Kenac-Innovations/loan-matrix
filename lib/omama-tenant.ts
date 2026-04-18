export function normalizeTenantSlug(tenantSlug?: string | null): string {
  return (tenantSlug || "").trim().toLowerCase();
}

export function isOmamaTenantSlug(tenantSlug?: string | null): boolean {
  const normalized = normalizeTenantSlug(tenantSlug);
  return normalized === "omama" || normalized === "omama-training";
}

export function extractTenantSlugFromHostname(
  hostname?: string | null
): string | null {
  const normalizedHost = (hostname || "").trim().toLowerCase().split(":")[0];
  if (!normalizedHost) return null;

  if (normalizedHost === "localhost" || normalizedHost === "127.0.0.1") {
    return null;
  }

  if (normalizedHost.endsWith(".localhost")) {
    const subdomain = normalizedHost.replace(".localhost", "");
    return subdomain || null;
  }

  const parts = normalizedHost.split(".");
  if (parts.length > 2) {
    return parts[0] || null;
  }

  return null;
}

export function isOmamaTenantHostname(hostname?: string | null): boolean {
  return isOmamaTenantSlug(extractTenantSlugFromHostname(hostname));
}
