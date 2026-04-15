export const CHARGE_PRODUCT_TYPES = [
  "LOAN",
  "SAVINGS",
  "CLIENT",
  "SHARES",
] as const;

export type ChargeProductTypeValue = (typeof CHARGE_PRODUCT_TYPES)[number];

export const CHARGE_PRODUCT_TIME_TYPES = [
  "DISBURSEMENT",
  "SPECIFIED_DUE_DATE",
  "SAVINGS_ACTIVATION",
  "SAVINGS_CLOSURE",
  "WITHDRAWAL_FEE",
  "ANNUAL_FEE",
  "MONTHLY_FEE",
  "INSTALMENT_FEE",
  "OVERDUE_INSTALLMENT",
  "OVERDRAFT_FEE",
  "WEEKLY_FEE",
  "TRANCHE_DISBURSEMENT",
  "SHAREACCOUNT_ACTIVATION",
  "SHARE_PURCHASE",
  "SHARE_REDEEM",
  "SAVINGS_NOACTIVITY_FEE",
] as const;

export type ChargeProductTimeTypeValue =
  (typeof CHARGE_PRODUCT_TIME_TYPES)[number];

export const CHARGE_PRODUCT_CALCULATION_TYPES = [
  "FLAT",
  "PERCENT_OF_AMOUNT",
  "PERCENT_OF_AMOUNT_AND_INTEREST",
  "PERCENT_OF_INTEREST",
  "PERCENT_OF_DISBURSEMENT_AMOUNT",
] as const;

export type ChargeProductCalculationTypeValue =
  (typeof CHARGE_PRODUCT_CALCULATION_TYPES)[number];

export const CHARGE_PRODUCT_PAYMENT_MODES = [
  "REGULAR",
  "ACCOUNT_TRANSFER",
] as const;

export type ChargeProductPaymentModeValue =
  (typeof CHARGE_PRODUCT_PAYMENT_MODES)[number];

export const CHARGE_PRODUCT_TYPE_TO_FINERACT_CODE: Record<
  ChargeProductTypeValue,
  string
> = {
  LOAN: "chargeAppliesTo.loan",
  SAVINGS: "chargeAppliesTo.savings",
  CLIENT: "chargeAppliesTo.client",
  SHARES: "chargeAppliesTo.shares",
};

export const CHARGE_PRODUCT_TIME_TO_FINERACT_CODE: Record<
  ChargeProductTimeTypeValue,
  string
> = {
  DISBURSEMENT: "chargeTimeType.disbursement",
  SPECIFIED_DUE_DATE: "chargeTimeType.specifiedDueDate",
  SAVINGS_ACTIVATION: "chargeTimeType.savingsActivation",
  SAVINGS_CLOSURE: "chargeTimeType.savingsClosure",
  WITHDRAWAL_FEE: "chargeTimeType.withdrawalFee",
  ANNUAL_FEE: "chargeTimeType.annualFee",
  MONTHLY_FEE: "chargeTimeType.monthlyFee",
  INSTALMENT_FEE: "chargeTimeType.instalmentFee",
  OVERDUE_INSTALLMENT: "chargeTimeType.overdueInstallment",
  OVERDRAFT_FEE: "chargeTimeType.overdraftFee",
  WEEKLY_FEE: "chargeTimeType.weeklyFee",
  TRANCHE_DISBURSEMENT: "chargeTimeType.tranchedisbursement",
  SHAREACCOUNT_ACTIVATION: "chargeTimeType.activation",
  SHARE_PURCHASE: "chargeTimeType.sharespurchase",
  SHARE_REDEEM: "chargeTimeType.sharesredeem",
  SAVINGS_NOACTIVITY_FEE: "chargeTimeType.savingsNoActivityFee",
};

export const CHARGE_PRODUCT_CALC_TO_FINERACT_CODE: Record<
  ChargeProductCalculationTypeValue,
  string
> = {
  FLAT: "chargeCalculationType.flat",
  PERCENT_OF_AMOUNT: "chargeCalculationType.percent.of.amount",
  PERCENT_OF_AMOUNT_AND_INTEREST:
    "chargeCalculationType.percent.of.amount.and.interest",
  PERCENT_OF_INTEREST: "chargeCalculationType.percent.of.interest",
  PERCENT_OF_DISBURSEMENT_AMOUNT:
    "chargeCalculationType.percent.of.disbursement.amount",
};

export const CHARGE_PRODUCT_PAYMENT_TO_FINERACT_CODE: Record<
  ChargeProductPaymentModeValue,
  string
> = {
  REGULAR: "chargepaymentmode.regular",
  ACCOUNT_TRANSFER: "chargepaymentmode.accounttransfer",
};

function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

function fromCode<T extends string>(
  code: string,
  mapping: Record<T, string>
): T | null {
  const target = normalizeCode(code);
  for (const [key, value] of Object.entries(mapping) as [T, string][]) {
    if (normalizeCode(value) === target) {
      return key;
    }
  }
  return null;
}

export function typeFromFineractCode(code: string): ChargeProductTypeValue | null {
  return fromCode(code, CHARGE_PRODUCT_TYPE_TO_FINERACT_CODE);
}

export function timeTypeFromFineractCode(
  code: string
): ChargeProductTimeTypeValue | null {
  return fromCode(code, CHARGE_PRODUCT_TIME_TO_FINERACT_CODE);
}

export function calcTypeFromFineractCode(
  code: string
): ChargeProductCalculationTypeValue | null {
  return fromCode(code, CHARGE_PRODUCT_CALC_TO_FINERACT_CODE);
}

export function paymentModeFromFineractCode(
  code: string
): ChargeProductPaymentModeValue | null {
  return fromCode(code, CHARGE_PRODUCT_PAYMENT_TO_FINERACT_CODE);
}

export function formatChargeProductEnumLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function computeEffectiveFineractChargeValues(
  chargeTimeType: ChargeProductTimeTypeValue,
  chargeCalculationType: ChargeProductCalculationTypeValue,
  chargePaymentMode: ChargeProductPaymentModeValue
) {
  const effectiveTimeType: ChargeProductTimeTypeValue =
    chargeTimeType === "DISBURSEMENT" ? "SPECIFIED_DUE_DATE" : chargeTimeType;

  // Fineract charge product acts as a placeholder only.
  // Actual business charge details will come from local DB when applied later.
  return {
    effectiveTimeType,
    effectiveCalculationType:
      chargeTimeType === "DISBURSEMENT" ? ("FLAT" as const) : chargeCalculationType,
    effectivePaymentMode: chargePaymentMode,
    effectiveAmount: 1,
  };
}
