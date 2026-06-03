import { normalizeTenantSlug } from "@/lib/omama-tenant";

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

function hasRole(
  roles: RoleLike[] | null | undefined,
  matcher: (normalizedRoleName: string) => boolean
): boolean {
  if (!Array.isArray(roles)) return false;

  return roles.some((role) => {
    if (role?.disabled) return false;
    return matcher(normalizeRoleName(role?.name));
  });
}

export function hasOmamaGlobalAccessRole(
  roles: RoleLike[] | null | undefined
): boolean {
  return hasRole(roles, (roleName) => {
    return (
      roleName.includes("super") ||
      roleName.includes("admin") ||
      roleName.includes("head office") ||
      roleName.includes("headquarters") ||
      roleName.includes("authoriser") ||
      roleName.includes("authorizer")
    );
  });
}

export function hasOmamaOfficeScopedRole(
  roles: RoleLike[] | null | undefined
): boolean {
  return hasRole(roles, (roleName) => {
    return (
      roleName.includes("branch manager") ||
      roleName.includes("loan officer")
    );
  });
}

export function resolveOmamaOfficeScope(args: {
  tenantSlug?: string | null;
  roles?: RoleLike[] | null;
  officeId?: number | null;
  officeName?: string | null;
}) {
  if (normalizeTenantSlug(args.tenantSlug) !== "omama") {
    return null;
  }

  if (hasOmamaGlobalAccessRole(args.roles)) {
    return null;
  }

  if (!hasOmamaOfficeScopedRole(args.roles)) {
    return null;
  }

  if (!args.officeId && !args.officeName) {
    return null;
  }

  return {
    officeId: args.officeId ?? null,
    officeName: args.officeName ?? null,
  };
}
