import type { Session } from "next-auth";
import { getTenantFeatures } from "@/lib/tenant-features";

export function isOmamaTenant(tenantSlug?: string | null): boolean {
  return (tenantSlug || "").trim().toLowerCase() === "omama";
}

export function isPendingLoanApplicationEditTenant(
  tenantSlug?: string | null,
  tenantSettings?: unknown
): boolean {
  return (
    getTenantFeatures(tenantSettings).canEditLoan === true ||
    isOmamaTenant(tenantSlug)
  );
}

export function isPendingApprovalLoanStatus(status?: string | null): boolean {
  return (status || "").trim().toLowerCase() === "submitted and pending approval";
}

export function canUserEditPendingLoanApplication(
  session: Session | null | undefined
): boolean {
  return !!session?.user;
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
