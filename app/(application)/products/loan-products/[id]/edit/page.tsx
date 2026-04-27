"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoanProductStepper } from "../../components/loan-product-stepper";
import { LoanProductFormSkeleton } from "../../components/loan-product-form-skeleton";
import type { LoanProductTemplate, LoanProductFormData } from "@/shared/types/loan-product";
import { buildInitialPaymentAllocations, defaultLoanProductFormData, ADVANCED_PAYMENT_ALLOCATION_STRATEGY } from "@/shared/types/loan-product";

function mapFineractProductToForm(product: Record<string, unknown>): LoanProductFormData {
  const n = (v: unknown) => (v == null ? "" : (v as number));
  const s = (v: unknown) => (v == null ? "" : String(v));
  const b = (v: unknown) => Boolean(v);

  const getEnumId = (v: unknown): number | "" => {
    if (v == null) return "";
    const obj = v as Record<string, unknown>;
    return obj?.id != null ? (obj.id as number) : "";
  };

  const getEnumCode = (v: unknown): string => {
    if (v == null) return "";
    const obj = v as Record<string, unknown>;
    return obj?.code != null ? String(obj.code) : "";
  };

  const loanScheduleTypeCode = getEnumCode(product.loanScheduleType);
  const isProgressive = loanScheduleTypeCode === "PROGRESSIVE";
  const { paymentAllocations, creditAllocations } = isProgressive
    ? buildInitialPaymentAllocations(product as unknown as LoanProductTemplate)
    : { paymentAllocations: [], creditAllocations: [] };

  return {
    ...defaultLoanProductFormData,
    name: s(product.name),
    shortName: s(product.shortName),
    description: s(product.description),
    externalId: s(product.externalId),
    fundId: n(product.fundId),
    startDate: s(product.startDate),
    closeDate: s(product.closeDate),
    includeInBorrowerCycle: b(product.includeInBorrowerCycle),

    currencyCode: (product.currency as Record<string, unknown>)?.code
      ? s((product.currency as Record<string, unknown>).code)
      : "",
    digitsAfterDecimal: product.digitsAfterDecimal != null ? n(product.digitsAfterDecimal) : 2,
    inMultiplesOf: n(product.inMultiplesOf),
    installmentAmountInMultiplesOf: n(product.installmentAmountInMultiplesOf),

    principal: n(product.principal),
    minPrincipal: n(product.minPrincipal),
    maxPrincipal: n(product.maxPrincipal),
    useBorrowerCycle: b(product.useBorrowerCycle),
    numberOfRepayments: n(product.numberOfRepayments),
    minNumberOfRepayments: n(product.minNumberOfRepayments),
    maxNumberOfRepayments: n(product.maxNumberOfRepayments),
    repaymentEvery: n(product.repaymentEvery),
    repaymentFrequencyType: getEnumId(product.repaymentFrequencyType),
    minimumDaysBetweenDisbursalAndFirstRepayment: n(
      product.minimumDaysBetweenDisbursalAndFirstRepayment
    ),
    repaymentStartDateType: getEnumId(product.repaymentStartDateType),
    fixedLength: n(product.fixedLength),
    interestRecognitionOnDisbursementDate: b(product.interestRecognitionOnDisbursementDate),
    interestRatePerPeriod: n(product.interestRatePerPeriod),
    minInterestRatePerPeriod: n(product.minInterestRatePerPeriod),
    maxInterestRatePerPeriod: n(product.maxInterestRatePerPeriod),
    interestRateFrequencyType: getEnumId(product.interestRateFrequencyType),
    isLinkedToFloatingInterestRates: b(product.isLinkedToFloatingInterestRates),
    floatingRatesId: n((product.floatingRates as Record<string, unknown>)?.id),
    interestRateDifferential: n(product.interestRateDifferential),
    minDifferentialLendingRate: n(product.minDifferentialLendingRate),
    defaultDifferentialLendingRate: n(product.defaultDifferentialLendingRate),
    maxDifferentialLendingRate: n(product.maxDifferentialLendingRate),
    isFloatingInterestRateCalculationAllowed: b(product.isFloatingInterestRateCalculationAllowed),
    allowApprovedDisbursedAmountsOverApplied: b(product.allowApprovedDisbursedAmountsOverApplied),
    overAppliedCalculationType: s(
      (product.overAppliedCalculationType as Record<string, unknown>)?.code
    ),
    overAppliedNumber: n(product.overAppliedNumber),

    amortizationType: getEnumId(product.amortizationType),
    interestType: getEnumId(product.interestType),
    interestCalculationPeriodType: getEnumId(product.interestCalculationPeriodType),
    allowPartialPeriodInterestCalculation: b(
      product.allowPartialPeriodInterestCalculation ??
        product.allowPartialPeriodInterestCalcualtion
    ),
    transactionProcessingStrategyCode: s(product.transactionProcessingStrategyCode),
    daysInYearType: getEnumId(product.daysInYearType),
    daysInMonthType: getEnumId(product.daysInMonthType),
    graceOnPrincipalPayment: n(product.graceOnPrincipalPayment),
    graceOnInterestPayment: n(product.graceOnInterestPayment),
    graceOnInterestCharged: n(product.graceOnInterestCharged),
    graceOnArrearsAgeing: n(product.graceOnArrearsAgeing),
    inArrearsTolerance: n(product.inArrearsTolerance),
    overdueDaysForNPA: n(product.overdueDaysForNPA),
    accountMovesOutOfNPAOnlyOnArrearsCompletion: b(
      product.accountMovesOutOfNPAOnlyOnArrearsCompletion
    ),
    multiDisburseLoan: b(product.multiDisburseLoan),
    maxTrancheCount: n(product.maxTrancheCount),
    outstandingLoanBalance: n(product.outstandingLoanBalance),
    disallowExpectedDisbursements: b(product.disallowExpectedDisbursements),
    isInterestRecalculationEnabled: b(product.isInterestRecalculationEnabled),
    preClosureInterestCalculationStrategy: getEnumId(
      product.preClosureInterestCalculationStrategy
    ),
    rescheduleStrategyMethod: getEnumId(product.rescheduleStrategyMethod),
    interestRecalculationCompoundingMethod: getEnumId(
      product.interestRecalculationCompoundingMethod
    ),
    recalculationRestFrequencyType: getEnumId(product.recalculationRestFrequencyType),
    recalculationRestFrequencyInterval: n(product.recalculationRestFrequencyInterval),
    isArrearsBasedOnOriginalSchedule: b(product.isArrearsBasedOnOriginalSchedule),
    disallowInterestCalculationOnPastDue: b(product.disallowInterestCalculationOnPastDue),
    holdGuaranteeFunds: b(product.holdGuaranteeFunds),
    mandatoryGuarantee: n(product.mandatoryGuarantee),
    minimumGuaranteeFromGuarantor: n(product.minimumGuaranteeFromGuarantor),
    minimumGuaranteeFromOwnFunds: n(product.minimumGuaranteeFromOwnFunds),
    isEqualAmortization: b(product.isEqualAmortization),
    allowVariableInstallments: b(product.allowVariableInstallments),
    minimumGap: n(product.minimumGap),
    maximumGap: n(product.maximumGap),
    canDefineInstallmentAmount: b(product.canDefineInstallmentAmount),
    principalThresholdForLastInstallment: n(product.principalThresholdForLastInstallment),
    canUseForTopup: b(product.canUseForTopup),
    loanScheduleType: getEnumCode(product.loanScheduleType),
    loanScheduleProcessingType: getEnumCode(product.loanScheduleProcessingType),
    enableDownPayment: b(product.enableDownPayment),
    disbursedAmountPercentageForDownPayment: n(product.disbursedAmountPercentageForDownPayment),
    enableAutoRepaymentForDownPayment: b(product.enableAutoRepaymentForDownPayment),
    delinquencyBucketId: n((product.delinquencyBucket as Record<string, unknown>)?.id),
    enableInstallmentLevelDelinquency: b(product.enableInstallmentLevelDelinquency),

    paymentAllocations,
    creditAllocations,

    charges: Array.isArray(product.charges)
      ? (product.charges as Record<string, unknown>[]).map((c) => {
          const calcType = (c.chargeCalculationType as Record<string, unknown>) ?? {};
          const timeType = (c.chargeTimeType as Record<string, unknown>) ?? {};
          return {
            id: c.id as number,
            name: s(c.name),
            amount: n(c.amount) as number,
            chargeCalculationType: {
              id: (calcType.id as number) ?? 0,
              code: s(calcType.code) || "",
              value: s(calcType.value) || "",
            },
            chargeTimeType: {
              id: (timeType.id as number) ?? 0,
              code: s(timeType.code) || "",
              value: s(timeType.value) || "",
            },
            penalty: b(c.penalty),
          };
        })
      : [],

    accountingRule: getEnumId(product.accountingRule),

    // Fineract nests all GL account objects under accountingMappings
    ...(() => {
      const am = (product.accountingMappings as Record<string, unknown>) ?? {};
      const aid = (key: string) => n((am[key] as Record<string, unknown>)?.id);
      return {
        fundSourceAccountId:                       aid("fundSourceAccount"),
        loanPortfolioAccountId:                    aid("loanPortfolioAccount"),
        transfersInSuspenseAccountId:              aid("transfersInSuspenseAccount"),
        interestOnLoanAccountId:                   aid("interestOnLoanAccount"),
        incomeFromFeeAccountId:                    aid("incomeFromFeeAccount"),
        incomeFromPenaltyAccountId:                aid("incomeFromPenaltyAccount"),
        incomeFromRecoveryAccountId:               aid("incomeFromRecoveryAccount"),
        incomeFromChargeOffInterestAccountId:      aid("incomeFromChargeOffInterestAccount"),
        incomeFromChargeOffFeesAccountId:          aid("incomeFromChargeOffFeesAccount"),
        incomeFromChargeOffPenaltyAccountId:       aid("incomeFromChargeOffPenaltyAccount"),
        incomeFromGoodwillCreditInterestAccountId: aid("incomeFromGoodwillCreditInterestAccount"),
        incomeFromGoodwillCreditFeesAccountId:     aid("incomeFromGoodwillCreditFeesAccount"),
        incomeFromGoodwillCreditPenaltyAccountId:  aid("incomeFromGoodwillCreditPenaltyAccount"),
        writeOffAccountId:                         aid("writeOffAccount"),
        goodwillCreditAccountId:                   aid("goodwillCreditAccount"),
        chargeOffExpenseAccountId:                 aid("chargeOffExpenseAccount"),
        chargeOffFraudExpenseAccountId:            aid("chargeOffFraudExpenseAccount"),
        overpaymentLiabilityAccountId:             aid("overpaymentLiabilityAccount"),
        receivableInterestAccountId:               aid("receivableInterestAccount"),
        receivableFeeAccountId:                    aid("receivableFeeAccount"),
        receivablePenaltyAccountId:                aid("receivablePenaltyAccount"),
      };
    })(),

    // advancedAccountingRules is derived from whether any mapping arrays are non-empty
    advancedAccountingRules: !!(
      (Array.isArray(product.paymentChannelToFundSourceMappings) && (product.paymentChannelToFundSourceMappings as unknown[]).length > 0) ||
      (Array.isArray(product.feeToIncomeAccountMappings) && (product.feeToIncomeAccountMappings as unknown[]).length > 0) ||
      (Array.isArray(product.penaltyToIncomeAccountMappings) && (product.penaltyToIncomeAccountMappings as unknown[]).length > 0) ||
      (Array.isArray(product.chargeOffReasonToExpenseAccountMappings) && (product.chargeOffReasonToExpenseAccountMappings as unknown[]).length > 0)
    ),
    paymentChannelToFundSourceMappings: Array.isArray(product.paymentChannelToFundSourceMappings)
      ? (product.paymentChannelToFundSourceMappings as Record<string, unknown>[]).map((m) => ({
          paymentTypeId: ((m.paymentType as Record<string, unknown>)?.id as number) ?? 0,
          fundSourceAccountId: ((m.fundSourceAccount as Record<string, unknown>)?.id as number) ?? 0,
        }))
      : [],
    feeToIncomeAccountMappings: Array.isArray(product.feeToIncomeAccountMappings)
      ? (product.feeToIncomeAccountMappings as Record<string, unknown>[]).map((m) => ({
          chargeId: ((m.charge as Record<string, unknown>)?.id as number) ?? 0,
          incomeAccountId: ((m.incomeAccount as Record<string, unknown>)?.id as number) ?? 0,
        }))
      : [],
    penaltyToIncomeAccountMappings: Array.isArray(product.penaltyToIncomeAccountMappings)
      ? (product.penaltyToIncomeAccountMappings as Record<string, unknown>[]).map((m) => ({
          chargeId: ((m.charge as Record<string, unknown>)?.id as number) ?? 0,
          incomeAccountId: ((m.incomeAccount as Record<string, unknown>)?.id as number) ?? 0,
        }))
      : [],
    chargeOffReasonToExpenseAccountMappings: Array.isArray(product.chargeOffReasonToExpenseAccountMappings)
      ? (product.chargeOffReasonToExpenseAccountMappings as Record<string, unknown>[]).map((m) => ({
          chargeOffReasonCodeValueId: ((m.chargeOffReasonCodeValue as Record<string, unknown>)?.id as number) ?? 0,
          expenseAccountId: ((m.expenseAccount as Record<string, unknown>)?.id as number) ?? 0,
        }))
      : [],
  };
}

