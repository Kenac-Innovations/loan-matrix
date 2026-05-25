/**
 * Lead access control.
 *
 * Single source of truth for "which leads can the current user see?".
 *
 * Roles & precedence (most permissive wins):
 *   1. ALL_FUNCTIONS permission, OR admin/super/head-office role  -> "all"
 *   2. Authoriser role                                            -> "all"
 *   3. Branch manager role (with officeName)                      -> "branch"
 *   4. Loan officer (Fineract role OR local LOAN_OFFICER role)    -> "creator"
 *   5. Anyone else (safe default)                                 -> "creator"
 *   6. Missing session                                            -> "none" (empty results)
 *
 * For loan officers the "creator" scope means:
 *   Lead.userId == session.user.id                  (lead they created)
 *   OR Lead.assignedToUserId == session.user.userId (lead currently assigned to them)
 *
 * Usage in API routes / server actions:
 *
 *   const scope = await getLeadVisibilityScope(tenant.id);
 *   const leads = await prisma.lead.findMany({
 *     where: buildLeadWhere(scope, tenant.id, { status: "DRAFT" }),
 *   });
 *
 * Usage on single-lead pages (read-only fallback rather than 403):
 *
 *   const access = decideLeadAccess(scope, lead);
 *   if (access.level === "denied") { return <NotFound /> }
 *   const isReadOnly = access.level !== "full";
 */

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { SpecificPermission } from "@/shared/types/auth";
import { matchesOfficeName } from "@/lib/omama-office-admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LeadVisibilityScope =
  | { kind: "all" }
  | { kind: "branch"; officeName: string }
  | {
      kind: "creator";
      mifosUserId: number;
      mifosUserIdString: string;
    }
  | { kind: "none" };

export interface LeadAccessFields {
  userId?: string | null;
  assignedToUserId?: number | null;
  officeName?: string | null;
}

export type LeadAccessLevel = "full" | "readOnly" | "denied";

