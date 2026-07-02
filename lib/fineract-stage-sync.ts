export function getPipelineStageNameForFineractStatus(
  status?: string | null
): string | null {
  const normalizedStatus = (status || "").trim().toLowerCase();

  if (!normalizedStatus) return null;
  if (normalizedStatus.includes("reject") || normalizedStatus.includes("withdrawn")) {
    return "Rejected";
  }
  if (normalizedStatus.includes("active") || normalizedStatus.includes("closed")) {
    return "Disburse";
  }
  if (normalizedStatus.includes("approved")) {
    return "Approval";
  }

  return null;
}

export function getPipelineStageNameForLoanAction(
  action?: string | null
): string | null {
  const normalizedAction = (action || "").trim().toLowerCase();

  if (!normalizedAction) return null;
  if (normalizedAction === "approve") return "Approval";
  if (normalizedAction === "reject") return "Rejected";
  if (normalizedAction === "disburse") return "Disburse";

  return null;
}
