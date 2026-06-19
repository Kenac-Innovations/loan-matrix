import {
  getExistingClientTransferRequirement,
  normalizeOfficeId,
  type ExistingClientTransferRequirement,
  type OfficeIdValue,
} from "./fineract-client-office-transfer";

export const LOAN_DETAILS_OFFICE_RESTRICTED_ACTIONS = [
  "add-charge",
  "make-repayment",
  "reverse-payout",
] as const;

export type LoanDetailsOfficeRestrictedAction =
  (typeof LOAN_DETAILS_OFFICE_RESTRICTED_ACTIONS)[number];

export interface LoanDetailsOfficeTransferRequirementInput {
  clientId: number;
  clientDisplayName: string;
  clientOfficeId: OfficeIdValue;
  clientOfficeName?: string | null;
  loanOfficeId?: OfficeIdValue;
  loanOfficeName?: string | null;
  userOfficeId: OfficeIdValue;
  userOfficeName?: string | null;
}

export function isLoanDetailsOfficeRestrictedAction(
  action: string | null | undefined
): action is LoanDetailsOfficeRestrictedAction {
  return LOAN_DETAILS_OFFICE_RESTRICTED_ACTIONS.includes(
    action as LoanDetailsOfficeRestrictedAction
  );
}

export function getLoanDetailsOfficeTransferRequirement(
  input: LoanDetailsOfficeTransferRequirementInput
): ExistingClientTransferRequirement | null {
  const resolvedClientOfficeId =
    normalizeOfficeId(input.clientOfficeId) ?? normalizeOfficeId(input.loanOfficeId);
  const resolvedClientOfficeName =
    input.clientOfficeName?.trim() || input.loanOfficeName?.trim() || null;

  return getExistingClientTransferRequirement({
    clientId: input.clientId,
    clientDisplayName: input.clientDisplayName.trim() || "This client",
    clientOfficeId: resolvedClientOfficeId,
    clientOfficeName: resolvedClientOfficeName,
    creatorOfficeId: input.userOfficeId,
    creatorOfficeName: input.userOfficeName,
  });
}
