export enum UssdLoanApplicationStatus {
  CREATED = "CREATED",
  SUBMITTED = "SUBMITTED",
  UNDER_REVIEW = "UNDER_REVIEW",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  DISBURSED = "DISBURSED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

export interface UssdLoanApplication {
  loanApplicationUssdId: number;
  messageId: string;
  referenceNumber: string;
  userPhoneNumber: string;
  loanMatrixClientId?: number;
  userFullName: string;
  userNationalId: string;
  
  // Loan Product Information
  loanMatrixLoanProductId: number;
  loanProductName: string;
  loanProductDisplayName: string;
  
  // Loan Details
  principalAmount: number;
  loanTermMonths: number;
  
  // Payout Information
  payoutMethod: string;
  mobileMoneyNumber?: string;
  mobileMoneyProvider?: string;
  branchName?: string;
  officeLocationId?: number;
  bankAccountNumber?: string;
  bankName?: string;
  bankBranch?: string;
  
  // Status Information
  status: UssdLoanApplicationStatus;
  paymentStatus?: string | null;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Queue specific fields
  source: string;
  channel: string;
  queuedAt: Date;
}

export interface UssdLeadsMetrics {
  totalApplications: number;
  pendingAction: number;
  approved: number;
  rejected: number;
  disbursed: number;
  underReview: number;
  cancelled: number;
  expired: number;
  monthlyTarget: number;
  approvalRate: number;
  averageProcessingTime: number; // in hours
}

export interface UssdLoanApplicationMessage {
  loanApplicationUssdId: number;
  messageId: string;
  referenceNumber: string;
  userPhoneNumber: string;
  loanMatrixClientId?: number;
  userFullName: string;
  userNationalId: string;
  loanMatrixLoanProductId: number;
  loanProductName: string;
  loanProductDisplayName: string;
  principalAmount: number;
  loanTermMonths: number;
  payoutMethod: string;
  mobileMoneyNumber?: string;
  mobileMoneyProvider?: string;
  branchName?: string;
  officeLocationId?: number;
  bankAccountNumber?: string;
  bankName?: string;
  bankBranch?: string;
  status: string;
  source: string;
  channel: string;
  queuedAt: string;
  loanMatrixPaymentMethodId?: number;
}
