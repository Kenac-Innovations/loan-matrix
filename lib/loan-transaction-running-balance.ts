type TransactionTypeLike = {
  value?: string;
  code?: string;
  disbursement?: boolean;
  repayment?: boolean;
  repaymentAtDisbursement?: boolean;
  accrual?: boolean;
};

export type RunningOutstandingBalanceTransaction = {
  amount?: number | null;
  principalPortion?: number | null;
  interestPortion?: number | null;
  feeChargesPortion?: number | null;
  penaltyChargesPortion?: number | null;
  manuallyReversed?: boolean | null;
  type?: TransactionTypeLike | null;
  loanChargePaidByList?: Array<{ amount?: number | null }> | null;
};

export type TransactionWithRunningOutstandingBalance<
  T extends RunningOutstandingBalanceTransaction,
> = T & {
  outstandingBalanceMovement: number;
  runningOutstandingBalance: number;
};

const MONEY_SCALE = 100;

const toCents = (value: unknown): number => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * MONEY_SCALE) : 0;
};

const fromCents = (value: number): number => value / MONEY_SCALE;

const absFirst = (...values: number[]): number => {
  for (const value of values) {
    if (value !== 0) return Math.abs(value);
  }
  return 0;
};

const labelFor = (transaction: RunningOutstandingBalanceTransaction): string =>
  `${transaction.type?.value ?? ""} ${transaction.type?.code ?? ""}`.toLowerCase();

const isClientTransferStatusTransaction = (label: string): boolean =>
  /^transfer\s+(initiated|approved|rejected|withdrawn|submitted|pending)\b/.test(
    label.trim()
  );

const chargeListCents = (
  transaction: RunningOutstandingBalanceTransaction
): number =>
  Array.isArray(transaction.loanChargePaidByList)
    ? transaction.loanChargePaidByList.reduce(
        (sum, charge) => sum + Math.abs(toCents(charge.amount)),
        0
      )
    : 0;

export const getOutstandingBalanceMovement = (
  transaction: RunningOutstandingBalanceTransaction
): number => {
  if (transaction.manuallyReversed) return 0;

  const amount = Math.abs(toCents(transaction.amount));
  const principal = toCents(transaction.principalPortion);
  const interest = toCents(transaction.interestPortion);
  const fees = toCents(transaction.feeChargesPortion);
  const penalties = toCents(transaction.penaltyChargesPortion);
  const portions = principal + interest + fees + penalties;
  const chargeList = chargeListCents(transaction);
  const label = labelFor(transaction);
  const type = transaction.type;

  if (isClientTransferStatusTransaction(label)) {
    return 0;
  }

  if (type?.disbursement || /\bdisburs/.test(label)) {
    return fromCents(absFirst(principal, amount));
  }

  if (type?.repaymentAtDisbursement) {
    return fromCents(absFirst(fees + penalties + interest, chargeList, amount));
  }

  if (label.includes("credit balance refund")) {
    return fromCents(amount);
  }

  if (
    type?.repayment ||
    /\brepayment\b/.test(label) ||
    label.includes("payment")
  ) {
    return fromCents(-absFirst(amount, portions));
  }

  if (type?.accrual || label.includes("accrual")) {
    return fromCents(absFirst(interest + fees + penalties, amount));
  }

  if (
    label.includes("waive") ||
    label.includes("waiver") ||
    label.includes("write off") ||
    label.includes("write-off") ||
    label.includes("charge off") ||
    label.includes("charge-off")
  ) {
    return fromCents(-absFirst(portions, amount));
  }

  if (
    label.includes("fee") ||
    label.includes("charge") ||
    label.includes("penalty") ||
    label.includes("arrears")
  ) {
    return fromCents(absFirst(fees + penalties + interest, chargeList, amount));
  }

  return fromCents(portions);
};

export const attachRunningOutstandingBalances = <
  T extends RunningOutstandingBalanceTransaction,
>(
  transactions: T[]
): Array<TransactionWithRunningOutstandingBalance<T>> => {
  let runningBalanceCents = 0;

  return transactions.map((transaction) => {
    const movement = getOutstandingBalanceMovement(transaction);
    runningBalanceCents += toCents(movement);

    return {
      ...transaction,
      outstandingBalanceMovement: movement,
      runningOutstandingBalance: fromCents(runningBalanceCents),
    };
  });
};
