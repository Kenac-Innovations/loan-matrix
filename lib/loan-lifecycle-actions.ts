export type LoanLifecycleUndoAction = {
  action: "undo-approval" | "undo-disbursal";
  label: "Undo Approval" | "Undo Disbursal";
};

type LoanLifecycleInput = {
  status?: {
    waitingForDisbursal?: boolean;
  } | null;
  timeline?: {
    actualDisbursementDate?: unknown;
  } | null;
};

function hasDisbursementDate(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(value);
}

export function getLoanLifecycleUndoAction(
  loan?: LoanLifecycleInput | null
): LoanLifecycleUndoAction {
  const canUndoApproval =
    loan?.status?.waitingForDisbursal === true &&
    !hasDisbursementDate(loan?.timeline?.actualDisbursementDate);

  return canUndoApproval
    ? { action: "undo-approval", label: "Undo Approval" }
    : { action: "undo-disbursal", label: "Undo Disbursal" };
}
