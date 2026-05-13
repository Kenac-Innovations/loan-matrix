export interface Transaction {
    id: number;
    officeName: string;
    externalId?: string;
    date?: number[];
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
    manuallyReversed?: boolean;
    transactionId?: string;
    loanChargePaidByList?: Array<{
      amount?: number;
      chargeName?: string;
      name?: string;
      loanChargeName?: string;
      charge?: {
        name?: string;
      };
    }>;
  }
