import type React from "react";
import { Loan } from "./loan";
import { RiskLevel } from "./credit-scoring";

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  settings?: any;
}

export interface LeadSummary {
  id: string;
  firstname?: string;
  lastname?: string;
  emailAddress?: string;
  status: string;
  currentStageId?: string;
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

export interface LoansDataTableProps {
  data: LoanSummary[];
}

export type LoanSummary = {
  id: string;
  clientId: string;
  clientName: string;
  loanProductId: string;
  loanProductName: string;
  principal: number;
  interestRate: number;
  termInMonths: number;
  status: string;
  disbursedOnDate?: string;
  maturityDate?: string;
  outstandingPrincipal: number;
  outstandingInterest: number;
  totalOutstanding: number;
  currency: string;
  accountNumber?: string;
  externalId?: string;
};

export interface Guarantor {
  id: string;
  clientId: string;
  loanId: string;
  guarantorType: string;
  amount: number;
  status: string;
  client?: {
    id: string;
    displayName: string;
    accountNumber: string;
    mobileNo?: string;
  };
}

export interface LoanWithGuarantors {
  id: string;
  accountNo: string;
  principal: number;
  outstandingPrincipal: number;
  guarantors: Guarantor[];
}

export interface GuarantorsModalProps {
  loanId: string;
  onSuccess: () => void;
}

export interface LoanProduct {
  id: string;
  name: string;
}

export interface LoanTemplate {
  id?: string;
  name: string;
  description?: string;
  loanProductId: string;
  loanProductName: string;
  principalAmount: number;
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequencyType: number;
  interestRatePerPeriod: number;
  amortizationType: number;
  interestType: number;
  interestCalculationPeriodType: number;
  transactionProcessingStrategyId: number;
  graceOnPrincipalPayment: number;
  graceOnInterestPayment: number;
  graceOnInterestCharged: number;
  expectedDisbursementDate: number[];
}

export interface LoanDetailsFormProps {
  clientId: string;
  onSubmit: (data: any) => void;
  onBack: () => void;
  onNext: (templateData?: LoanTemplate) => void;
}

export interface CloseModalProps {
  loanId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export interface CloseTemplateResponse {
  resourceId: number;
  changes?: {
    note?: string;
    locale?: string;
    dateFormat?: string;
  };
}

export interface CreateGuarantorModalProps {
  loanId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export interface GuarantorTemplate {
  clientId: number;
  guarantorType: {
    id: number;
    name: string;
  };
  amount: number;
  savingsAccountId?: number;
  status: {
    id: number;
    code: string;
    value: string;
  };
}

export interface CreateGuarantorForm {
  clientId: string;
  guarantorType: string;
  amount: number;
  savingsAccountId?: string;
}

export interface FineractDocument {
  id: number;
  parentEntityType: string;
  parentEntityId: number;
  name: string;
  fileName: string;
  size: number;
  type: string;
  description?: string;
  location?: string;
  storageType?: string;
  status: string;
  createdBy: string;
  createdDate: string;
}

export interface ClientDocumentsProps {
  clientId: number;
}

export interface ReportData {
  columnHeaders: Array<{
    columnName: string;
    columnType: string;
    columnDisplayType: string;
    isColumnNullable: boolean;
    isColumnPrimaryKey: boolean;
    isColumnUnique: boolean;
    isColumnIndexed: boolean;
    columnValues: any[];
  }>;
  data: Array<{
    row: any[];
  }>;
}

export interface ParameterOption {
  id: number;
  tc: string;
}

export interface IndexingStats {
  totalDocuments: number;
  indexedDocuments: number;
  failedDocuments: number;
  indexingProgress: number;
}

export interface PolicyDocument {
  id: string;
  title: string;
  content: string;
  documentType: string;
  embedding?: number[];
}

export interface LeadDetailsProps {
  leadId: string;
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
    riskLevel: RiskLevel;
  };
  validations?: Array<{
    id: string;
    ruleId: string;
    ruleName: string;
    status: ValidationStatus;
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

export enum ValidationStatus {
  PASSED = "PASSED",
  FAILED = "FAILED",
  WARNING = "WARNING",
}

export type ClientFormData = {
  firstname: string;
  lastname: string;
  emailAddress?: string;
  mobileNumber: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus?: string;
  occupation?: string;
  employer?: string;
  monthlyIncome?: number;
};

export type AffordabilityModelType = {
  id: string;
  name: string;
  description: string;
  type: AffordabilityModelTypeEnum;
  isActive: boolean;
  isDefault: boolean;
  config: any;
};

export enum AffordabilityModelTypeEnum {
  DTI = "dti",
  DISPOSABLE_INCOME = "disposableIncome",
  EMPLOYER_BASED = "employerBased",
  EXPENDITURE_ESTIMATION = "expenditureEstimation",
}

type Suggestion = {
  text: string;
  icon: React.ReactNode;
  id: string; // Unique identifier for tracking shown suggestions
};

type ContextualSuggestions = {
  [key: string]: Suggestion[];
};
