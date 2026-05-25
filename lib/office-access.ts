/**
 * Office (branch) access control.
 *
 * Single source of truth for "which office-scoped resources (banks, tellers,
 * etc.) can the current user see?".
 *
 * This mirrors `lib/lead-access.ts` but for resources that are tied directly
 * to a Fineract office rather than to a specific user. The roles share the
 * same classifier as the lead-access module so that scoping is consistent
 * across the app.
 *
 * Roles & precedence (most permissive wins):
 *   1. ALL_FUNCTIONS permission OR admin/super/head-office role -> "all"
 *   2. Authoriser role                                          -> "all"
 *   3. Branch manager / Loan officer / any other non-admin role -> "office"
 *      (limited to the user's own Fineract office)
 *   4. Missing session or office                                -> "none"
 *
 * Usage in API routes / server actions:
 *
 *   const scope = await getOfficeVisibilityScope();
 *   const banks = await prisma.bank.findMany({
 *     where: buildOfficeWhere(scope, tenant.id, { status: "ACTIVE" }),
 *   });
 *
 * For single-item endpoints:
 *
 *   if (!canAccessOffice(scope, { officeId: bank.officeId })) {
 *     return NextResponse.json({ error: "Not found" }, { status: 404 });
 *   }
 */

import { cache } from "react";
import { getSession } from "@/lib/auth";
import { SpecificPermission } from "@/shared/types/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OfficeVisibilityScope =
  | { kind: "all" }
  | { kind: "office"; officeId: number; officeName: string }
  | { kind: "none" };

export interface OfficeAccessFields {
  officeId?: number | null;
}

// ---------------------------------------------------------------------------
// Role / permission helpers (kept consistent with lead-access.ts)
// ---------------------------------------------------------------------------

type RoleLike = { name?: string | null; disabled?: boolean | null };

function normalizeRoleName(name?: string | null): string {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function hasAllFunctions(permissions?: SpecificPermission[] | null): boolean {
  return (
    Array.isArray(permissions) &&
    permissions.includes(SpecificPermission.ALL_FUNCTIONS)
  );
}

function hasMatchingRole(
  roles: RoleLike[] | null | undefined,
  predicate: (normalized: string) => boolean
): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.some(
    (role) => !role?.disabled && predicate(normalizeRoleName(role?.name))
  );
}

// Same classifier as lead-access so the two stay in lock-step.
const ADMIN_ROLE_NAMES = new Set([
  "admin",
  "administrator",
  "app administrator",
  "super user",
  "super admin",
  "system administrator",
]);

const SUPER_ROLE_PATTERNS = [
  "super",
  "all functions",
  "head office",
  "headquarters",
];

function isAdminOrSuper(roles: RoleLike[] | null | undefined): boolean {
  return hasMatchingRole(roles, (n) => {
    if (ADMIN_ROLE_NAMES.has(n)) return true;
    if (n.endsWith(" admin") || n.endsWith(" administrator")) return true;
    return SUPER_ROLE_PATTERNS.some((p) => n.includes(p));
  });
}

function isAuthoriser(roles: RoleLike[] | null | undefined): boolean {
  return hasMatchingRole(
    roles,
    (n) => n.includes("authoriser") || n.includes("authorizer")
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the current user's office-visibility scope. Cached per request via
 * React's `cache()` so multiple call sites in the same request reuse the
 * same scope without re-reading the session.
 */
export const getOfficeVisibilityScope = cache(
  async (): Promise<OfficeVisibilityScope> => {
    const session = await getSession();
    const userIdString = session?.user?.id;
    const officeId = session?.user?.officeId ?? null;
    const officeName = session?.user?.officeName ?? null;
    const roles = (session?.user?.roles ?? null) as RoleLike[] | null;
    const permissions = session?.user?.permissions ?? null;

    if (!userIdString) {
      return { kind: "none" };
    }

    // 1. ALL_FUNCTIONS / admin / super -> sees every office
    if (hasAllFunctions(permissions) || isAdminOrSuper(roles)) {
      return { kind: "all" };
    }

    // 2. Authoriser -> sees every office (needs cross-branch visibility)
    if (isAuthoriser(roles)) {
      return { kind: "all" };
    }

    // 3. Everyone else is restricted to their own office. We need an officeId
    //    to enforce this — if the session is missing it (shouldn't happen for
    //    a real Fineract login) we default-deny rather than leak.
    if (officeId == null || !officeName) {
      return { kind: "none" };
    }

    return { kind: "office", officeId, officeName };
  }
);

/**
 * Build a Prisma `where` clause that combines tenant scoping with the
 * current user's office-visibility scope. Always preserves any caller-
 * provided extra filters.
 *
 * - "all":    no office filter applied.
 * - "office": adds `officeId = scope.officeId`. Caller-supplied `officeId`
 *             (e.g. an explicit query-string filter) is respected only when
 *             it matches the user's own office; otherwise it's clamped to
 *             prevent users from peeking at other offices via the URL.
 * - "none":   returns an impossible filter so callers get [].
 */
export function buildOfficeWhere(
  scope: OfficeVisibilityScope,
  tenantId: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const base: Record<string, unknown> = { tenantId, ...extra };

  if (scope.kind === "all") {
    return base;
  }

  if (scope.kind === "office") {
    const requestedOfficeId = base.officeId;
    if (
      typeof requestedOfficeId === "number" &&
      requestedOfficeId !== scope.officeId
    ) {
      // Caller asked for a different office than the user owns — force an
      // empty result rather than silently widening or silently substituting.
      base.officeId = -1;
    } else {
      base.officeId = scope.officeId;
    }
    return base;
  }

  // scope.kind === "none": return an impossible filter so callers get [].
  base.OR = [];
  return base;
}

/**
 * Decide whether the current user can see a single office-scoped item.
 * Use for `/api/<resource>/[id]` handlers — return 404 when this is false
 * to avoid leaking the resource's existence.
 */
export function canAccessOffice(
  scope: OfficeVisibilityScope,
  item: OfficeAccessFields | null | undefined
): boolean {
  if (!item) return false;

  switch (scope.kind) {
    case "all":
      return true;
    case "office":
      // Treat unknown/null office as out-of-scope for branch users; admins
      // already returned true above so global resources still surface for them.
      return item.officeId != null && item.officeId === scope.officeId;
    case "none":
    default:
      return false;
  }
}

/**
 * Useful for log/banner strings: short label describing the active scope.
 */
export function describeOfficeScope(scope: OfficeVisibilityScope): string {
  switch (scope.kind) {
    case "all":
      return "All branches";
    case "office":
      return scope.officeName;
    case "none":
    default:
      return "No access";
  }
}
