import type { Session } from "next-auth";
import { SpecificPermission } from "@/shared/types/auth";

export function isPendingLoanApplicationEditTenant(
  tenantSlug?: string | null
): boolean {
  return (tenantSlug || "").trim().toLowerCase() === "omama";
}

export function isPendingApprovalLoanStatus(status?: string | null): boolean {
  return (status || "").trim().toLowerCase() === "submitted and pending approval";
}

export function canUserEditPendingLoanApplication(
  session: Session | null | undefined
): boolean {
  if (!session?.user) {
    return false;
  }

  const permissions = session.user.permissions || [];
  const hasUpdatePermission =
    permissions.includes(SpecificPermission.UPDATE_LOAN) ||
    permissions.includes(SpecificPermission.ALL_FUNCTIONS);
  return hasUpdatePermission;
}

export function canEditPendingLoanApplication(
  session: Session | null | undefined,
  loanStatus?: string | null
): boolean {
  return (
    isPendingApprovalLoanStatus(loanStatus) &&
    canUserEditPendingLoanApplication(session)
  );
}
