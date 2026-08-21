/** Returns true only for the dedicated Agricultural and Rural Development Authority tenant. */
export function isArdaTenantSlug(tenantSlug?: string | null): boolean {
  return (tenantSlug || "").trim().toLowerCase() === "arda";
}
