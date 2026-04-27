export interface FineractEnumOption {
  id: number;
  code: string;
  value: string;
  description?: string;
}

export interface FineractCurrency {
  code: string;
  name: string;
  displayLabel?: string;
  displaySymbol?: string;
  decimalPlaces?: number;
}

export interface FineractFund {
  id: number;
  name: string;
  externalId?: string;
}

export interface FineractGLAccount {
  id: number;
  name: string;
  glCode: string;
  type?: { value: string };
  usage?: { value: string };
}

export interface FineractCharge {
  id: number;
  name: string;
  amount: number;
  currency?: FineractCurrency;
  chargeTimeType: FineractEnumOption;
  chargeCalculationType: FineractEnumOption;
  active: boolean;
  penalty: boolean;
}

export interface FineractFloatingRate {
  id: number;
  name: string;
}

export interface FineractDelinquencyBucket {
  id: number;
  name: string;
}

export interface FineractPaymentType {
  id: number;
  name: string;
}

export interface LoanProductTemplate {
  currencyOptions: FineractCurrency[];
  fundOptions: FineractFund[];
  transactionProcessingStrategyOptions: Array<{ code: string; name: string }>;
  amortizationTypeOptions: FineractEnumOption[];
  interestTypeOptions: FineractEnumOption[];
  interestCalculationPeriodTypeOptions: FineractEnumOption[];
  repaymentFrequencyTypeOptions: FineractEnumOption[];
  interestRateFrequencyTypeOptions: FineractEnumOption[];
  daysInYearTypeOptions: FineractEnumOption[];
  daysInMonthTypeOptions: FineractEnumOption[];
  accountingRuleOptions: FineractEnumOption[];
  accountingMappingOptions?: {
    assetAccountOptions?: FineractGLAccount[];
    incomeAccountOptions?: FineractGLAccount[];
    expenseAccountOptions?: FineractGLAccount[];
    liabilityAccountOptions?: FineractGLAccount[];
  };
  chargeOptions: FineractCharge[];
  penaltyOptions?: FineractCharge[];
  chargeOffReasonOptions?: Array<{ id: number; name: string }>;
  floatingRateOptions?: FineractFloatingRate[];
  interestRecalculationCompoundingTypeOptions?: FineractEnumOption[];
  rescheduleStrategyTypeOptions?: FineractEnumOption[];
  preClosureInterestCalculationStrategyOptions?: FineractEnumOption[];
  interestRecalculationFrequencyTypeOptions?: FineractEnumOption[];
  delinquencyBucketOptions?: FineractDelinquencyBucket[];
  paymentTypeOptions?: FineractPaymentType[];
  repaymentStartDateTypeOptions?: FineractEnumOption[];
  loanScheduleTypeOptions?: FineractEnumOption[];
  loanScheduleProcessingTypeOptions?: FineractEnumOption[];
  advancedPaymentAllocationTransactionTypes?: FineractEnumOption[];
  supportedInterestRefundTypes?: FineractEnumOption[];
  overAppliedCalculationTypeOptions?: FineractEnumOption[];
}

export interface LoanProductListItem {
  id: number;
  name: string;
  shortName: string;
  description?: string;
  currency: FineractCurrency;
  principal: number;
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequencyType: FineractEnumOption;
  interestRatePerPeriod: number;
  interestType: FineractEnumOption;
  amortizationType: FineractEnumOption;
  accountingRule: FineractEnumOption;
  status: string;
}

// ─── Form data shape ─────────────────────────────────────────────────────────

export interface LoanProductChargeEntry {
  id: number;
  name: string;
  amount: number;
  chargeCalculationType: FineractEnumOption;
  chargeTimeType: FineractEnumOption;
  penalty: boolean;
}

export interface PaymentChannelMapping {
  paymentTypeId: number;
  fundSourceAccountId: number;
}

export interface FeeIncomeMapping {
  chargeId: number;
  incomeAccountId: number;
}

export interface ChargeOffReasonMapping {
  chargeOffReasonCodeValueId: number;
  expenseAccountId: number;
}

