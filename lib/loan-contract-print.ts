import { isPendingLoanApplicationEditTenant } from "@/lib/pending-loan-application-edit";

export function hasReachedFinalApprovalStatus(status?: string | null): boolean {
  const normalized = (status || "").trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  if (normalized === "approved") {
    return true;
  }

  if (normalized.includes("approved") && !normalized.includes("pending")) {
    return true;
  }

  if (normalized.includes("active") || normalized.includes("disbursed")) {
    return true;
  }

  if (normalized.includes("closed")) {
    return true;
  }

  return false;
}

export function canPrintLoanContract(
  tenantSlug?: string | null,
  loanStatus?: string | null
): boolean {
  return (
    isPendingLoanApplicationEditTenant(tenantSlug) &&
    hasReachedFinalApprovalStatus(loanStatus)
  );
}
