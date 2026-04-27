"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { StepDetails } from "./step-details";
import { StepCurrency } from "./step-currency";
import { StepInterestRefund } from "./step-interest-refund";
import { StepSettings } from "./step-settings";
import { StepPaymentAllocation } from "./step-payment-allocation";
import { StepTerms } from "./step-terms";
import { StepCharges } from "./step-charges";
import { StepAccounting } from "./step-accounting";

import type {
  LoanProductFormData,
  LoanProductTemplate,
} from "@/shared/types/loan-product";
import {
  buildFineractPayload,
  buildInitialPaymentAllocations,
  defaultLoanProductFormData,
  ADVANCED_PAYMENT_ALLOCATION_STRATEGY,
} from "@/shared/types/loan-product";

interface Step {
  id: string;
  label: string;
}

const ALL_STEPS: Step[] = [
  { id: "details",            label: "Details" },
  { id: "currency",           label: "Currency" },
  { id: "interest-refund",    label: "Int. Refund" },
  { id: "settings",           label: "Settings" },
  { id: "payment-allocation", label: "Payment Alloc." },
  { id: "terms",              label: "Terms" },
  { id: "charges",            label: "Charges" },
  { id: "accounting",         label: "Accounting" },
];

interface LoanProductStepperProps {
  template: LoanProductTemplate;
  initialData?: LoanProductFormData;
  productId?: number;
}

/** Build smart defaults from what the template provides as first/preferred options. */
function buildTemplateDefaults(template: LoanProductTemplate): Partial<LoanProductFormData> {
  const first = <T extends { id: number }>(arr: T[] | undefined) => arr?.[0]?.id ?? "";
  const firstCode = (arr: { code: string }[] | undefined) => arr?.[0]?.code ?? "";

  return {
    amortizationType:              first(template.amortizationTypeOptions),
    interestType:                  first(template.interestTypeOptions),
    interestCalculationPeriodType: first(template.interestCalculationPeriodTypeOptions),
    allowPartialPeriodInterestCalculation:
      template.allowPartialPeriodInterestCalculation ??
      template.allowPartialPeriodInterestCalcualtion ??
      false,
    daysInYearType:                first(template.daysInYearTypeOptions),
    daysInMonthType:               first(template.daysInMonthTypeOptions),
    repaymentFrequencyType:        first(template.repaymentFrequencyTypeOptions),
    interestRateFrequencyType:     first(template.interestRateFrequencyTypeOptions),
    transactionProcessingStrategyCode: firstCode(template.transactionProcessingStrategyOptions),
    accountingRule:                first(template.accountingRuleOptions),
    currencyCode:                  template.currencyOptions?.[0]?.code ?? "",
    digitsAfterDecimal:            template.currencyOptions?.[0]?.decimalPlaces ?? 2,
    repaymentEvery:                1,
    numberOfRepayments:            12,
  };
}

// ─── Step indicator ─────────────────────────────────────────────────────────

interface StepHeaderProps {
  steps: Step[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (i: number) => void;
}

function StepHeader({ steps, currentStep, completedSteps, onStepClick }: StepHeaderProps) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-5 shadow-sm">
      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(index);
          const isCurrent   = index === currentStep;
          const isPending   = !isCompleted && !isCurrent;
          const isAccessible =
            index <= currentStep || completedSteps.has(index - 1) || index === 0;

