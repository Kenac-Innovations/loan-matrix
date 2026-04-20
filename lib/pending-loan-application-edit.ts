import type { Session } from "next-auth";
import { isOmamaTenantSlug } from "@/lib/omama-tenant";

export function isPendingLoanApplicationEditTenant(
  tenantSlug?: string | null
): boolean {
  return isOmamaTenantSlug(tenantSlug);
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
