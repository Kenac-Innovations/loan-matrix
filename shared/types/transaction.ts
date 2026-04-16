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
    loanChargePaidByList?: Array<{
      name?: string;
      amount?: number;
      chargeId?: number;
      loanChargeId?: number;
    }>;
    amount: number;
    principalPortion: number;
    interestPortion: number;
    feeChargesPortion: number;
    penaltyChargesPortion: number;
    outstandingLoanBalance: number;
    transactionId?: string;
    loanChargePaidByList?: Array<{
      chargeName?: string;
      name?: string;
      loanChargeName?: string;
      charge?: {
        name?: string;
      };
    }>;
  }