          return (
            <li key={step.id} className="flex flex-1 items-center">
              {/* Step block */}
              <button
                type="button"
                onClick={() => isAccessible && onStepClick(index)}
                disabled={!isAccessible}
                className={cn(
                  "group flex flex-1 flex-col items-center gap-1.5 text-center transition-opacity",
                  !isAccessible && "cursor-not-allowed opacity-40"
                )}
              >
                {/* "STEP N" label */}
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                  Step {index + 1}
                </span>

                {/* Circle */}
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all",
                    isCompleted
                      ? "border-green-500 bg-green-500 text-white"
                      : isCurrent
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-dashed border-muted-foreground/40 bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4 stroke-[3]" /> : index + 1}
                </span>

                {/* Name */}
                <span
                  className={cn(
                    "text-[11px] font-semibold leading-tight",
                    isCompleted
                      ? "text-green-600 dark:text-green-400"
                      : isCurrent
                      ? "text-foreground"
                      : "text-muted-foreground/60"
                  )}
                >
                  {step.label}
                </span>

                {/* Status badge */}
                <span
                  className={cn(
                    "text-[9px] font-semibold uppercase tracking-wide",
                    isCompleted
                      ? "text-green-500"
                      : isCurrent
                      ? "text-primary"
                      : "text-muted-foreground/40"
                  )}
                >
                  {isCompleted ? "Completed" : isCurrent ? "In Progress" : "Pending"}
                </span>
              </button>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-1 hidden h-0.5 w-6 shrink-0 rounded-full sm:block",
                    completedSteps.has(index) ? "bg-green-500" : "bg-border"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Main stepper ────────────────────────────────────────────────────────────

export function LoanProductStepper({
  template,
  initialData,
  productId,
}: LoanProductStepperProps) {
  const router = useRouter();

  const templateDefaults = useMemo(() => buildTemplateDefaults(template), [template]);

  const [form, setForm] = useState<LoanProductFormData>(() =>
    initialData ?? { ...defaultLoanProductFormData, ...templateDefaults }
  );
  const [currentStep, setCurrentStep]     = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);

  const hasInterestRefundStep = (template.supportedInterestRefundTypes?.length ?? 0) > 0;
  const isProgressive = form.loanScheduleType === "PROGRESSIVE";

  const steps = ALL_STEPS.filter((s) => {
    if (s.id === "interest-refund" && !hasInterestRefundStep) return false;
    if (s.id === "payment-allocation" && !isProgressive) return false;
    return true;
  });

  const totalSteps = steps.length;
  const isLastStep = currentStep === totalSteps - 1;

  const onChange = (updates: Partial<LoanProductFormData>) => {
    // When toggling invoice discounting on, lock all nominal interest fields to 0
    if (updates.isInvoiceDiscounting === true) {
      updates = {
        ...updates,
        interestRatePerPeriod: 0,
        minInterestRatePerPeriod: 0,
        maxInterestRatePerPeriod: 0,
      };
    }

    // When switching to PROGRESSIVE initialize payment allocations from template if empty
    setForm((prev) => {
      const next = { ...prev, ...updates };
      if (
        updates.loanScheduleType === "PROGRESSIVE" &&
        next.paymentAllocations.length === 0
      ) {
        const { paymentAllocations, creditAllocations } = buildInitialPaymentAllocations(template);
        next.paymentAllocations = paymentAllocations;
        next.creditAllocations = creditAllocations;
      }
      // When switching away from PROGRESSIVE, clear allocation data
      if (
        updates.loanScheduleType !== undefined &&
        updates.loanScheduleType !== "PROGRESSIVE"
      ) {
        next.paymentAllocations = [];
        next.creditAllocations = [];
      }
      return next;
    });
  };

  const handleNext = () => {
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleStepClick = (index: number) => {
    if (index <= currentStep || completedSteps.has(index - 1) || index === 0) {
      setCurrentStep(index);
    }
  };

  const validateCurrentStep = (): string | null => {
    const stepId = steps[currentStep].id;
    if (stepId === "details") {
      if (!form.name.trim())       return "Product name is required.";
      if (!form.shortName.trim())  return "Short name is required.";
      if (form.shortName.length > 4) return "Short name must be 4 characters or fewer.";
    }
    if (stepId === "currency") {
      if (!form.currencyCode)           return "Currency is required.";
      if (form.digitsAfterDecimal === "") return "Decimal places is required.";
    }
    if (stepId === "settings") {
      if (form.amortizationType === "")           return "Amortization type is required.";
      if (form.interestType === "")               return "Interest type is required.";
      if (!form.transactionProcessingStrategyCode) return "Repayment strategy is required.";
    }
    if (stepId === "terms") {
      if (!form.isLinkedToFloatingInterestRates && form.interestRatePerPeriod === "")
        return "Nominal interest rate is required.";
      if (form.repaymentFrequencyType === "") return "Repayment frequency is required.";
      if (form.repaymentEvery === "")         return "Repaid every is required.";
      if (form.numberOfRepayments === "")     return "Number of repayments is required.";
    }
    if (stepId === "accounting") {
      if (form.accountingRule === "") return "Accounting rule is required.";
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateCurrentStep();
    if (validationError) { setSubmitError(validationError); return; }
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      console.log("[LoanProductStepper] Submitting — isInvoiceDiscounting:", form.isInvoiceDiscounting, "| productId:", productId);
      let payload = buildFineractPayload(form);

      if (form.isInvoiceDiscounting) {
        const chargeRes = await fetch("/api/charge-products/invoice-discount-income", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currencyCode: form.currencyCode }),
        });
        const chargeBody = await chargeRes.json().catch(() => ({}));

        if (!chargeRes.ok) {
          throw new Error(
            chargeBody?.error ||
              "Failed to ensure the INVOICE_INCOME charge before saving the product"
          );
        }

        const invoiceIncomeChargeId = Number(chargeBody?.data?.fineractChargeId);
        if (!Number.isFinite(invoiceIncomeChargeId)) {
          throw new Error("INVOICE_INCOME charge is missing a valid Fineract charge ID");
        }

        const existingCharges = Array.isArray(payload.charges)
          ? (payload.charges as Array<{ id: number }>)
          : [];

        if (!existingCharges.some((charge) => Number(charge.id) === invoiceIncomeChargeId)) {
          payload = {
            ...payload,
            charges: [...existingCharges, { id: invoiceIncomeChargeId }],
          };
        }
      }

      const isEdit  = Boolean(productId);
      const url     = isEdit
        ? `/api/fineract/loanproducts/${productId}`
        : "/api/fineract/loanproducts";

      const res  = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();

      if (!res.ok) {
        throw new Error(
          body?.errors?.[0]?.defaultUserMessage ||
          body?.defaultUserMessage ||
          body?.error ||
          "Failed to save loan product"
        );
      }

      // Fineract returns { resourceId: <number|string> } on create; on edit we already know the ID
      console.log("[LoanProductStepper] Fineract response body:", body);
      console.log("[LoanProductStepper] isInvoiceDiscounting:", form.isInvoiceDiscounting);

      const rawId = isEdit ? productId : (body.resourceId ?? body.loanId ?? body.id);
      const fineractProductId: number | undefined =
        rawId != null && !isNaN(Number(rawId)) ? Number(rawId) : undefined;

      console.log("[LoanProductStepper] fineractProductId resolved to:", fineractProductId);

      if (fineractProductId == null) {
        console.warn("[LoanProductStepper] Could not resolve Fineract product ID — skipping DB save. Response was:", body);
      } else if (form.isInvoiceDiscounting) {
        console.log("[LoanProductStepper] Saving invoice discounting record for product:", fineractProductId);
        const idRes = await fetch("/api/invoice-discounting-products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fineractProductId, productName: form.name }),
        });
        if (!idRes.ok) {
          const idErr = await idRes.json().catch(() => ({}));
          console.error("[LoanProductStepper] Failed to save invoice discounting record:", idErr);
          toast.warning("Product saved to Fineract but the invoice discounting flag could not be stored.");
        } else {
          console.log("[LoanProductStepper] Invoice discounting record saved successfully.");
        }
      } else if (isEdit) {
        // Flag turned off while editing — remove the record if it existed
        await fetch(`/api/invoice-discounting-products?fineractProductId=${fineractProductId}`, {
          method: "DELETE",
        });
      }