export default function EditLoanProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [template, setTemplate] = useState<LoanProductTemplate | null>(null);
  const [initialData, setInitialData] = useState<LoanProductFormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // Fetch product with ?template=true — Fineract returns product values + all template
        // options (including accountingMappingOptions) combined, exactly as Mifos does.
        const [productRes, idFlagRes] = await Promise.all([
          fetch(`/api/fineract/loanproducts/${id}?template=true`),
          fetch(`/api/invoice-discounting-products?fineractProductId=${id}`).catch(() => null),
        ]);

        const productBody = await productRes.json();
        if (!productRes.ok) throw new Error(productBody?.error || "Failed to load product");

        let isInvoiceDiscounting = false;
        try {
          if (idFlagRes?.ok) {
            const idFlagBody = await idFlagRes.json();
            isInvoiceDiscounting = idFlagBody?.isInvoiceDiscounting ?? false;
          }
        } catch {
          // non-fatal
        }

        // The combined response is the template (has all option arrays) AND the product data
        setTemplate(productBody as LoanProductTemplate);
        setInitialData({
          ...mapFineractProductToForm(productBody),
          isInvoiceDiscounting,
        });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/products/loan-products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loan Products
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">Edit Loan Product</h1>
        <p className="mt-1 text-muted-foreground">
          Modify the loan product configuration and save changes to Fineract.
        </p>
      </div>

      {isLoading && <LoanProductFormSkeleton />}

      {loadError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {template && initialData && !isLoading && (
        <LoanProductStepper
          template={template}
          initialData={initialData}
          productId={Number(id)}
        />
      )}
    </div>
  );
}