export interface LeadAccessDecision {
  level: LeadAccessLevel;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Role / permission helpers
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
  return Array.isArray(permissions) &&
    permissions.includes(SpecificPermission.ALL_FUNCTIONS);
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

// Note: "branch" pattern intentionally excluded here so that "Branch Manager"
// does not get classified as admin.
const ADMIN_ROLE_NAMES = new Set([
  "admin",
  "administrator",
  "app administrator",
  "super user",
  "super admin",
  "system administrator",
]);

const SUPER_ROLE_PATTERNS = ["super", "all functions", "head office", "headquarters"];

function isAdminOrSuper(roles: RoleLike[] | null | undefined): boolean {
  return hasMatchingRole(roles, (n) => {
    if (ADMIN_ROLE_NAMES.has(n)) return true;
    if (n.endsWith(" admin") || n.endsWith(" administrator")) return true;
    return SUPER_ROLE_PATTERNS.some((p) => n.includes(p));
  });
}

function isAuthoriser(roles: RoleLike[] | null | undefined): boolean {
  return hasMatchingRole(roles, (n) => n.includes("authoriser") || n.includes("authorizer"));
}

function isBranchManager(roles: RoleLike[] | null | undefined): boolean {
  // Match e.g. "Branch Manager", "Branch Admin" (the latter is also caught above,
  // but precedence ensures admin wins). Avoid matching "branch officer" if such
  // a role ever exists by requiring a "branch" word plus a management-like word.
  return hasMatchingRole(roles, (n) => {
    if (!n.includes("branch")) return false;
    return (
      n.includes("manager") ||
      n.includes("supervisor") ||
      n.includes("head") ||
      // Bare "branch" role assumed to be a branch-scoped role
      n === "branch"
    );
  });
}

function isFineractLoanOfficer(roles: RoleLike[] | null | undefined): boolean {
  return hasMatchingRole(roles, (n) => n.includes("loan officer"));
}

async function isLocalLoanOfficer(
  tenantId: string,
  mifosUserId: number
): Promise<boolean> {
  try {
    const userRoles = await prisma.userRole.findMany({
      where: { tenantId, mifosUserId, isActive: true },
      include: { role: true },
    });
    return userRoles.some((ur) => ur.role.name === "LOAN_OFFICER");
  } catch (error) {
    console.error("[lead-access] isLocalLoanOfficer failed:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the current user's lead-visibility scope. Cached per request via
 * React's `cache()` so multiple call sites in the same request don't re-query
 * the database.
 */
export const getLeadVisibilityScope = cache(
  async (tenantId: string): Promise<LeadVisibilityScope> => {
    const session = await getSession();
    const userIdString = session?.user?.id;
    const mifosUserId = session?.user?.userId;
    const officeName = session?.user?.officeName ?? null;
    const roles = (session?.user?.roles ?? null) as RoleLike[] | null;
    const permissions = session?.user?.permissions ?? null;

    if (!userIdString || mifosUserId == null) {
      return { kind: "none" };
    }

    // 1. ALL_FUNCTIONS / admin / super -> sees everything
    if (hasAllFunctions(permissions) || isAdminOrSuper(roles)) {
      return { kind: "all" };
    }

    // 2. Authoriser -> sees everything (needs cross-branch visibility to approve)
    if (isAuthoriser(roles)) {
      return { kind: "all" };
    }

    // 3. Branch manager -> branch-scoped
    if (isBranchManager(roles) && officeName) {
      return { kind: "branch", officeName };
    }

    // 4. Loan officer (Fineract role OR local LOAN_OFFICER role)
    let isLoanOfficer = isFineractLoanOfficer(roles);
    if (!isLoanOfficer) {
      isLoanOfficer = await isLocalLoanOfficer(tenantId, mifosUserId);
    }

    if (isLoanOfficer) {
      return {
        kind: "creator",
        mifosUserId,
        mifosUserIdString: userIdString,
      };
    }

    // 5. Default-deny: anyone we couldn't classify only sees their own / assigned
    // leads. Safer than leaking everything to an unrecognized role.
    return {
      kind: "creator",
      mifosUserId,
      mifosUserIdString: userIdString,
    };
  }
);

/**
 * Build a Prisma `where` clause that combines tenant scoping with the
 * current user's visibility scope. Always preserves any caller-provided
 * extra filters; correctly combines `OR` clauses via `AND` when needed.
 *
 * NOTE: the returned object can be passed directly to `prisma.lead.findMany`
 * / `findFirst` / `count`.
 */
export function buildLeadWhere(
  scope: LeadVisibilityScope,
  tenantId: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const base: Record<string, unknown> = { tenantId, ...extra };

  if (scope.kind === "all") {
    return base;
  }

  if (scope.kind === "branch") {
    // Add an officeName equality filter; do not clobber an existing one.
    if (base.officeName === undefined) {
      base.officeName = { equals: scope.officeName, mode: "insensitive" };
    }
    return base;
  }

  if (scope.kind === "creator") {
    const creatorOr = [
      { userId: scope.mifosUserIdString },
      { assignedToUserId: scope.mifosUserId },
    ];

    // If the caller already supplied an `OR`, combine with `AND` so we don't
    // accidentally widen visibility.
    if (Array.isArray(base.OR)) {
      const existingOr = base.OR;
      delete base.OR;
      const existingAnd = Array.isArray(base.AND) ? base.AND : [];
      base.AND = [...existingAnd, { OR: existingOr }, { OR: creatorOr }];
    } else if (Array.isArray(base.AND)) {
      (base.AND as unknown[]).push({ OR: creatorOr });
    } else {
      base.OR = creatorOr;
    }
    return base;
  }

  // scope.kind === "none": return an impossible filter so callers get [].
  // Using an empty `OR` array is treated as "no match" by Prisma.
  base.OR = [];
  return base;
}

/**
 * Decide what access level the current user has to a specific lead.
 *
 *  - "full":     full read/write access (lead they created, assigned to, in scope office, or admin).
 *  - "readOnly": user can view but not edit (e.g. loan officer looking at another officer's lead).
 *  - "denied":   no access at all (no session, etc.).
 *
 * Per product decision: loan officers viewing colleagues' leads do NOT get
 * a 403 — they see a read-only view with a banner explaining the restriction.
 */
export function decideLeadAccess(
  scope: LeadVisibilityScope,
  lead: LeadAccessFields | null | undefined
): LeadAccessDecision {
  if (!lead) {
    return { level: "denied", reason: "lead-missing" };
  }

  switch (scope.kind) {
    case "all":
      return { level: "full" };

    case "branch": {
      if (matchesOfficeName(lead.officeName ?? null, scope.officeName)) {
        return { level: "full" };
      }
      return {
        level: "readOnly",
        reason: "lead-out-of-branch",
      };
    }

    case "creator": {
      const isCreator =
        lead.userId != null && lead.userId === scope.mifosUserIdString;
      const isAssignee =
        lead.assignedToUserId != null &&
        lead.assignedToUserId === scope.mifosUserId;
      if (isCreator || isAssignee) {
        return { level: "full" };
      }
      return {
        level: "readOnly",
        reason: "lead-not-owned",
      };
    }

    case "none":
    default:
      return { level: "denied", reason: "no-session" };
  }
}

/**
 * Human-readable message for surfacing a read-only banner on the UI.
 */
export function describeLeadAccess(decision: LeadAccessDecision): string {
  switch (decision.reason) {
    case "lead-not-owned":
      return "You're viewing this lead in read-only mode because it was created by (and is currently assigned to) another loan officer.";
    case "lead-out-of-branch":
      return "You're viewing this lead in read-only mode because it belongs to a different branch.";
    case "no-session":
      return "Sign in to view this lead.";
    case "lead-missing":
      return "Lead not found.";
    default:
      return "You have read-only access to this lead.";
  }
}

/**
 * Convenience: check whether a row from a Fineract report (or any object that
 * has `lead_id`/`external_id` plus an enriched local lead) is visible to the
 * current user. Caller is responsible for resolving the local lead first; this
 * is just the boolean check.
 */
export function isReportRowVisible(
  scope: LeadVisibilityScope,
  resolvedLead: LeadAccessFields | null | undefined,
  reportRow: { branch?: unknown; office?: unknown; office_name?: unknown }
): boolean {
  if (scope.kind === "all") return true;

  if (scope.kind === "none") return false;

  if (scope.kind === "branch") {
    // Prefer the local lead's officeName (authoritative) over the report column.
    if (resolvedLead?.officeName) {
      return matchesOfficeName(resolvedLead.officeName, scope.officeName);
    }
    const reportOffice = (reportRow.branch ||
      reportRow.office ||
      reportRow.office_name ||
      null) as string | null;
    return matchesOfficeName(reportOffice, scope.officeName);
  }

  if (scope.kind === "creator") {
    if (!resolvedLead) {
      // No local lead matched. We can't tell who created it from Fineract alone;
      // treat as not visible (loan officers shouldn't see un-linked rows).
      return false;
    }
    const isCreator =
      resolvedLead.userId != null &&
      resolvedLead.userId === scope.mifosUserIdString;
    const isAssignee =
      resolvedLead.assignedToUserId != null &&
      resolvedLead.assignedToUserId === scope.mifosUserId;
    return isCreator || isAssignee;
  }

  return false;
}
