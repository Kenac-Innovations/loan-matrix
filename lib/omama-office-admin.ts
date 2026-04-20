import { isOmamaTenantSlug } from "@/lib/omama-tenant";

type RoleLike = {
  name?: string | null;
  disabled?: boolean | null;
};

function normalizeRoleName(name?: string | null): string {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function hasOmamaOfficeAdminRole(roles: RoleLike[] | null | undefined): boolean {
  if (!Array.isArray(roles)) return false;

  const allowed = new Set(["admin", "administrator", "app administrator"]);
  return roles.some((role) => {
    if (role?.disabled) return false;
    const normalizedRoleName = normalizeRoleName(role?.name);
    return (
      allowed.has(normalizedRoleName) ||
      normalizedRoleName.endsWith(" admin") ||
      normalizedRoleName.endsWith(" administrator")
    );
  });
}

export function shouldUseOmamaOfficeAdminDashboard(args: {
  tenantSlug?: string | null;
  featureEnabled?: boolean | null;
  roles?: RoleLike[] | null;
}): boolean {
  const isOmamaTenant = isOmamaTenantSlug(args.tenantSlug);
  const isEnabledForTenant = isOmamaTenant || args.featureEnabled === true;

  // Omama and Omama Training should always expose the office-admin dashboard
  // when the signed-in user is in an allowed admin role.
  return (
    isOmamaTenant &&
    isEnabledForTenant &&
    hasOmamaOfficeAdminRole(args.roles)
  );
}

export function matchesOfficeName(
  candidate: string | null | undefined,
  officeName: string | null | undefined
): boolean {
  const left = (candidate || "").trim().toLowerCase();
  const right = (officeName || "").trim().toLowerCase();
  if (!left || !right) return false;
  return left === right;
}
