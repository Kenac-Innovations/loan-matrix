import {
  extractTenantSlugFromHostname,
  normalizeTenantSlug,
} from "./omama-tenant";

export function isGoodfellowTenantSlug(tenantSlug?: string | null): boolean {
  return normalizeTenantSlug(tenantSlug) === "goodfellow";
}

export function isGoodfellowTenantHostname(
  hostname?: string | null
): boolean {
  return isGoodfellowTenantSlug(extractTenantSlugFromHostname(hostname));
}

export function getLocalIsoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
