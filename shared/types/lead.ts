export interface Lead {
  id: string;
  client: string;
  amount: string;
  type: string;
  stage: string;
  timeInStage: string;
  sla: string;
  status: "normal" | "warning" | "overdue";
  assignee: string;
  assigneeName: string;
  assigneeColor: string;
  createdAt: Date;
  updatedAt: Date;
  firstname?: string;
  lastname?: string;
  emailAddress?: string;
  currentStageId?: string;
  userId?: string; // Created by user ID
  createdByUserName?: string; // Full name of user who created the lead
  // Fineract tracking fields
  fineractLoanId?: number | null;
  loanSubmittedToFineract?: boolean;
  loanSubmissionDate?: Date | null;
  clientCreatedInFineract?: boolean;
  fineractClientId?: number | null;
  fineractLoanStatus?: string | null; // Loan status from Fineract
  // Assignment fields
  assignedToUserId?: number | null;
  assignedToUserName?: string | null;
  assignedAt?: Date | null;
  // Payout status (for disbursed loans)
  payoutStatus?: string | null; // PENDING, PAID, VOIDED
  /** Preferred payment type from affordability: CASH, MOBILE_MONEY, BANK_TRANSFER */
  preferredPaymentMethod?: string | null;
  /** TERM_LOAN or INVOICE_DISCOUNTING */
  facilityType?: "TERM_LOAN" | "INVOICE_DISCOUNTING";
  isTopup?: boolean;
}

export interface PipelineStage {
  id: string;
  name: string;
  description?: string;
  order: number;
  color: string;
  isActive: boolean;
  isInitialState: boolean;
  isFinalState: boolean;
  allowedTransitions: string[];
}

export interface LeadContext {
  leadId: string;
  currentStageId: string;
  assigneeId?: string;
  assigneeName?: string;
  slaTimers: Record<string, Date>;
}

export interface LeadEvent {
  eventType: string;
  timestamp: Date;
  userId?: string;
}

export interface LeadData {
  id: string;
  firstname?: string;
  lastname?: string;
  emailAddress?: string;
  mobileNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  occupation?: string;
  employer?: string;
  monthlyIncome?: number;
  loanAmount?: number;
  loanPurpose?: string;
  status: string;
  currentStageId?: string;
  assigneeId?: string;
  assigneeName?: string;
  createdAt: Date;
  updatedAt: Date;
  client?: {
    id: string;
    displayName: string;
    accountNumber: string;
  };
  documents?: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
    uploadedAt: Date;
  }>;
  communications?: Array<{
    id: string;
    type: string;
    content: string;
    timestamp: Date;
    userId: string;
    userName: string;
  }>;
  affordability?: {
    monthlyIncome: number;
    monthlyExpenses: number;
    disposableIncome: number;
    debtToIncomeRatio: number;
    recommendedLoanAmount: number;
    maxLoanAmount: number;
    riskLevel: "Low" | "Medium" | "High";
  };
  validations?: Array<{
    id: string;
    ruleId: string;
    ruleName: string;
    status: "PASSED" | "FAILED" | "WARNING";
    message: string;
    timestamp: Date;
  }>;
  timeline?: Array<{
    id: string;
    event: string;
    timestamp: Date;
    userId: string;
    userName: string;
    details?: string;
  }>;
}

export interface LeadDetailsProps {
  leadId: string;
}
