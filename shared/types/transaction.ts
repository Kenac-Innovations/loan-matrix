export interface Transaction {
    id: number;
    officeName: string;
    externalId?: string;
    date?: number[];
    manuallyReversed?: boolean;
    type?: {
      value: string;
      disbursement?: boolean;
      repayment?: boolean;
      repaymentAtDisbursement?: boolean;
      accrual?: boolean;
    };
    amount: number;
    principalPortion: number;
    interestPortion: number;
    feeChargesPortion: number;
    penaltyChargesPortion: number;
    outstandingLoanBalance: number;
    transactionId?: string;
  }