export interface LoanProductFormData {
  // Step 1: Details
  name: string;
  shortName: string;
  description: string;
  externalId: string;
  fundId: number | "";
  startDate: string;
  closeDate: string;
  includeInBorrowerCycle: boolean;
  isInvoiceDiscounting: boolean;

  // Step 2: Currency
  currencyCode: string;
  digitsAfterDecimal: number | "";
  inMultiplesOf: number | "";
  installmentAmountInMultiplesOf: number | "";

  // Step 3: Interest Refund (conditional)
  supportedInterestRefundTypes: number[];

  // Step 4: Terms
  principal: number | "";
  minPrincipal: number | "";
  maxPrincipal: number | "";
  useBorrowerCycle: boolean;
  numberOfRepayments: number | "";
  minNumberOfRepayments: number | "";
  maxNumberOfRepayments: number | "";
  repaymentEvery: number | "";
  repaymentFrequencyType: number | "";
  minimumDaysBetweenDisbursalAndFirstRepayment: number | "";
  repaymentStartDateType: number | "";
  fixedLength: number | "";
  interestRecognitionOnDisbursementDate: boolean;
  interestRatePerPeriod: number | "";
  minInterestRatePerPeriod: number | "";
  maxInterestRatePerPeriod: number | "";
  interestRateFrequencyType: number | "";
  isLinkedToFloatingInterestRates: boolean;
  floatingRatesId: number | "";
  interestRateDifferential: number | "";
  minDifferentialLendingRate: number | "";
  defaultDifferentialLendingRate: number | "";
  maxDifferentialLendingRate: number | "";
  isFloatingInterestRateCalculationAllowed: boolean;
  allowApprovedDisbursedAmountsOverApplied: boolean;
  overAppliedCalculationType: string;
  overAppliedNumber: number | "";

  // Step 5: Settings
  amortizationType: number | "";
  interestType: number | "";
  interestCalculationPeriodType: number | "";
  allowPartialPeriodInterestCalculation: boolean;
  transactionProcessingStrategyCode: string;
  daysInYearType: number | "";
  daysInMonthType: number | "";
  graceOnPrincipalPayment: number | "";
  graceOnInterestPayment: number | "";
  graceOnInterestCharged: number | "";
  graceOnArrearsAgeing: number | "";
  inArrearsTolerance: number | "";
  overdueDaysForNPA: number | "";
  accountMovesOutOfNPAOnlyOnArrearsCompletion: boolean;
  multiDisburseLoan: boolean;
  maxTrancheCount: number | "";
  outstandingLoanBalance: number | "";
  disallowExpectedDisbursements: boolean;
  isInterestRecalculationEnabled: boolean;
  preClosureInterestCalculationStrategy: number | "";
  rescheduleStrategyMethod: number | "";
  interestRecalculationCompoundingMethod: number | "";
  recalculationRestFrequencyType: number | "";
  recalculationRestFrequencyInterval: number | "";
  isArrearsBasedOnOriginalSchedule: boolean;
  disallowInterestCalculationOnPastDue: boolean;
  holdGuaranteeFunds: boolean;
  mandatoryGuarantee: number | "";
  minimumGuaranteeFromGuarantor: number | "";
  minimumGuaranteeFromOwnFunds: number | "";
  isEqualAmortization: boolean;
  allowVariableInstallments: boolean;
  minimumGap: number | "";
  maximumGap: number | "";
  canDefineInstallmentAmount: boolean;
  principalThresholdForLastInstallment: number | "";
  canUseForTopup: boolean;
  loanScheduleType: string;
  loanScheduleProcessingType: string;
  enableDownPayment: boolean;
  disbursedAmountPercentageForDownPayment: number | "";
  enableAutoRepaymentForDownPayment: boolean;
  delinquencyBucketId: number | "";
  enableInstallmentLevelDelinquency: boolean;

  // Step 6: Charges
  charges: LoanProductChargeEntry[];

