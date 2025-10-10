export type Loan = {
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

export interface LoanOffer {
  loanAmount: number;
  interestRate: number;
  termYears: number;
  monthlyPayment: number;
  totalRepayment: number;
  productName: string;
  productCode: string;
}

export interface FineractLoan {
  id: number;
  accountNo: string;
  externalId: string;
  status: {
    id: number;
    code: string;
    value: string;
  };
  clientId: number;
  clientName: string;
  clientAccountNo: string;
  clientExternalId: string;
  loanProductId: number;
  loanProductName: string;
  loanProductDescription: string;
  fundId: number;
  fundName: string;
  principal: number;
  approvedPrincipal: number;
  proposedPrincipal: number;
  termFrequency: number;
  termPeriodFrequencyType: {
    id: number;
    code: string;
    value: string;
  };
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequencyType: {
    id: number;
    code: string;
    value: string;
  };
  interestRatePerPeriod: number;
  interestRateFrequencyType: {
    id: number;
    code: string;
    value: string;
  };
  annualInterestRate: number;
  isFloatingInterestRate: boolean;
  allowPartialPeriodInterestCalculation: boolean;
  transactionProcessingStrategyId: number;
  transactionProcessingStrategyName: string;
  graceOnPrincipalPayment: number;
  graceOnInterestPayment: number;
  graceOnInterestCharged: number;
  graceOnArrearsAgeing: number;
  timeline: {
    submittedOnDate: string[];
    submittedByUsername: string;
    submittedByFirstname: string;
    submittedByLastname: string;
    approvedOnDate: string[];
    approvedByUsername: string;
    approvedByFirstname: string;
    approvedByLastname: string;
    expectedDisbursementDate: string[];
    actualDisbursementDate: string[];
    expectedMaturityDate: string[];
    closedOnDate: string[];
    closedByUsername: string;
    closedByFirstname: string;
    closedByLastname: string;
  };
  currency: {
    code: string;
    name: string;
    decimalPlaces: number;
    displaySymbol: string;
    displayLabel: string;
  };
  loanOfficerId: number;
  loanOfficerName: string;
  loanOfficerDisplayName: string;
  loanPurposeName: string;
  loanPurposeId: number;
  includeInBorrowerCycle: boolean;
  useBorrowerCycle: boolean;
  isVariableInstallmentsAllowed: boolean;
  minimumGap: number;
  maximumGap: number;
  allowApprovedDisbursedAmountsOverApplied: boolean;
  overAppliedCalculationType: string;
  overAppliedNumber: number;
  disbursedAmountPercentageOnApproval: number;
  allowMultipleDisbursals: boolean;
  maxDisbursals: number;
  holdGuaranteeFunds: boolean;
  multiDisburseLoan: boolean;
  canDefineInstallmentAmount: boolean;
  canUseForTopup: boolean;
  isTopup: boolean;
  closureReasons: any[];
  productOptions: any[];
  paymentTypeOptions: any[];
  fundOptions: any[];
  termFrequencyOptions: any[];
  repaymentFrequencyOptions: any[];
  repaymentFrequencyTypeOptions: any[];
  interestRateFrequencyTypeOptions: any[];
  amortizationTypeOptions: any[];
  interestTypeOptions: any[];
  interestCalculationPeriodTypeOptions: any[];
  transactionProcessingStrategyOptions: any[];
  chargeOptions: any[];
  loanOfficerOptions: any[];
  loanPurposeOptions: any[];
  submittedOnDate: string[];
  expectedDisbursementDate: string[];
  expectedMaturityDate: string[];
  interestChargedFromDate: string[];
  repaymentsStartingFromDate: string[];
  daysInYearType: {
    id: number;
    code: string;
    value: string;
  };
  daysInMonthType: {
    id: number;
    code: string;
    value: string;
  };
  isInterestRecalculationEnabled: boolean;
  interestRecalculationData: any;
  createStandingInstructionAtDisbursement: boolean;
  isEqualAmortization: boolean;
}