      toast.success(isEdit ? "Loan product updated." : "Loan product created.");
      router.push("/products/loan-products");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save loan product";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextOrSubmit = () => {
    const validationError = validateCurrentStep();
    if (validationError) { setSubmitError(validationError); return; }
    setSubmitError(null);
    if (isLastStep) handleSubmit();
    else handleNext();
  };

  const currentStepObj = steps[currentStep];

  const renderStep = () => {
    switch (currentStepObj.id) {
      case "details":            return <StepDetails form={form} template={template} onChange={onChange} />;
      case "currency":           return <StepCurrency form={form} template={template} onChange={onChange} />;
      case "interest-refund":    return <StepInterestRefund form={form} template={template} onChange={onChange} />;
      case "settings":           return <StepSettings form={form} template={template} onChange={onChange} />;
      case "payment-allocation": return <StepPaymentAllocation form={form} template={template} onChange={onChange} />;
      case "terms":              return <StepTerms form={form} template={template} onChange={onChange} />;
      case "charges":            return <StepCharges form={form} template={template} onChange={onChange} />;
      case "accounting":         return <StepAccounting form={form} template={template} onChange={onChange} />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Step indicator */}
      <StepHeader
        steps={steps}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
      />

      {/* Scrollable step content */}
      <Card className="overflow-hidden">
        <CardContent className="max-h-[calc(100vh-26rem)] overflow-y-auto p-6">
          {renderStep()}
        </CardContent>
      </Card>

      {/* Validation error */}
      {submitError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      {/* Navigation — always below the card */}
      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentStep === 0 || isSubmitting}
          className="min-w-[110px]"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>

        <p className="text-xs text-muted-foreground">
          Step <span className="font-semibold text-foreground">{currentStep + 1}</span> of{" "}
          <span className="font-semibold text-foreground">{totalSteps}</span>
          {" · "}
          <span className="font-medium text-foreground">{currentStepObj.label}</span>
        </p>

        <Button
          onClick={handleNextOrSubmit}
          disabled={isSubmitting}
          className="min-w-[110px]"
        >
          {isSubmitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {isLastStep ? (
            productId ? "Update Product" : "Create Product"
          ) : (
            <>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
