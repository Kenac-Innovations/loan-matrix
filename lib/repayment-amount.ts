export interface RepaymentTemplateAmounts {
  amount?: number | null;
  principalPortion?: number | null;
  interestPortion?: number | null;
  feeChargesPortion?: number | null;
  penaltyChargesPortion?: number | null;
}

export interface LoanOutstandingAmounts {
  totalOutstanding?: number | null;
  principalOutstanding?: number | null;
  interestOutstanding?: number | null;
  feeChargesOutstanding?: number | null;
  penaltyChargesOutstanding?: number | null;
}

export interface RepaymentDisplayAmounts {
  amount: number;
  principal: number;
  interest: number;
  fees: number;
  arrears: number;
}

const toNonNegativeAmount = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
};

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Fineract's repayment template can omit accrued arrears. The loan summary is
 * the source for the full balance shown on the loan details card, so prefer
 * its component values whenever they are present.
 */
export function resolveRepaymentDisplayAmounts(
  template: RepaymentTemplateAmounts,
  outstanding?: LoanOutstandingAmounts | null
): RepaymentDisplayAmounts {
  const templatePrincipal = toNonNegativeAmount(template.principalPortion) ?? 0;
  const templateInterest = toNonNegativeAmount(template.interestPortion) ?? 0;
  const templateFees = toNonNegativeAmount(template.feeChargesPortion) ?? 0;
  const templateArrears = toNonNegativeAmount(template.penaltyChargesPortion) ?? 0;
  const templateAmount = toNonNegativeAmount(template.amount) ?? 0;

  const principal = toNonNegativeAmount(outstanding?.principalOutstanding) ?? templatePrincipal;
  const interest = toNonNegativeAmount(outstanding?.interestOutstanding) ?? templateInterest;
  const fees = toNonNegativeAmount(outstanding?.feeChargesOutstanding) ?? templateFees;
  const summaryArrears = toNonNegativeAmount(outstanding?.penaltyChargesOutstanding);
  const summaryTotal = toNonNegativeAmount(outstanding?.totalOutstanding);

  // Use the loan-card total whenever it is positive, including all accrued arrears.
  const amount = summaryTotal && summaryTotal > 0
    ? summaryTotal
    : Math.max(templateAmount, principal + interest + fees + templateArrears);

  // If Fineract only exposes the total, retain enough arrears in the breakdown
  // for the displayed components to reconcile exactly to the transaction amount.
  const arrears = Math.max(
    summaryArrears ?? templateArrears,
    amount - principal - interest - fees,
    0
  );

  return {
    amount: roundMoney(amount),
    principal: roundMoney(principal),
    interest: roundMoney(interest),
    fees: roundMoney(fees),
    arrears: roundMoney(arrears),
  };
}
