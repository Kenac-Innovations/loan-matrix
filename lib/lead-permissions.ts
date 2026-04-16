import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { SpecificPermission } from "@/shared/types/auth";

export const PENDING_APPROVAL_EDITABLE_LOAN_TERM_FIELDS = [
  "principal",
  "loanTerm",
  "numberOfRepayments",
  "nominalInterestRate",
] as const;

export type PendingApprovalEditableLoanTermField =
  (typeof PENDING_APPROVAL_EDITABLE_LOAN_TERM_FIELDS)[number];

interface LeadApprovalStageLike {
  name?: string | null;
  fineractStatus?: string | null;
}

interface LeadApprovalLike {
  currentStage?: LeadApprovalStageLike | null;
}

interface LeadAccessProfileInput {
  tenantId: string;
  lead: LeadApprovalLike;
  loanStatus?: string | null;
  session?: Session | null;
}

interface LeadAccessProfile {
  roleNames: string[];
  isCreditAnalyst: boolean;
  isPendingApproval: boolean;
  hasFinalApproval: boolean;
  canFullyEditPendingApprovalLoanTerms: boolean;
  canRestrictedEditPendingApprovalLoanTerms: boolean;
}

function normalizeAccessText(value?: string | null): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function matchesRolePattern(roleName: string, patterns: string[]): boolean {
  const normalizedRoleName = normalizeAccessText(roleName);
  return patterns.some((pattern) =>
    normalizedRoleName.includes(normalizeAccessText(pattern))
  );
}

export function isPendingApprovalStatus(status?: string | null): boolean {
  const normalizedStatus = normalizeAccessText(status);
  return (
    normalizedStatus.includes("pending approval") ||
    normalizedStatus.includes("submitted pending approval")
  );
}

export function isFinalApprovalStatus(status?: string | null): boolean {
  const normalizedStatus = normalizeAccessText(status);
  return (
    normalizedStatus.includes("final approval") ||
    normalizedStatus === "approved" ||
    (normalizedStatus.includes("approved") &&
      !normalizedStatus.includes("pending")) ||
    normalizedStatus.includes("active") ||
    normalizedStatus.includes("disbursed")
  );
}

export function isCreditAnalystRole(roleName?: string | null): boolean {
  return matchesRolePattern(roleName || "", [
    "credit analyst",
    "credit_analyst",
    "loan analyst",
  ]);
}

function isElevatedLoanEditRole(roleName?: string | null): boolean {
  return matchesRolePattern(roleName || "", [
    "super admin",
    "super user",
    "admin",
    "branch manager",
    "authoriser",
    "authorizer",
    "head office",
    "headquarters",
  ]);
}

async function getRoleNamesForTenant(
  tenantId: string,
  session?: Session | null
): Promise<string[]> {
  const sessionRoleNames =
    session?.user?.roles?.map((role: { name?: string }) => role.name || "") ||
    [];

  const mifosUserId = session?.user?.userId;
  if (!mifosUserId) {
    return uniqueStrings(sessionRoleNames);
  }

  const assignedRoles = await prisma.userRole.findMany({
    where: {
      tenantId,
      mifosUserId,
      isActive: true,
    },
    include: {
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  const localRoleNames = assignedRoles.map((assignment) => assignment.role.name);
  return uniqueStrings([...sessionRoleNames, ...localRoleNames]);
}

export async function getLeadAccessProfile({
  tenantId,
  lead,
  loanStatus,
  session,
}: LeadAccessProfileInput): Promise<LeadAccessProfile> {
  const roleNames = await getRoleNamesForTenant(tenantId, session);
  const permissionNames = session?.user?.permissions || [];

  const isPendingApproval =
    isPendingApprovalStatus(loanStatus) ||
    isPendingApprovalStatus(lead.currentStage?.name) ||
    normalizeAccessText(lead.currentStage?.fineractStatus) ===
      "submitted pending approval";

  const hasFinalApproval =
    isFinalApprovalStatus(loanStatus) ||
    isFinalApprovalStatus(lead.currentStage?.name) ||
    normalizeAccessText(lead.currentStage?.fineractStatus) === "approved";

  const isCreditAnalyst = roleNames.some((roleName) =>
    isCreditAnalystRole(roleName)
  );

  const hasElevatedLoanPermission =
    permissionNames.includes(SpecificPermission.ALL_FUNCTIONS) ||
    permissionNames.includes(SpecificPermission.UPDATE_LOAN) ||
    roleNames.some((roleName) => isElevatedLoanEditRole(roleName));

  return {
    roleNames,
    isCreditAnalyst,
    isPendingApproval,
    hasFinalApproval,
    canFullyEditPendingApprovalLoanTerms:
      isPendingApproval && hasElevatedLoanPermission,
    canRestrictedEditPendingApprovalLoanTerms:
      isPendingApproval && (hasElevatedLoanPermission || isCreditAnalyst),
  };
}