  // Step 7: Accounting
  accountingRule: number | "";
  fundSourceAccountId: number | "";
  loanPortfolioAccountId: number | "";
  transfersInSuspenseAccountId: number | "";
  interestOnLoanAccountId: number | "";
  incomeFromFeeAccountId: number | "";
  incomeFromPenaltyAccountId: number | "";
  incomeFromRecoveryAccountId: number | "";
  incomeFromChargeOffInterestAccountId: number | "";
  incomeFromChargeOffFeesAccountId: number | "";
  incomeFromChargeOffPenaltyAccountId: number | "";
  incomeFromGoodwillCreditInterestAccountId: number | "";
  incomeFromGoodwillCreditFeesAccountId: number | "";
  incomeFromGoodwillCreditPenaltyAccountId: number | "";
  writeOffAccountId: number | "";
  goodwillCreditAccountId: number | "";
  chargeOffExpenseAccountId: number | "";
  chargeOffFraudExpenseAccountId: number | "";
  overpaymentLiabilityAccountId: number | "";
  receivableInterestAccountId: number | "";
  receivableFeeAccountId: number | "";
  receivablePenaltyAccountId: number | "";
  advancedAccountingRules: boolean;
  paymentChannelToFundSourceMappings: PaymentChannelMapping[];
  feeToIncomeAccountMappings: FeeIncomeMapping[];
  penaltyToIncomeAccountMappings: FeeIncomeMapping[];
  chargeOffReasonToExpenseAccountMappings: ChargeOffReasonMapping[];
}

export const defaultLoanProductFormData: LoanProductFormData = {
  name: "",
  shortName: "",
  description: "",
  externalId: "",
  fundId: "",
  startDate: "",
  closeDate: "",
  includeInBorrowerCycle: false,
  isInvoiceDiscounting: false,
  currencyCode: "",
  digitsAfterDecimal: 2,
  inMultiplesOf: "",
  installmentAmountInMultiplesOf: "",
  supportedInterestRefundTypes: [],
  principal: "",
  minPrincipal: "",
  maxPrincipal: "",
  useBorrowerCycle: false,
  numberOfRepayments: "",
  minNumberOfRepayments: "",
  maxNumberOfRepayments: "",
  repaymentEvery: "",
  repaymentFrequencyType: "",
  minimumDaysBetweenDisbursalAndFirstRepayment: "",
  repaymentStartDateType: "",
  fixedLength: "",
  interestRecognitionOnDisbursementDate: false,
  interestRatePerPeriod: "",
  minInterestRatePerPeriod: "",
  maxInterestRatePerPeriod: "",
  interestRateFrequencyType: "",
  isLinkedToFloatingInterestRates: false,
  floatingRatesId: "",
  interestRateDifferential: "",
  minDifferentialLendingRate: "",
  defaultDifferentialLendingRate: "",
  maxDifferentialLendingRate: "",
  isFloatingInterestRateCalculationAllowed: false,
  allowApprovedDisbursedAmountsOverApplied: false,
  overAppliedCalculationType: "",
  overAppliedNumber: "",
  amortizationType: "",
  interestType: "",
  interestCalculationPeriodType: "",
  allowPartialPeriodInterestCalculation: false,
  transactionProcessingStrategyCode: "",
  daysInYearType: "",
  daysInMonthType: "",
  graceOnPrincipalPayment: "",
  graceOnInterestPayment: "",
  graceOnInterestCharged: "",
  graceOnArrearsAgeing: "",
  inArrearsTolerance: "",
  overdueDaysForNPA: "",
  accountMovesOutOfNPAOnlyOnArrearsCompletion: false,
  multiDisburseLoan: false,
  maxTrancheCount: "",
  outstandingLoanBalance: "",
  disallowExpectedDisbursements: false,
  isInterestRecalculationEnabled: false,
  preClosureInterestCalculationStrategy: "",
  rescheduleStrategyMethod: "",
  interestRecalculationCompoundingMethod: "",
  recalculationRestFrequencyType: "",
  recalculationRestFrequencyInterval: "",
  isArrearsBasedOnOriginalSchedule: false,
  disallowInterestCalculationOnPastDue: false,
  holdGuaranteeFunds: false,
  mandatoryGuarantee: "",
  minimumGuaranteeFromGuarantor: "",
  minimumGuaranteeFromOwnFunds: "",
  isEqualAmortization: false,
  allowVariableInstallments: false,
  minimumGap: "",
  maximumGap: "",
  canDefineInstallmentAmount: false,
  principalThresholdForLastInstallment: "",
  canUseForTopup: false,
  loanScheduleType: "",
  loanScheduleProcessingType: "",
  enableDownPayment: false,
  disbursedAmountPercentageForDownPayment: "",
  enableAutoRepaymentForDownPayment: false,
  delinquencyBucketId: "",
  enableInstallmentLevelDelinquency: false,
  charges: [],
  accountingRule: "",
  fundSourceAccountId: "",
  loanPortfolioAccountId: "",
  transfersInSuspenseAccountId: "",
  interestOnLoanAccountId: "",
  incomeFromFeeAccountId: "",
  incomeFromPenaltyAccountId: "",
  incomeFromRecoveryAccountId: "",
  incomeFromChargeOffInterestAccountId: "",
  incomeFromChargeOffFeesAccountId: "",
  incomeFromChargeOffPenaltyAccountId: "",
  incomeFromGoodwillCreditInterestAccountId: "",
  incomeFromGoodwillCreditFeesAccountId: "",
  incomeFromGoodwillCreditPenaltyAccountId: "",
  writeOffAccountId: "",
  goodwillCreditAccountId: "",
  chargeOffExpenseAccountId: "",
  chargeOffFraudExpenseAccountId: "",
  overpaymentLiabilityAccountId: "",
  receivableInterestAccountId: "",
  receivableFeeAccountId: "",
  receivablePenaltyAccountId: "",
  advancedAccountingRules: false,
  paymentChannelToFundSourceMappings: [],
  feeToIncomeAccountMappings: [],
  penaltyToIncomeAccountMappings: [],
  chargeOffReasonToExpenseAccountMappings: [],
};

