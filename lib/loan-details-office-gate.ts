import type {
  ExistingClientTransferRequirement,
  OfficeIdValue,
} from "./fineract-client-office-transfer";

export const LOAN_DETAILS_OFFICE_RESTRICTED_ACTIONS = [] as const;

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
  _action: string | null | undefined
): _action is LoanDetailsOfficeRestrictedAction {
  return false;
}

export function getLoanDetailsOfficeTransferRequirement(
  _input: LoanDetailsOfficeTransferRequirementInput
): ExistingClientTransferRequirement | null {
  return null;
}
