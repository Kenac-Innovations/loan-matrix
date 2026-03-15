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