/**
 * Builds the Fineract API payload from form data.
 * Omits empty string / null / "" values for optional fields.
 */
export function buildFineractPayload(form: LoanProductFormData): Record<string, unknown> {
  const n = (v: number | "") => (v === "" ? undefined : v);
  const s = (v: string) => (v === "" ? undefined : v);
  const b = (v: boolean) => v || undefined;

  const payload: Record<string, unknown> = {
    name: form.name,
    shortName: form.shortName,
    currencyCode: form.currencyCode,
    digitsAfterDecimal: form.digitsAfterDecimal,
    locale: "en",
    dateFormat: "yyyy-MM-dd",
  };

  if (form.description) payload.description = form.description;
  if (form.externalId) payload.externalId = form.externalId;
  if (form.fundId !== "") payload.fundId = form.fundId;
  if (form.startDate) payload.startDate = form.startDate;
  if (form.closeDate) payload.closeDate = form.closeDate;
  if (form.includeInBorrowerCycle) payload.includeInBorrowerCycle = true;

  if (form.inMultiplesOf !== "") payload.inMultiplesOf = form.inMultiplesOf;
  if (form.installmentAmountInMultiplesOf !== "")
    payload.installmentAmountInMultiplesOf = form.installmentAmountInMultiplesOf;

  if (form.supportedInterestRefundTypes.length)
    payload.supportedInterestRefundTypes = form.supportedInterestRefundTypes;

  // Terms
  if (form.principal !== "") payload.principal = form.principal;
  if (form.minPrincipal !== "") payload.minPrincipal = form.minPrincipal;
  if (form.maxPrincipal !== "") payload.maxPrincipal = form.maxPrincipal;
  payload.useBorrowerCycle = form.useBorrowerCycle;
  if (form.numberOfRepayments !== "") payload.numberOfRepayments = form.numberOfRepayments;
  if (form.minNumberOfRepayments !== "") payload.minNumberOfRepayments = form.minNumberOfRepayments;
  if (form.maxNumberOfRepayments !== "") payload.maxNumberOfRepayments = form.maxNumberOfRepayments;
  if (form.repaymentEvery !== "") payload.repaymentEvery = form.repaymentEvery;
  if (form.repaymentFrequencyType !== "") payload.repaymentFrequencyType = form.repaymentFrequencyType;
  if (form.minimumDaysBetweenDisbursalAndFirstRepayment !== "")
    payload.minimumDaysBetweenDisbursalAndFirstRepayment =
      form.minimumDaysBetweenDisbursalAndFirstRepayment;
  if (form.repaymentStartDateType !== "") payload.repaymentStartDateType = form.repaymentStartDateType;
  if (form.fixedLength !== "") payload.fixedLength = form.fixedLength;
  if (form.interestRecognitionOnDisbursementDate)
    payload.interestRecognitionOnDisbursementDate = true;
  if (form.isLinkedToFloatingInterestRates) {
    payload.isLinkedToFloatingInterestRates = true;
    if (form.floatingRatesId !== "") payload.floatingRatesId = form.floatingRatesId;
    if (form.interestRateDifferential !== "") payload.interestRateDifferential = form.interestRateDifferential;
    if (form.minDifferentialLendingRate !== "") payload.minDifferentialLendingRate = form.minDifferentialLendingRate;
    if (form.defaultDifferentialLendingRate !== "") payload.defaultDifferentialLendingRate = form.defaultDifferentialLendingRate;
    if (form.maxDifferentialLendingRate !== "") payload.maxDifferentialLendingRate = form.maxDifferentialLendingRate;
    payload.isFloatingInterestRateCalculationAllowed = form.isFloatingInterestRateCalculationAllowed;
  } else {
    if (form.interestRatePerPeriod !== "") payload.interestRatePerPeriod = form.interestRatePerPeriod;
    if (form.minInterestRatePerPeriod !== "") payload.minInterestRatePerPeriod = form.minInterestRatePerPeriod;
    if (form.maxInterestRatePerPeriod !== "") payload.maxInterestRatePerPeriod = form.maxInterestRatePerPeriod;
    if (form.interestRateFrequencyType !== "") payload.interestRateFrequencyType = form.interestRateFrequencyType;
  }
  if (form.allowApprovedDisbursedAmountsOverApplied) {
    payload.allowApprovedDisbursedAmountsOverApplied = true;
    if (form.overAppliedCalculationType) payload.overAppliedCalculationType = form.overAppliedCalculationType;
    if (form.overAppliedNumber !== "") payload.overAppliedNumber = form.overAppliedNumber;
  }

  // Settings
  if (form.amortizationType !== "") payload.amortizationType = form.amortizationType;
  if (form.interestType !== "") payload.interestType = form.interestType;
  if (form.interestCalculationPeriodType !== "") payload.interestCalculationPeriodType = form.interestCalculationPeriodType;
  if (form.allowPartialPeriodInterestCalculation) payload.allowPartialPeriodInterestCalculation = true;
  if (form.transactionProcessingStrategyCode) payload.transactionProcessingStrategyCode = form.transactionProcessingStrategyCode;
  if (form.daysInYearType !== "") payload.daysInYearType = form.daysInYearType;
  if (form.daysInMonthType !== "") payload.daysInMonthType = form.daysInMonthType;
  if (form.graceOnPrincipalPayment !== "") payload.graceOnPrincipalPayment = form.graceOnPrincipalPayment;
  if (form.graceOnInterestPayment !== "") payload.graceOnInterestPayment = form.graceOnInterestPayment;
  if (form.graceOnInterestCharged !== "") payload.graceOnInterestCharged = form.graceOnInterestCharged;
  if (form.graceOnArrearsAgeing !== "") payload.graceOnArrearsAgeing = form.graceOnArrearsAgeing;
  if (form.inArrearsTolerance !== "") payload.inArrearsTolerance = form.inArrearsTolerance;
  if (form.overdueDaysForNPA !== "") payload.overdueDaysForNPA = form.overdueDaysForNPA;
  if (form.accountMovesOutOfNPAOnlyOnArrearsCompletion)
    payload.accountMovesOutOfNPAOnlyOnArrearsCompletion = true;
  if (form.isEqualAmortization) payload.isEqualAmortization = true;
  if (form.canDefineInstallmentAmount) payload.canDefineInstallmentAmount = true;
  if (form.principalThresholdForLastInstallment !== "")
    payload.principalThresholdForLastInstallment = form.principalThresholdForLastInstallment;
  if (form.canUseForTopup) payload.canUseForTopup = true;
  if (form.loanScheduleType !== "") payload.loanScheduleType = form.loanScheduleType;
  if (form.loanScheduleProcessingType !== "") payload.loanScheduleProcessingType = form.loanScheduleProcessingType;
  if (form.delinquencyBucketId !== "") payload.delinquencyBucketId = form.delinquencyBucketId;
  if (form.enableInstallmentLevelDelinquency) payload.enableInstallmentLevelDelinquency = true;

  payload.multiDisburseLoan = form.multiDisburseLoan;
  if (form.multiDisburseLoan) {
    if (form.maxTrancheCount !== "") payload.maxTrancheCount = form.maxTrancheCount;
    if (form.outstandingLoanBalance !== "") payload.outstandingLoanBalance = form.outstandingLoanBalance;
    if (form.disallowExpectedDisbursements) payload.disallowExpectedDisbursements = true;
  }

  payload.isInterestRecalculationEnabled = form.isInterestRecalculationEnabled;
  if (form.isInterestRecalculationEnabled) {
    if (form.preClosureInterestCalculationStrategy !== "")
      payload.preClosureInterestCalculationStrategy = form.preClosureInterestCalculationStrategy;
    if (form.rescheduleStrategyMethod !== "") payload.rescheduleStrategyMethod = form.rescheduleStrategyMethod;
    if (form.interestRecalculationCompoundingMethod !== "")
      payload.interestRecalculationCompoundingMethod = form.interestRecalculationCompoundingMethod;
    if (form.recalculationRestFrequencyType !== "") payload.recalculationRestFrequencyType = form.recalculationRestFrequencyType;
    if (form.recalculationRestFrequencyInterval !== "") payload.recalculationRestFrequencyInterval = form.recalculationRestFrequencyInterval;
    if (form.isArrearsBasedOnOriginalSchedule) payload.isArrearsBasedOnOriginalSchedule = true;
    if (form.disallowInterestCalculationOnPastDue) payload.disallowInterestCalculationOnPastDue = true;
  }

  payload.holdGuaranteeFunds = form.holdGuaranteeFunds;
  if (form.holdGuaranteeFunds) {
    if (form.mandatoryGuarantee !== "") payload.mandatoryGuarantee = form.mandatoryGuarantee;
    if (form.minimumGuaranteeFromGuarantor !== "") payload.minimumGuaranteeFromGuarantor = form.minimumGuaranteeFromGuarantor;
    if (form.minimumGuaranteeFromOwnFunds !== "") payload.minimumGuaranteeFromOwnFunds = form.minimumGuaranteeFromOwnFunds;
  }

  payload.allowVariableInstallments = form.allowVariableInstallments;
  if (form.allowVariableInstallments) {
    if (form.minimumGap !== "") payload.minimumGap = form.minimumGap;
    if (form.maximumGap !== "") payload.maximumGap = form.maximumGap;
  }

  payload.enableDownPayment = form.enableDownPayment;
  if (form.enableDownPayment) {
    if (form.disbursedAmountPercentageForDownPayment !== "")
      payload.disbursedAmountPercentageForDownPayment = form.disbursedAmountPercentageForDownPayment;
    if (form.enableAutoRepaymentForDownPayment) payload.enableAutoRepaymentForDownPayment = true;
  }

  // Charges
  if (form.charges.length) {
    payload.charges = form.charges.map((c) => ({ id: c.id }));
  }

  // Accounting
  if (form.accountingRule !== "") {
    payload.accountingRule = form.accountingRule;
    const rule = Number(form.accountingRule);
    if (rule === 2 || rule === 3 || rule === 4) {
      if (form.fundSourceAccountId !== "") payload.fundSourceAccountId = form.fundSourceAccountId;
      if (form.loanPortfolioAccountId !== "") payload.loanPortfolioAccountId = form.loanPortfolioAccountId;
      if (form.transfersInSuspenseAccountId !== "") payload.transfersInSuspenseAccountId = form.transfersInSuspenseAccountId;
      if (form.interestOnLoanAccountId !== "") payload.interestOnLoanAccountId = form.interestOnLoanAccountId;
      if (form.incomeFromFeeAccountId !== "") payload.incomeFromFeeAccountId = form.incomeFromFeeAccountId;
      if (form.incomeFromPenaltyAccountId !== "") payload.incomeFromPenaltyAccountId = form.incomeFromPenaltyAccountId;
      if (form.incomeFromRecoveryAccountId !== "") payload.incomeFromRecoveryAccountId = form.incomeFromRecoveryAccountId;
      if (form.incomeFromChargeOffInterestAccountId !== "") payload.incomeFromChargeOffInterestAccountId = form.incomeFromChargeOffInterestAccountId;
      if (form.incomeFromChargeOffFeesAccountId !== "") payload.incomeFromChargeOffFeesAccountId = form.incomeFromChargeOffFeesAccountId;
      if (form.incomeFromChargeOffPenaltyAccountId !== "") payload.incomeFromChargeOffPenaltyAccountId = form.incomeFromChargeOffPenaltyAccountId;
      if (form.incomeFromGoodwillCreditInterestAccountId !== "") payload.incomeFromGoodwillCreditInterestAccountId = form.incomeFromGoodwillCreditInterestAccountId;
      if (form.incomeFromGoodwillCreditFeesAccountId !== "") payload.incomeFromGoodwillCreditFeesAccountId = form.incomeFromGoodwillCreditFeesAccountId;
      if (form.incomeFromGoodwillCreditPenaltyAccountId !== "") payload.incomeFromGoodwillCreditPenaltyAccountId = form.incomeFromGoodwillCreditPenaltyAccountId;
      if (form.writeOffAccountId !== "") payload.writeOffAccountId = form.writeOffAccountId;
      if (form.goodwillCreditAccountId !== "") payload.goodwillCreditAccountId = form.goodwillCreditAccountId;
      if (form.chargeOffExpenseAccountId !== "") payload.chargeOffExpenseAccountId = form.chargeOffExpenseAccountId;
      if (form.chargeOffFraudExpenseAccountId !== "") payload.chargeOffFraudExpenseAccountId = form.chargeOffFraudExpenseAccountId;
      if (form.overpaymentLiabilityAccountId !== "") payload.overpaymentLiabilityAccountId = form.overpaymentLiabilityAccountId;
    }
    if (rule === 3 || rule === 4) {
      if (form.receivableInterestAccountId !== "") payload.receivableInterestAccountId = form.receivableInterestAccountId;
      if (form.receivableFeeAccountId !== "") payload.receivableFeeAccountId = form.receivableFeeAccountId;
      if (form.receivablePenaltyAccountId !== "") payload.receivablePenaltyAccountId = form.receivablePenaltyAccountId;
    }

    if (form.advancedAccountingRules) {
      payload.advancedAccountingRules = true;
      if (form.paymentChannelToFundSourceMappings.length)
        payload.paymentChannelToFundSourceMappings = form.paymentChannelToFundSourceMappings;
      if (form.feeToIncomeAccountMappings.length)
        payload.feeToIncomeAccountMappings = form.feeToIncomeAccountMappings;
      if (form.penaltyToIncomeAccountMappings.length)
        payload.penaltyToIncomeAccountMappings = form.penaltyToIncomeAccountMappings;
      if (form.chargeOffReasonToExpenseAccountMappings.length)
        payload.chargeOffReasonToExpenseAccountMappings = form.chargeOffReasonToExpenseAccountMappings;
    }
  }

  // Remove all undefined values
  return Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined)
  );
}
