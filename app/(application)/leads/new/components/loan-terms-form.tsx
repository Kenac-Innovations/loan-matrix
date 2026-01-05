"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Calendar } from "@/components/ui/calender";
import { cn } from "@/lib/utils";

// Form validation schema for loan terms
const loanTermsSchema = z.object({
  // Principal
  principal: z.number().min(1, "Principal amount is required"),

  // Term Options
  loanTerm: z.number().min(1, "Loan term is required"),
  termFrequency: z.string().min(1, "Term frequency is required"),

  // Repayments
  numberOfRepayments: z.number().min(1, "Number of repayments is required"),
  firstRepaymentOn: z.date().optional(),
  interestChargedFrom: z.date().optional(),

  // Repaid Every
  repaymentEvery: z.number().min(1, "Repayment frequency is required"),
  repaymentFrequency: z.string().min(1, "Repayment frequency type is required"),
  repaymentFrequencyNthDay: z.string().optional(),
  repaymentFrequencyDayOfWeek: z.string().optional(),

  // Nominal Interest Rate
  nominalInterestRate: z.number().min(0, "Interest rate must be positive"),
  interestRateFrequency: z
    .string()
    .min(1, "Interest rate frequency is required"),
  interestMethod: z.string().min(1, "Interest method is required"),
  amortization: z.string().min(1, "Amortization type is required"),
  isEqualAmortization: z.boolean().optional().default(false),

  // Loan Schedule
  loanScheduleType: z.string().optional(),
  repaymentStrategy: z.string().min(1, "Repayment strategy is required"),
  balloonRepaymentAmount: z.number().optional().default(0),

  // Interest Calculations
  interestCalculationPeriod: z
    .string()
    .min(1, "Interest calculation period is required"),
  calculateInterestForExactDays: z.boolean().optional().default(false),
  arrearsTolerance: z.number().optional().default(0),
  interestFreePeriod: z.number().optional().default(0),

  // Moratorium
  graceOnPrincipalPayment: z.number().optional().default(0),
  graceOnInterestPayment: z.number().optional().default(0),
  onArrearsAgeing: z.number().optional().default(0),

  // Recalculate Interest
  recalculateInterest: z.string().optional(),

  // Collaterals
  collaterals: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number(),
        totalValue: z.number(),
      })
    )
    .optional()
    .default([]),
});

type LoanTermsFormData = z.infer<typeof loanTermsSchema>;

interface LoanTemplate {
  principal: number;
  termFrequency: number;
  numberOfRepayments: number;
  repaymentEvery: number;
  interestRatePerPeriod: number;
  expectedDisbursementDate: number[];
  termFrequencyTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  termPeriodFrequencyType?: {
    id: number;
    code: string;
    value: string;
  };
  repaymentFrequencyTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  repaymentFrequencyType?: {
    id: number;
    code: string;
    value: string;
  };
  repaymentFrequencyNthDayTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  repaymentFrequencyDaysOfWeekTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  interestRateFrequencyTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  interestRateFrequencyType?: {
    id: number;
    code: string;
    value: string;
  };
  interestTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  interestType?: {
    id: number;
    code: string;
    value: string;
  };
  amortizationTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  amortizationType?: {
    id: number;
    code: string;
    value: string;
  };
  loanScheduleTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  transactionProcessingStrategyOptions: Array<{
    code: string;
    name: string;
  }>;
  transactionProcessingStrategyCode?: string;
  interestCalculationPeriodTypeOptions: Array<{
    id: number;
    code: string;
    value: string;
  }>;
  interestCalculationPeriodType?: {
    id: number;
    code: string;
    value: string;
  };
  isEqualAmortization?: boolean;
  loanCollateralOptions: Array<{
    id: number;
    name: string;
    description: string;
    active: boolean;
  }>;
  charges?: Array<{
    id: number;
    chargeId: number;
    name: string;
    chargeTimeType: {
      id: number;
      code: string;
      value: string;
    };
    chargeCalculationType: {
      id: number;
      code: string;
      value: string;
    };
    amount: number;
    currency: {
      code: string;
      name: string;
    };
    percentage: number;
    active: boolean;
    penalty: boolean;
  }>;
  chargeOptions?: Array<{
    id: number;
    name: string;
    active: boolean;
    penalty: boolean;
  }>;
}

interface LoanTermsFormProps {
  loanTemplate: LoanTemplate | null;
  clientId?: number;
  productId?: number;
  leadId?: string;
  onSubmit: (data: LoanTermsFormData) => void;
  onBack: () => void;
  onNext: () => void;
  onComplete?: () => void;
  sharedFirstRepaymentOn?: Date;
  onFirstRepaymentDateChange?: (date: Date) => void;
}

export function LoanTermsForm({
  loanTemplate: initialLoanTemplate,
  clientId,
  productId,
  leadId,
  onSubmit,
  onBack,
  onNext,
  onComplete,
  sharedFirstRepaymentOn,
  onFirstRepaymentDateChange,
}: LoanTermsFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loanTemplate, setLoanTemplate] = useState<LoanTemplate | null>(
    initialLoanTemplate
  );
  const [editableCharges, setEditableCharges] = useState<
    Array<{
      chargeId: number;
      name: string;
      amount: number;
      dueDate: Date;
      originalCharge?: any;
    }>
  >([]);
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [selectedChargeOption, setSelectedChargeOption] = useState<string>("");
  const [newChargeAmount, setNewChargeAmount] = useState<string>("");
  const [newChargeDueDate, setNewChargeDueDate] = useState<Date | undefined>(
    undefined
  );
  const [sectionCompletion, setSectionCompletion] = useState({
    basicTerms: false,
    interestSchedule: false,
    chargesCollateral: false,
  });
  const [sectionSaved, setSectionSaved] = useState({
    basicTerms: false,
    interestSchedule: false,
    chargesCollateral: false,
  });

  // Track if template values have been set
  const frequencyValuesSet = useRef(false);
  const templateValuesSet = useRef(false);

  // Compute display values directly from template - this survives remounts!
  const templateDerivedValues = useMemo(() => {
    if (!loanTemplate) {
      return {
        termFrequency: "",
        repaymentFrequency: "",
        interestRateFrequency: "",
        interestMethod: "",
        amortization: "",
        repaymentStrategy: "",
        interestCalculationPeriod: "",
      };
    }

    const termFreq = loanTemplate.termPeriodFrequencyType?.id?.toString() || "";
    const repaymentFreq =
      loanTemplate.repaymentFrequencyType?.id?.toString() || "";
    const interestRateFreq =
      loanTemplate.interestRateFrequencyType?.id?.toString() || "";
    const interestMethod = loanTemplate.interestType?.id?.toString() || "";
    const amortization = loanTemplate.amortizationType?.id?.toString() || "";
    const repaymentStrategy =
      loanTemplate.transactionProcessingStrategyCode || "";
    const interestCalcPeriod =
      loanTemplate.interestCalculationPeriodType?.id?.toString() || "";

    console.log("=== TEMPLATE DERIVED VALUES (computed from prop) ===", {
      termFreq,
      repaymentFreq,
      interestRateFreq,
      interestMethod,
      amortization,
      repaymentStrategy,
      interestCalcPeriod,
    });

    return {
      termFrequency: termFreq,
      repaymentFrequency: repaymentFreq,
      interestRateFrequency: interestRateFreq,
      interestMethod,
      amortization,
      repaymentStrategy,
      interestCalculationPeriod: interestCalcPeriod,
    };
  }, [loanTemplate]);

  // Use a ref to store frequency values - this is stable and won't be affected by re-renders
  const frequencyValuesRef = useRef({
    termFrequency: "",
    repaymentFrequency: "",
    interestRateFrequency: "",
    interestMethod: "",
    amortization: "",
    repaymentStrategy: "",
    interestCalculationPeriod: "",
  });

  // Store frequency values in state to trigger re-renders when values change
  const [frequencyState, setFrequencyState] = useState({
    termFrequency: "",
    repaymentFrequency: "",
    interestRateFrequency: "",
    interestMethod: "",
    amortization: "",
    repaymentStrategy: "",
    interestCalculationPeriod: "",
  });

  // Helper function to update frequency values - updates both ref and state
  const updateFrequencyValues = (values: Partial<typeof frequencyState>) => {
    // Only update if new values are non-empty
    const newValues = { ...frequencyValuesRef.current };
    let hasChanges = false;

    Object.entries(values).forEach(([key, value]) => {
      if (value && value !== newValues[key as keyof typeof newValues]) {
        newValues[key as keyof typeof newValues] = value;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      console.log("Updating frequency values:", {
        old: frequencyValuesRef.current,
        new: newValues,
      });
      frequencyValuesRef.current = newValues;
      setFrequencyState(newValues);
    }
  };

  // Debug: log component mount/unmount
  useEffect(() => {
    console.log("=== LOAN TERMS FORM MOUNTED ===");
    return () => {
      console.log("=== LOAN TERMS FORM UNMOUNTED ===");
    };
  }, []);

  // Debug: log when frequencyState changes
  useEffect(() => {
    console.log("=== FREQUENCY STATE CHANGED ===", frequencyState);
  }, [frequencyState]);

  const form = useForm<LoanTermsFormData>({
    resolver: zodResolver(loanTermsSchema) as any,
    defaultValues: {
      principal: 0,
      loanTerm: 0,
      termFrequency: "",
      numberOfRepayments: 0,
      repaymentEvery: 0,
      repaymentFrequency: "",
      nominalInterestRate: 0,
      interestRateFrequency: "",
      interestMethod: "",
      amortization: "",
      isEqualAmortization: false,
      repaymentStrategy: "",
      balloonRepaymentAmount: 0,
      interestCalculationPeriod: "",
      calculateInterestForExactDays: false,
      arrearsTolerance: 0,
      interestFreePeriod: 0,
      graceOnPrincipalPayment: 0,
      graceOnInterestPayment: 0,
      onArrearsAgeing: 0,
      collaterals: [],
    },
  });

  // Fetch detailed template when clientId and productId are available
  useEffect(() => {
    const fetchDetailedTemplate = async () => {
      // Only fetch if we have clientId and productId, and don't already have a template with charges
      if (!clientId || !productId) return;
      // If we already have a template with charges, don't refetch
      if (loanTemplate?.charges && loanTemplate.charges.length > 0) return;

      // Reset frequency values flag only when we're actually fetching a new template
      frequencyValuesSet.current = false;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/fineract/loans/template?clientId=${clientId}&productId=${productId}&activeOnly=true&staffInSelectedOfficeOnly=true&templateType=individual`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch detailed loan template");
        }

        const detailedTemplate = await response.json();
        console.log("Detailed loan template:", detailedTemplate);
        setLoanTemplate(detailedTemplate);

        // Initialize editable charges from template
        if (detailedTemplate.charges && detailedTemplate.charges.length > 0) {
          const initialCharges = detailedTemplate.charges.map(
            (charge: any) => ({
              chargeId: charge.chargeId || charge.id,
              name: charge.name || "Unknown Charge",
              amount: charge.amount || 0,
              dueDate: new Date(), // Default to today, user can edit
              originalCharge: charge,
            })
          );
          setEditableCharges(initialCharges);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch detailed loan template"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetailedTemplate();
  }, [clientId, productId]);

  // Populate form with template data when it changes
  useEffect(() => {
    if (loanTemplate) {
      try {
        console.log("=== TEMPLATE POPULATION START ===");
        console.log("Populating form with template data:", loanTemplate);
        console.log(
          "Template has termPeriodFrequencyType:",
          !!loanTemplate.termPeriodFrequencyType
        );
        console.log(
          "Template has repaymentFrequencyType:",
          !!loanTemplate.repaymentFrequencyType
        );
        console.log(
          "Template has interestRateFrequencyType:",
          !!loanTemplate.interestRateFrequencyType
        );
        console.log(
          "AmortizationType from template:",
          loanTemplate.amortizationType
        );
        console.log(
          "AmortizationTypeOptions:",
          loanTemplate.amortizationTypeOptions
        );

        // Principal
        if (loanTemplate.principal !== undefined) {
          form.setValue("principal", loanTemplate.principal);
          console.log("Set principal:", loanTemplate.principal);
        }

        // Term Options
        if (loanTemplate.termFrequency !== undefined) {
          form.setValue("loanTerm", loanTemplate.termFrequency);
          console.log("Set loanTerm:", loanTemplate.termFrequency);
        }

        // Term Frequency - directly use the id from termPeriodFrequencyType
        let termFreqValue = "";
        if (loanTemplate.termPeriodFrequencyType?.id !== undefined) {
          termFreqValue = loanTemplate.termPeriodFrequencyType.id.toString();
          console.log(
            "Set termFrequency from template:",
            termFreqValue,
            "options available:",
            loanTemplate.termFrequencyTypeOptions?.length
          );
        } else if (loanTemplate.termFrequencyTypeOptions?.length > 0) {
          // Fallback to first option
          termFreqValue =
            loanTemplate.termFrequencyTypeOptions[0].id.toString();
          console.log("Set termFrequency fallback:", termFreqValue);
        }
        if (termFreqValue) {
          form.setValue("termFrequency", termFreqValue, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: false,
          });
        }

        // Repayments
        if (loanTemplate.numberOfRepayments !== undefined) {
          form.setValue("numberOfRepayments", loanTemplate.numberOfRepayments);
        }
        if (loanTemplate.repaymentEvery !== undefined) {
          form.setValue("repaymentEvery", loanTemplate.repaymentEvery);
        }

        // Repayment Frequency - directly use the id from repaymentFrequencyType
        let repaymentFreqValue = "";
        if (loanTemplate.repaymentFrequencyType?.id !== undefined) {
          repaymentFreqValue =
            loanTemplate.repaymentFrequencyType.id.toString();
          console.log(
            "Set repaymentFrequency from template:",
            repaymentFreqValue,
            "options available:",
            loanTemplate.repaymentFrequencyTypeOptions?.length
          );
        } else if (loanTemplate.repaymentFrequencyTypeOptions?.length > 0) {
          // Fallback to first option
          repaymentFreqValue =
            loanTemplate.repaymentFrequencyTypeOptions[0].id.toString();
          console.log("Set repaymentFrequency fallback:", repaymentFreqValue);
        }
        if (repaymentFreqValue) {
          form.setValue("repaymentFrequency", repaymentFreqValue, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: false,
          });
        }

        // Interest Rate
        if (loanTemplate.interestRatePerPeriod !== undefined) {
          form.setValue(
            "nominalInterestRate",
            loanTemplate.interestRatePerPeriod
          );
        }

        // Interest Rate Frequency - directly use the id from interestRateFrequencyType
        let interestFreqValue = "";
        if (loanTemplate.interestRateFrequencyType?.id !== undefined) {
          interestFreqValue =
            loanTemplate.interestRateFrequencyType.id.toString();
          console.log(
            "Set interestRateFrequency from template:",
            interestFreqValue
            );
        } else if (loanTemplate.interestRateFrequencyTypeOptions?.length > 0) {
          interestFreqValue =
            loanTemplate.interestRateFrequencyTypeOptions[0].id.toString();
          console.log("Set interestRateFrequency fallback:", interestFreqValue);
        }
        if (interestFreqValue) {
          form.setValue("interestRateFrequency", interestFreqValue, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: false,
          });
        }

        // Mark frequency values as set from template and store in state
        if (termFreqValue || repaymentFreqValue || interestFreqValue) {
          frequencyValuesSet.current = true;
          console.log("Frequency values marked as SET:", {
            termFreqValue,
            repaymentFreqValue,
            interestFreqValue,
          });
        }

        // Interest Method
        // Use interestType from template to find matching option
        let interestMethodValue = "";
        if (
          loanTemplate.interestType &&
          loanTemplate.interestTypeOptions?.length > 0
        ) {
          const matchingInterestType = loanTemplate.interestTypeOptions.find(
            (option) =>
              option.id === loanTemplate.interestType?.id ||
              option.value === loanTemplate.interestType?.value ||
              option.code === loanTemplate.interestType?.code
          );
          if (matchingInterestType) {
            interestMethodValue = matchingInterestType.id.toString();
            form.setValue("interestMethod", interestMethodValue);
          }
        } else if (loanTemplate.interestTypeOptions?.length > 0) {
          const defaultInterestMethod =
            loanTemplate.interestTypeOptions.find((t) => t.id === 1) ||
            loanTemplate.interestTypeOptions[0];
          interestMethodValue = defaultInterestMethod.id.toString();
          form.setValue("interestMethod", interestMethodValue);
        }

        // Amortization
        // Use amortizationType from template to find matching option (e.g., "Equal installments")
        let amortizationValue = "";
        if (
          loanTemplate.amortizationType &&
          loanTemplate.amortizationTypeOptions?.length > 0
        ) {
          console.log("Looking for matching amortization option...");
          console.log(
            "Template amortizationType:",
            loanTemplate.amortizationType
          );
          console.log(
            "Available options:",
            loanTemplate.amortizationTypeOptions
          );

          const matchingAmortization =
            loanTemplate.amortizationTypeOptions.find(
              (option) =>
                option.id === loanTemplate.amortizationType?.id ||
                option.value === loanTemplate.amortizationType?.value ||
                option.code === loanTemplate.amortizationType?.code
            );

          console.log("Matching amortization found:", matchingAmortization);

          if (matchingAmortization) {
            amortizationValue = matchingAmortization.id.toString();
            form.setValue("amortization", amortizationValue);
            console.log("Set amortization to:", amortizationValue);
          } else {
            console.warn(
              "No matching amortization option found, using default"
            );
            const defaultAmortization =
              loanTemplate.amortizationTypeOptions.find((t) => t.id === 1) ||
              loanTemplate.amortizationTypeOptions[0];
            if (defaultAmortization) {
              amortizationValue = defaultAmortization.id.toString();
              form.setValue("amortization", amortizationValue);
              console.log("Set amortization to default:", amortizationValue);
            }
          }
        } else if (loanTemplate.amortizationTypeOptions?.length > 0) {
          console.log("No amortizationType in template, using default");
          const defaultAmortization =
            loanTemplate.amortizationTypeOptions.find((t) => t.id === 1) ||
            loanTemplate.amortizationTypeOptions[0];
          if (defaultAmortization) {
            amortizationValue = defaultAmortization.id.toString();
            form.setValue("amortization", amortizationValue);
            console.log("Set amortization to default:", amortizationValue);
          }
        } else {
          console.warn("No amortizationTypeOptions available");
        }

        // Is Equal Amortization
        if (loanTemplate.isEqualAmortization !== undefined) {
          form.setValue(
            "isEqualAmortization",
            loanTemplate.isEqualAmortization
          );
        }

        // Repayment Strategy
        // Use transactionProcessingStrategyCode from template if available, otherwise find from options
        let repaymentStrategyValue = "";
        if (loanTemplate.transactionProcessingStrategyCode) {
          repaymentStrategyValue =
            loanTemplate.transactionProcessingStrategyCode;
          form.setValue("repaymentStrategy", repaymentStrategyValue);
        } else if (
          loanTemplate.transactionProcessingStrategyOptions?.length > 0
        ) {
          const defaultStrategy =
            loanTemplate.transactionProcessingStrategyOptions.find(
              (t) => t.code === "creocore-strategy"
            ) || loanTemplate.transactionProcessingStrategyOptions[0];
          repaymentStrategyValue = defaultStrategy.code;
          form.setValue("repaymentStrategy", repaymentStrategyValue);
        }

        // Interest Calculation Period
        // Use interestCalculationPeriodType from template to find matching option
        let interestCalcPeriodValue = "";
        if (
          loanTemplate.interestCalculationPeriodType &&
          loanTemplate.interestCalculationPeriodTypeOptions?.length > 0
        ) {
          const matchingCalcPeriod =
            loanTemplate.interestCalculationPeriodTypeOptions.find(
              (option) =>
                option.id === loanTemplate.interestCalculationPeriodType?.id ||
                option.value ===
                  loanTemplate.interestCalculationPeriodType?.value ||
                option.code === loanTemplate.interestCalculationPeriodType?.code
            );
          if (matchingCalcPeriod) {
            interestCalcPeriodValue = matchingCalcPeriod.id.toString();
            form.setValue("interestCalculationPeriod", interestCalcPeriodValue);
          }
        } else if (
          loanTemplate.interestCalculationPeriodTypeOptions?.length > 0
        ) {
          const defaultCalcPeriod =
            loanTemplate.interestCalculationPeriodTypeOptions.find(
              (t) => t.id === 1
            ) || loanTemplate.interestCalculationPeriodTypeOptions[0];
          interestCalcPeriodValue = defaultCalcPeriod.id.toString();
          form.setValue("interestCalculationPeriod", interestCalcPeriodValue);
        }

        // Store all template values in state to prevent them from being overwritten
        templateValuesSet.current = true;

        // Use the helper function that updates both ref and state
        updateFrequencyValues({
          termFrequency: termFreqValue,
          repaymentFrequency: repaymentFreqValue,
          interestRateFrequency: interestFreqValue,
          interestMethod: interestMethodValue,
          amortization: amortizationValue,
          repaymentStrategy: repaymentStrategyValue,
          interestCalculationPeriod: interestCalcPeriodValue,
        });

        console.log("All template values stored in state:", {
          termFreqValue,
          repaymentFreqValue,
          interestFreqValue,
          interestMethodValue,
          amortizationValue,
          repaymentStrategyValue,
          interestCalcPeriodValue,
        });

        // Set disbursement date for first repayment
        if (loanTemplate.expectedDisbursementDate) {
          const [year, month, day] = loanTemplate.expectedDisbursementDate;
          const disbursementDate = new Date(year, month - 1, day);
          form.setValue("firstRepaymentOn", disbursementDate);
          // interestChargedFrom defaults to null - not set from disbursement date
        }

        // Log form values IMMEDIATELY after setting them
        const immediateValues = form.getValues();
        console.log("=== IMMEDIATE FORM VALUES (right after setValue) ===");
        console.log("termFrequency:", immediateValues.termFrequency);
        console.log("repaymentFrequency:", immediateValues.repaymentFrequency);
        console.log(
          "interestRateFrequency:",
          immediateValues.interestRateFrequency
        );

        // Log form values after a delay to check if something is resetting them
        setTimeout(() => {
          const delayedValues = form.getValues();
          console.log("=== DELAYED FORM VALUES (100ms later) ===");
          console.log("termFrequency:", delayedValues.termFrequency);
          console.log("repaymentFrequency:", delayedValues.repaymentFrequency);
          console.log(
            "interestRateFrequency:",
            delayedValues.interestRateFrequency
          );

          if (delayedValues.termFrequency !== immediateValues.termFrequency) {
            console.error(
              "!!! termFrequency was CHANGED from",
              immediateValues.termFrequency,
              "to",
              delayedValues.termFrequency
            );
          }
        }, 100);

        console.log("=== TEMPLATE POPULATION END ===");
      } catch (err) {
        console.error("Error populating form:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to populate form with template data"
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanTemplate]); // form is stable from useForm, no need in deps

  // Load existing loan terms data when leadId is available
  useEffect(() => {
    const loadExistingLoanTerms = async () => {
      if (!leadId) return;

      console.log("=== LOAD EXISTING LOAN TERMS START ===");
      console.log(
        "frequencyValuesSet.current (at start):",
        frequencyValuesSet.current
      );
      console.log(
        "templateValuesSet.current (at start):",
        templateValuesSet.current
      );

      try {
        // Fetch both loan-terms and loan-details in parallel
        const [loanTermsResponse, loanDetailsResponse] = await Promise.all([
          fetch(`/api/leads/${leadId}/loan-terms`),
          fetch(`/api/leads/${leadId}/loan-details`),
        ]);

        // Check flags AFTER async operations - template might have been populated during fetch
        console.log("=== AFTER FETCH ===");
        console.log(
          "frequencyValuesSet.current (after fetch):",
          frequencyValuesSet.current
        );
        console.log(
          "templateValuesSet.current (after fetch):",
          templateValuesSet.current
        );

        let loanDetailsData: any = null;
        if (loanDetailsResponse.ok) {
          const detailsResult = await loanDetailsResponse.json();
          if (detailsResult.success && detailsResult.data) {
            loanDetailsData = detailsResult.data;
          }
        }

        if (loanTermsResponse.ok) {
          const result = await loanTermsResponse.json();
          if (result.success && result.data) {
            const loanTermsData = result.data;
            console.log("Loaded loan terms data:", loanTermsData);

            // Populate form fields - only if template values weren't already set
            if (loanTermsData.principal && !templateValuesSet.current) {
              form.setValue("principal", loanTermsData.principal);
            } else if (loanTermsData.principal) {
              console.log(
                "Skipping principal from saved data - already set from template"
              );
            }
            if (loanTermsData.loanTerm && !templateValuesSet.current) {
              form.setValue("loanTerm", loanTermsData.loanTerm);
            } else if (loanTermsData.loanTerm) {
              console.log(
                "Skipping loanTerm from saved data - already set from template"
              );
            }
            // Only set frequency if we have a value AND template values weren't already set
            if (loanTermsData.termFrequency && !frequencyValuesSet.current) {
              form.setValue("termFrequency", loanTermsData.termFrequency);
              console.log(
                "Setting termFrequency from saved data:",
                loanTermsData.termFrequency
              );
            } else if (loanTermsData.termFrequency) {
              console.log(
                "Skipping termFrequency from saved data - already set from template"
              );
            }
            // Only set numberOfRepayments if template values weren't already set
            if (
              loanTermsData.numberOfRepayments &&
              !templateValuesSet.current
            ) {
              form.setValue(
                "numberOfRepayments",
                loanTermsData.numberOfRepayments
              );
            } else if (loanTermsData.numberOfRepayments) {
              console.log(
                "Skipping numberOfRepayments from saved data - already set from template"
              );
            }
            // Only set repaymentEvery if template values weren't already set
            if (loanTermsData.repaymentEvery && !templateValuesSet.current) {
              form.setValue("repaymentEvery", loanTermsData.repaymentEvery);
            } else if (loanTermsData.repaymentEvery) {
              console.log(
                "Skipping repaymentEvery from saved data - already set from template"
              );
            }
            // Only set repaymentFrequency if we have a value AND template values weren't already set
            if (
              loanTermsData.repaymentFrequency &&
              !frequencyValuesSet.current
            ) {
              form.setValue(
                "repaymentFrequency",
                loanTermsData.repaymentFrequency
              );
              console.log(
                "Setting repaymentFrequency from saved data:",
                loanTermsData.repaymentFrequency
              );
            } else if (loanTermsData.repaymentFrequency) {
              console.log(
                "Skipping repaymentFrequency from saved data - already set from template"
              );
            }
            if (
              loanTermsData.nominalInterestRate &&
              !templateValuesSet.current
            ) {
              form.setValue(
                "nominalInterestRate",
                loanTermsData.nominalInterestRate
              );
            } else if (loanTermsData.nominalInterestRate) {
              console.log(
                "Skipping nominalInterestRate from saved data - already set from template"
              );
            }
            // Only set interestRateFrequency if we have a value AND template values weren't already set
            if (
              loanTermsData.interestRateFrequency &&
              !frequencyValuesSet.current
            ) {
              form.setValue(
                "interestRateFrequency",
                loanTermsData.interestRateFrequency
              );
              console.log(
                "Setting interestRateFrequency from saved data:",
                loanTermsData.interestRateFrequency
              );
            } else if (loanTermsData.interestRateFrequency) {
              console.log(
                "Skipping interestRateFrequency from saved data - already set from template"
              );
            }
            // Only set these values if template values weren't already set
            if (loanTermsData.interestMethod && !templateValuesSet.current) {
              form.setValue("interestMethod", loanTermsData.interestMethod);
              console.log(
                "Setting interestMethod from saved data:",
                loanTermsData.interestMethod
              );
            } else if (loanTermsData.interestMethod) {
              console.log(
                "Skipping interestMethod from saved data - already set from template"
              );
            }
            if (loanTermsData.amortization && !templateValuesSet.current) {
              form.setValue("amortization", loanTermsData.amortization);
              console.log(
                "Setting amortization from saved data:",
                loanTermsData.amortization
              );
            } else if (loanTermsData.amortization) {
              console.log(
                "Skipping amortization from saved data - already set from template"
              );
            }
            if (loanTermsData.isEqualAmortization !== undefined) {
              form.setValue(
                "isEqualAmortization",
                loanTermsData.isEqualAmortization
              );
            }
            if (loanTermsData.repaymentStrategy && !templateValuesSet.current) {
              form.setValue(
                "repaymentStrategy",
                loanTermsData.repaymentStrategy
              );
              console.log(
                "Setting repaymentStrategy from saved data:",
                loanTermsData.repaymentStrategy
              );
            } else if (loanTermsData.repaymentStrategy) {
              console.log(
                "Skipping repaymentStrategy from saved data - already set from template"
              );
            }
            if (
              loanTermsData.interestCalculationPeriod &&
              !templateValuesSet.current
            ) {
              form.setValue(
                "interestCalculationPeriod",
                loanTermsData.interestCalculationPeriod
              );
              console.log(
                "Setting interestCalculationPeriod from saved data:",
                loanTermsData.interestCalculationPeriod
              );
            } else if (loanTermsData.interestCalculationPeriod) {
              console.log(
                "Skipping interestCalculationPeriod from saved data - already set from template"
              );
            }
            if (loanTermsData.interestChargedFrom) {
              form.setValue(
                "interestChargedFrom",
                new Date(loanTermsData.interestChargedFrom)
              );
            }

            // Load charges if they exist
            if (
              loanTermsData.charges &&
              Array.isArray(loanTermsData.charges) &&
              loanTermsData.charges.length > 0
            ) {
              const loadedCharges = loanTermsData.charges.map((charge: any) => {
                // Parse due date - it might be in "dd MMMM yyyy" format or ISO string
                let dueDate = new Date();
                if (charge.dueDate) {
                  if (typeof charge.dueDate === "string") {
                    // Try parsing "dd MMMM yyyy" format first
                    try {
                      dueDate = new Date(charge.dueDate);
                      // If parsing fails, try parsing the format
                      if (isNaN(dueDate.getTime())) {
                        // Try parsing "dd MMMM yyyy" format manually
                        const dateParts = charge.dueDate.split(" ");
                        if (dateParts.length === 3) {
                          const day = parseInt(dateParts[0]);
                          const monthNames = [
                            "January",
                            "February",
                            "March",
                            "April",
                            "May",
                            "June",
                            "July",
                            "August",
                            "September",
                            "October",
                            "November",
                            "December",
                          ];
                          const month = monthNames.indexOf(dateParts[1]);
                          const year = parseInt(dateParts[2]);
                          if (month >= 0 && !isNaN(day) && !isNaN(year)) {
                            dueDate = new Date(year, month, day);
                          }
                        }
                      }
                    } catch (e) {
                      console.error("Error parsing charge due date:", e);
                      dueDate = new Date();
                    }
                  }
                }

                return {
                  chargeId: charge.chargeId,
                  name: charge.name || "Unknown Charge",
                  amount: charge.amount || 0,
                  dueDate: dueDate,
                  originalCharge: charge.originalCharge || charge,
                };
              });
              setEditableCharges(loadedCharges);
              console.log("Loaded charges from saved data:", loadedCharges);
            } else if (
              loanTemplate?.charges &&
              loanTemplate.charges.length > 0
            ) {
              // If no saved charges but template has charges, initialize from template
              const disbursementDate = loanTemplate.expectedDisbursementDate
                ? new Date(
                    loanTemplate.expectedDisbursementDate[0],
                    loanTemplate.expectedDisbursementDate[1] - 1,
                    loanTemplate.expectedDisbursementDate[2]
                  )
                : new Date();

              const initialCharges = loanTemplate.charges.map(
                (charge: any) => ({
                  chargeId: charge.chargeId || charge.id,
                  name: charge.name || "Unknown Charge",
                  amount: charge.amount || 0,
                  dueDate: disbursementDate,
                  originalCharge: charge,
                })
              );
              setEditableCharges(initialCharges);
            }
          }
        }

        // Always load firstRepaymentOn from loan-details (set on Loan tab)
        // This is done OUTSIDE the loanTermsData block so it runs even when there's no loan-terms
        if (loanDetailsData?.firstRepaymentOn) {
          const detailsDate = new Date(loanDetailsData.firstRepaymentOn);
          console.log(
            "LoanTermsForm: Loading firstRepaymentOn from loan-details:",
            detailsDate
          );
          form.setValue("firstRepaymentOn", detailsDate);
        }

        console.log("=== LOAD EXISTING LOAN TERMS END ===");
        console.log("Form values after load:", form.getValues());
      } catch (error) {
        console.error("Error loading existing loan terms:", error);
      }
    };

    loadExistingLoanTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]); // Only run when leadId changes, not on every template update

  // Initialize default charges from template when no charges exist yet
  useEffect(() => {
    // Only initialize if we have template charges but no editable charges
    if (
      loanTemplate?.charges &&
      loanTemplate.charges.length > 0 &&
      editableCharges.length === 0
    ) {
      console.log("Initializing default charges from template:", loanTemplate.charges);
      const disbursementDate = loanTemplate.expectedDisbursementDate
        ? new Date(
            loanTemplate.expectedDisbursementDate[0],
            loanTemplate.expectedDisbursementDate[1] - 1,
            loanTemplate.expectedDisbursementDate[2]
          )
        : new Date();

      const initialCharges = loanTemplate.charges.map((charge: any) => ({
        chargeId: charge.chargeId || charge.id,
        name: charge.name || "Unknown Charge",
        amount: charge.amount || 0,
        dueDate: disbursementDate,
        originalCharge: charge,
      }));
      setEditableCharges(initialCharges);
      console.log("Default charges initialized:", initialCharges);
    }
  }, [loanTemplate, editableCharges.length]);

  const handleRemoveCharge = (index: number) => {
    setEditableCharges((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateChargeAmount = (index: number, amount: number) => {
    setEditableCharges((prev) =>
      prev.map((charge, i) => (i === index ? { ...charge, amount } : charge))
    );
  };

  const handleUpdateChargeDueDate = (index: number, dueDate: Date) => {
    setEditableCharges((prev) =>
      prev.map((charge, i) => (i === index ? { ...charge, dueDate } : charge))
    );
  };

  const handleAddCharge = () => {
    if (!selectedChargeOption || !newChargeAmount) {
      return;
    }

    const selectedCharge = loanTemplate?.chargeOptions?.find(
      (opt: any) => opt.id.toString() === selectedChargeOption
    );

    if (selectedCharge) {
      // Check if this charge requires a due date (Specified Due Date time type)
      const requiresDueDate =
        selectedCharge.chargeTimeType?.code === "specifiedDueDate" ||
        selectedCharge.chargeTimeType?.value === "Specified Due Date" ||
        selectedCharge.chargeTimeType?.id === 2;

      // If due date is required but not provided, don't proceed
      if (requiresDueDate && !newChargeDueDate) {
        return;
      }

      setEditableCharges((prev) => [
        ...prev,
        {
          chargeId: selectedCharge.id,
          name: selectedCharge.name,
          amount: parseFloat(newChargeAmount),
          dueDate: newChargeDueDate || new Date(), // Use current date as fallback if not required
          originalCharge: selectedCharge,
        },
      ]);

      // Reset form
      setSelectedChargeOption("");
      setNewChargeAmount("");
      setNewChargeDueDate(undefined);
      setShowAddCharge(false);
    }
  };

  // Check section completion
  const watchedValues = form.watch();
  useEffect(() => {
    const basicTermsComplete =
      watchedValues.principal > 0 &&
      watchedValues.loanTerm > 0 &&
      !!watchedValues.termFrequency &&
      watchedValues.numberOfRepayments > 0 &&
      watchedValues.repaymentEvery > 0 &&
      !!watchedValues.repaymentFrequency;
    const interestScheduleComplete =
      watchedValues.nominalInterestRate > 0 &&
      !!watchedValues.interestRateFrequency &&
      !!watchedValues.interestMethod &&
      !!watchedValues.amortization &&
      !!watchedValues.repaymentStrategy &&
      !!watchedValues.interestCalculationPeriod;
    const chargesCollateralComplete = true; // Optional section

    setSectionCompletion({
      basicTerms: basicTermsComplete,
      interestSchedule: interestScheduleComplete,
      chargesCollateral: chargesCollateralComplete,
    });
  }, [
    watchedValues.principal,
    watchedValues.loanTerm,
    watchedValues.termFrequency,
    watchedValues.numberOfRepayments,
    watchedValues.repaymentEvery,
    watchedValues.repaymentFrequency,
    watchedValues.nominalInterestRate,
    watchedValues.interestRateFrequency,
    watchedValues.interestMethod,
    watchedValues.amortization,
    watchedValues.repaymentStrategy,
    watchedValues.interestCalculationPeriod,
  ]);

  // Helper function to get section status
  const getSectionStatus = (
    sectionName: keyof typeof sectionCompletion
  ): "incomplete" | "pending" | "saved" => {
    const isComplete = sectionCompletion[sectionName];
    const isSaved = sectionSaved[sectionName];

    if (!isComplete) return "incomplete";
    if (isComplete && !isSaved) return "pending";
    return "saved";
  };

  // Helper function to get section styling classes
  const getSectionClasses = (
    sectionName: keyof typeof sectionCompletion
  ): string => {
    const status = getSectionStatus(sectionName);
    const baseClasses = "space-y-6 mb-8 rounded-lg p-6";

    switch (status) {
      case "incomplete":
        return `${baseClasses} bg-red-50 dark:bg-red-950 border-2 border-red-500 dark:border-red-600`;
      case "pending":
        return `${baseClasses} bg-amber-50 dark:bg-amber-950 border-2 border-amber-500 dark:border-amber-600`;
      case "saved":
        return `${baseClasses} bg-green-50 dark:bg-green-950 border-2 border-green-500 dark:border-green-600`;
    }
  };

  const handleSubmit = async (data: LoanTermsFormData) => {
    // Use templateDerivedValues as primary source (computed from prop, survives remounts)
    const refValues = frequencyValuesRef.current;
    const submissionData = {
      ...data,
      termFrequency:
        templateDerivedValues.termFrequency ||
        refValues.termFrequency ||
        frequencyState.termFrequency ||
        data.termFrequency,
      repaymentFrequency:
        templateDerivedValues.repaymentFrequency ||
        refValues.repaymentFrequency ||
        frequencyState.repaymentFrequency ||
        data.repaymentFrequency,
      interestRateFrequency:
        templateDerivedValues.interestRateFrequency ||
        refValues.interestRateFrequency ||
        frequencyState.interestRateFrequency ||
        data.interestRateFrequency,
      interestMethod:
        templateDerivedValues.interestMethod ||
        refValues.interestMethod ||
        frequencyState.interestMethod ||
        data.interestMethod,
      amortization:
        templateDerivedValues.amortization ||
        refValues.amortization ||
        frequencyState.amortization ||
        data.amortization,
      repaymentStrategy:
        templateDerivedValues.repaymentStrategy ||
        refValues.repaymentStrategy ||
        frequencyState.repaymentStrategy ||
        data.repaymentStrategy,
      interestCalculationPeriod:
        templateDerivedValues.interestCalculationPeriod ||
        refValues.interestCalculationPeriod ||
        frequencyState.interestCalculationPeriod ||
        data.interestCalculationPeriod,
    };
    console.log("LoanTermsForm submitting:", submissionData);
    console.log("Template derived values used:", templateDerivedValues);

    // Save loan terms to database if leadId is available
    if (leadId) {
      setIsSaving(true);
      try {
        // Prepare data for saving (convert dates to ISO strings)
        const loanTermsData = {
          ...submissionData,
          firstRepaymentOn: submissionData.firstRepaymentOn
            ? submissionData.firstRepaymentOn.toISOString()
            : null,
          interestChargedFrom: submissionData.interestChargedFrom
            ? submissionData.interestChargedFrom.toISOString()
            : null,
          charges: editableCharges.map((charge) => ({
            chargeId: charge.chargeId,
            name: charge.name,
            amount: charge.amount,
            dueDate: format(charge.dueDate, "dd MMMM yyyy"),
            originalCharge: charge.originalCharge,
          })),
        };

        const response = await fetch(`/api/leads/${leadId}/loan-terms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(loanTermsData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to save loan terms");
        }

        console.log("Loan terms saved successfully");

        // Call onComplete callback if provided
        if (onComplete) {
          onComplete();
        }
      } catch (error) {
        console.error("Error saving loan terms:", error);
        setError(
          error instanceof Error ? error.message : "Failed to save loan terms"
        );
        setIsSaving(false);
        return;
      } finally {
        setIsSaving(false);
      }
    }

    setSectionSaved({
      basicTerms: true,
      interestSchedule: true,
      chargesCollateral: true,
    });
    onSubmit(submissionData);
    onNext();
  };

  const addCollateral = () => {
    const currentCollaterals = form.getValues("collaterals");
    form.setValue("collaterals", [
      ...currentCollaterals,
      { name: "", quantity: 0, totalValue: 0 },
    ]);
  };

  const removeCollateral = (index: number) => {
    const currentCollaterals = form.getValues("collaterals");
    form.setValue(
      "collaterals",
      currentCollaterals.filter((_, i) => i !== index)
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading loan terms...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!loanTemplate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-muted-foreground">
              No loan template data available
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit as any)}
      className="space-y-6"
    >
      {/* Basic Terms Section */}
      <div className={getSectionClasses("basicTerms")}>
        <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
          <div className="flex items-center gap-2 mb-2">
            {getSectionStatus("basicTerms") === "saved" ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : getSectionStatus("basicTerms") === "pending" ? (
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
            <CardTitle className="text-lg font-medium">Basic Terms</CardTitle>
            {getSectionStatus("basicTerms") === "saved" && (
              <Badge className="ml-2 bg-green-500 text-white">Complete</Badge>
            )}
            {getSectionStatus("basicTerms") === "pending" && (
              <Badge className="ml-2 bg-amber-500 text-white">
                Pending Save
              </Badge>
            )}
          </div>
          <CardDescription>
            Principal, term options, repayments, and repayment frequency
          </CardDescription>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 italic">
            Note: Only Principal Amount and Charges can be edited. Other fields
            are pre-configured from the loan product.
          </p>
        </div>

        {/* Principal */}
        <Card>
          <CardHeader>
            <CardTitle>Principal</CardTitle>
            <CardDescription>Enter the principal loan amount</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="principal" className="text-sm font-medium">
                Principal Amount <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="principal"
                  type="number"
                  step="0.01"
                  className="h-10 pr-16"
                  {...form.register("principal", { valueAsNumber: true })}
                />
                {/* <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-sm text-muted-foreground">ZMK</span>
              </div> */}
              </div>
              {form.formState.errors.principal && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.principal.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Term Options */}
        <Card>
          <CardHeader>
            <CardTitle>Term Options</CardTitle>
            <CardDescription>
              Configure the loan term and frequency
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="loanTerm" className="text-sm font-medium">
                Loan Term <span className="text-red-500">*</span>
              </Label>
              <Input
                id="loanTerm"
                type="number"
                className="h-10 cursor-not-allowed"
                disabled
                {...form.register("loanTerm", { valueAsNumber: true })}
              />
              {form.formState.errors.loanTerm && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.loanTerm.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="termFrequency" className="text-sm font-medium">
                Frequency <span className="text-red-500">*</span>
              </Label>
              <Controller
                control={form.control}
                name="termFrequency"
                render={({ field }) => (
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      updateFrequencyValues({ termFrequency: val });
                    }}
                    value={
                      templateDerivedValues.termFrequency ||
                      frequencyValuesRef.current.termFrequency ||
                      frequencyState.termFrequency
                    }
                    disabled
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.termFrequencyTypeOptions?.map((option) => (
                        <SelectItem
                          key={option.id}
                          value={option.id.toString()}
                        >
                          {option.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.termFrequency && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.termFrequency.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Repayments */}
        <Card>
          <CardHeader>
            <CardTitle>Repayments</CardTitle>
            <CardDescription>Set repayment schedule and dates</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="numberOfRepayments"
                className="text-sm font-medium"
              >
                Number of repayments <span className="text-red-500">*</span>
              </Label>
              <Input
                id="numberOfRepayments"
                type="number"
                className="h-10"
                disabled
                {...form.register("numberOfRepayments", {
                  valueAsNumber: true,
                })}
              />
              {form.formState.errors.numberOfRepayments && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.numberOfRepayments.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="firstRepaymentOn" className="text-sm font-medium">
                First repayment on
              </Label>
              <Controller
                control={form.control}
                name="firstRepaymentOn"
                render={({ field }) => (
                      <Button
                        variant="outline"
                    disabled
                        className={cn(
                      "h-10 w-full justify-start text-left font-normal cursor-not-allowed opacity-70",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value
                          ? format(field.value, "PPP")
                      : "Set on Loan tab"}
                      </Button>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Set on the Loan tab - syncs automatically
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="interestChargedFrom"
                className="text-sm font-medium"
              >
                Interest charged from
              </Label>
              <Controller
                control={form.control}
                name="interestChargedFrom"
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled
                        className={cn(
                          "h-10 w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value
                          ? format(field.value, "PPP")
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Repaid Every */}
        <Card>
          <CardHeader>
            <CardTitle>Repaid Every</CardTitle>
            <CardDescription>Configure repayment frequency</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="repaymentEvery" className="text-sm font-medium">
                Repaid every <span className="text-red-500">*</span>
              </Label>
              <Input
                id="repaymentEvery"
                type="number"
                className="h-10"
                disabled
                {...form.register("repaymentEvery", { valueAsNumber: true })}
              />
              {form.formState.errors.repaymentEvery && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.repaymentEvery.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="repaymentFrequency"
                className="text-sm font-medium"
              >
                Frequency <span className="text-red-500">*</span>
              </Label>
              <Controller
                control={form.control}
                name="repaymentFrequency"
                render={({ field }) => (
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      updateFrequencyValues({ repaymentFrequency: val });
                    }}
                    value={
                      templateDerivedValues.repaymentFrequency ||
                      frequencyValuesRef.current.repaymentFrequency ||
                      frequencyState.repaymentFrequency
                    }
                    disabled
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.repaymentFrequencyTypeOptions?.map(
                        (option) => (
                          <SelectItem
                            key={option.id}
                            value={option.id.toString()}
                          >
                            {option.value}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.repaymentFrequency && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.repaymentFrequency.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="repaymentFrequencyNthDay"
                className="text-sm font-medium"
              >
                Select On
              </Label>
              <Controller
                control={form.control}
                name="repaymentFrequencyNthDay"
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select On" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.repaymentFrequencyNthDayTypeOptions?.map(
                        (option) => (
                          <SelectItem
                            key={option.id}
                            value={option.id.toString()}
                          >
                            {option.value}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="repaymentFrequencyDayOfWeek"
                className="text-sm font-medium"
              >
                Select Day
              </Label>
              <Controller
                control={form.control}
                name="repaymentFrequencyDayOfWeek"
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select Day" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.repaymentFrequencyDaysOfWeekTypeOptions?.map(
                        (option) => (
                          <SelectItem
                            key={option.id}
                            value={option.id.toString()}
                          >
                            {option.value}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interest & Schedule Section */}
      <div className={getSectionClasses("interestSchedule")}>
        <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
          <div className="flex items-center gap-2 mb-2">
            {getSectionStatus("interestSchedule") === "saved" ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : getSectionStatus("interestSchedule") === "pending" ? (
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
            <CardTitle className="text-lg font-medium">
              Interest & Schedule
            </CardTitle>
            {getSectionStatus("interestSchedule") === "saved" && (
              <Badge className="ml-2 bg-green-500 text-white">Complete</Badge>
            )}
            {getSectionStatus("interestSchedule") === "pending" && (
              <Badge className="ml-2 bg-amber-500 text-white">
                Pending Save
              </Badge>
            )}
          </div>
          <CardDescription>
            Interest rate, loan schedule, interest calculations, and moratorium
          </CardDescription>
        </div>

        {/* Nominal Interest Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Nominal Interest Rate</CardTitle>
            <CardDescription>
              Configure interest rate and calculation method
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="nominalInterestRate"
                className="text-sm font-medium"
              >
                Nominal interest rate % <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nominalInterestRate"
                type="number"
                step="0.01"
                className="h-10"
                disabled
                {...form.register("nominalInterestRate", {
                  valueAsNumber: true,
                })}
              />
              {form.formState.errors.nominalInterestRate && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.nominalInterestRate.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="interestRateFrequency"
                className="text-sm font-medium"
              >
                Frequency <span className="text-red-500">*</span>
              </Label>
              <Controller
                control={form.control}
                name="interestRateFrequency"
                render={({ field }) => (
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      updateFrequencyValues({ interestRateFrequency: val });
                    }}
                    value={
                      templateDerivedValues.interestRateFrequency ||
                      frequencyValuesRef.current.interestRateFrequency ||
                      frequencyState.interestRateFrequency
                    }
                    disabled
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.interestRateFrequencyTypeOptions?.map(
                        (option) => (
                          <SelectItem
                            key={option.id}
                            value={option.id.toString()}
                          >
                            {option.value}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.interestRateFrequency && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.interestRateFrequency.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="interestMethod" className="text-sm font-medium">
                Interest method <span className="text-red-500">*</span>
              </Label>
              <Controller
                control={form.control}
                name="interestMethod"
                render={({ field }) => (
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      updateFrequencyValues({ interestMethod: val });
                    }}
                    value={
                      templateDerivedValues.interestMethod ||
                      frequencyValuesRef.current.interestMethod ||
                      frequencyState.interestMethod
                    }
                    disabled
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.interestTypeOptions?.map((option) => (
                        <SelectItem
                          key={option.id}
                          value={option.id.toString()}
                        >
                          {option.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.interestMethod && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.interestMethod.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amortization" className="text-sm font-medium">
                Amortization <span className="text-red-500">*</span>
              </Label>
              <Controller
                control={form.control}
                name="amortization"
                render={({ field }) => (
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      updateFrequencyValues({ amortization: val });
                    }}
                    value={
                      templateDerivedValues.amortization ||
                      frequencyValuesRef.current.amortization ||
                      frequencyState.amortization
                    }
                    disabled
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select amortization" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.amortizationTypeOptions?.map((option) => (
                        <SelectItem
                          key={option.id}
                          value={option.id.toString()}
                        >
                          {option.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.amortization && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.amortization.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="isEqualAmortization"
                  checked={form.watch("isEqualAmortization")}
                  disabled
                  onCheckedChange={(checked) =>
                    form.setValue("isEqualAmortization", checked as boolean)
                  }
                />
                <Label
                  htmlFor="isEqualAmortization"
                  className="text-sm font-medium"
                >
                  Is Equal Amortization?
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loan Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Loan Schedule</CardTitle>
            <CardDescription>
              Configure loan schedule and repayment strategy
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="loanScheduleType" className="text-sm font-medium">
                Loan Schedule Type
              </Label>
              <Input
                id="loanScheduleType"
                value={
                  loanTemplate.loanScheduleTypeOptions?.[0]?.value ||
                  "Cumulative"
                }
                disabled
                className="h-10 bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="repaymentStrategy"
                className="text-sm font-medium"
              >
                Repayment Strategy <span className="text-red-500">*</span>
              </Label>
              <Controller
                control={form.control}
                name="repaymentStrategy"
                render={({ field }) => (
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      updateFrequencyValues({ repaymentStrategy: val });
                    }}
                    value={
                      templateDerivedValues.repaymentStrategy ||
                      frequencyValuesRef.current.repaymentStrategy ||
                      frequencyState.repaymentStrategy
                    }
                    disabled
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select strategy" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.transactionProcessingStrategyOptions?.map(
                        (option) => (
                          <SelectItem key={option.code} value={option.code}>
                            {option.name}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.repaymentStrategy && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.repaymentStrategy.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="balloonRepaymentAmount"
                className="text-sm font-medium"
              >
                Balloon Repayment Amount
              </Label>
              <Controller
                control={form.control}
                name="balloonRepaymentAmount"
                render={({ field }) => (
                  <Input
                    id="balloonRepaymentAmount"
                    type="number"
                    step="0.01"
                    className="h-10"
                    disabled
                    value={field.value ?? 0}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (
                        value === "" ||
                        value === null ||
                        value === undefined
                      ) {
                        field.onChange(0);
                      } else {
                        const num = parseFloat(value);
                        field.onChange(isNaN(num) ? 0 : num);
                      }
                    }}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Interest Calculations */}
        <Card>
          <CardHeader>
            <CardTitle>Interest Calculations</CardTitle>
            <CardDescription>
              Configure interest calculation settings
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="interestCalculationPeriod"
                className="text-sm font-medium"
              >
                Interest calculation period{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Controller
                control={form.control}
                name="interestCalculationPeriod"
                render={({ field }) => (
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      updateFrequencyValues({ interestCalculationPeriod: val });
                    }}
                    value={
                      templateDerivedValues.interestCalculationPeriod ||
                      frequencyValuesRef.current.interestCalculationPeriod ||
                      frequencyState.interestCalculationPeriod
                    }
                    disabled
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      {loanTemplate.interestCalculationPeriodTypeOptions?.map(
                        (option) => (
                          <SelectItem
                            key={option.id}
                            value={option.id.toString()}
                          >
                            {option.value}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.interestCalculationPeriod && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.interestCalculationPeriod.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="calculateInterestForExactDays"
                  checked={form.watch("calculateInterestForExactDays")}
                  disabled
                  onCheckedChange={(checked) =>
                    form.setValue(
                      "calculateInterestForExactDays",
                      checked as boolean
                    )
                  }
                />
                <Label
                  htmlFor="calculateInterestForExactDays"
                  className="text-sm font-medium"
                >
                  Calculate interest for exact days in partial period
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="arrearsTolerance" className="text-sm font-medium">
                Arrears tolerance
              </Label>
              <Controller
                control={form.control}
                name="arrearsTolerance"
                render={({ field }) => (
                  <Input
                    id="arrearsTolerance"
                    type="number"
                    step="0.01"
                    className="h-10"
                    disabled
                    value={field.value ?? 0}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (
                        value === "" ||
                        value === null ||
                        value === undefined
                      ) {
                        field.onChange(0);
                      } else {
                        const num = parseFloat(value);
                        field.onChange(isNaN(num) ? 0 : num);
                      }
                    }}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="interestFreePeriod"
                className="text-sm font-medium"
              >
                Interest free period
              </Label>
              <Controller
                control={form.control}
                name="interestFreePeriod"
                render={({ field }) => (
                  <Input
                    id="interestFreePeriod"
                    type="number"
                    className="h-10"
                    disabled
                    value={field.value ?? 0}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (
                        value === "" ||
                        value === null ||
                        value === undefined
                      ) {
                        field.onChange(0);
                      } else {
                        const num = parseFloat(value);
                        field.onChange(isNaN(num) ? 0 : num);
                      }
                    }}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Moratorium */}
        <Card>
          <CardHeader>
            <CardTitle>Moratorium</CardTitle>
            <CardDescription>
              Configure grace periods and arrears settings
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="graceOnPrincipalPayment"
                className="text-sm font-medium"
              >
                Grace on principal payment
              </Label>
              <Controller
                control={form.control}
                name="graceOnPrincipalPayment"
                render={({ field }) => (
                  <Input
                    id="graceOnPrincipalPayment"
                    type="number"
                    className="h-10"
                    disabled
                    value={field.value ?? 0}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (
                        value === "" ||
                        value === null ||
                        value === undefined
                      ) {
                        field.onChange(0);
                      } else {
                        const num = parseFloat(value);
                        field.onChange(isNaN(num) ? 0 : num);
                      }
                    }}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="graceOnInterestPayment"
                className="text-sm font-medium"
              >
                Grace on interest payment
              </Label>
              <Controller
                control={form.control}
                name="graceOnInterestPayment"
                render={({ field }) => (
                  <Input
                    id="graceOnInterestPayment"
                    type="number"
                    className="h-10"
                    disabled
                    value={field.value ?? 0}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (
                        value === "" ||
                        value === null ||
                        value === undefined
                      ) {
                        field.onChange(0);
                      } else {
                        const num = parseFloat(value);
                        field.onChange(isNaN(num) ? 0 : num);
                      }
                    }}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="onArrearsAgeing" className="text-sm font-medium">
                On arrears ageing
              </Label>
              <Controller
                control={form.control}
                name="onArrearsAgeing"
                render={({ field }) => (
                  <Input
                    id="onArrearsAgeing"
                    type="number"
                    className="h-10"
                    disabled
                    value={field.value ?? 0}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (
                        value === "" ||
                        value === null ||
                        value === undefined
                      ) {
                        field.onChange(0);
                      } else {
                        const num = parseFloat(value);
                        field.onChange(isNaN(num) ? 0 : num);
                      }
                    }}
                    onBlur={field.onBlur}
                  />
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Recalculate Interest */}
        <Card>
          <CardHeader>
            <CardTitle>Recalculate Interest</CardTitle>
            <CardDescription>Interest recalculation settings</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label
                htmlFor="recalculateInterest"
                className="text-sm font-medium"
              >
                Recalculate Interest
              </Label>
              <Input
                id="recalculateInterest"
                value="No"
                disabled
                className="h-10 bg-muted"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charges & Collateral Section */}
      <div className={getSectionClasses("chargesCollateral")}>
        <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
          <div className="flex items-center gap-2 mb-2">
            {getSectionStatus("chargesCollateral") === "saved" ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : getSectionStatus("chargesCollateral") === "pending" ? (
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            )}
            <CardTitle className="text-lg font-medium">
              Charges & Collateral
            </CardTitle>
            {getSectionStatus("chargesCollateral") === "saved" && (
              <Badge className="ml-2 bg-green-500 text-white">Complete</Badge>
            )}
            {getSectionStatus("chargesCollateral") === "pending" && (
              <Badge className="ml-2 bg-amber-500 text-white">
                Pending Save
              </Badge>
            )}
          </div>
          <CardDescription>
            Manage loan charges and collateral information
          </CardDescription>
        </div>

        {/* Charges */}
        {(editableCharges.length > 0 || loanTemplate?.chargeOptions) && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Charges</CardTitle>
                  <CardDescription>
                    Manage loan charges and fees. Add, remove, or edit charges
                    and their due dates.
                  </CardDescription>
                </div>
                {loanTemplate?.chargeOptions && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddCharge(!showAddCharge)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Charge
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Charge Form */}
              {showAddCharge && loanTemplate?.chargeOptions && (
                <div className="border rounded-lg p-4 bg-muted space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Add New Charge</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddCharge(false);
                        setSelectedChargeOption("");
                        setNewChargeAmount("");
                        setNewChargeDueDate(undefined);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Charge</Label>
                      <Select
                        value={selectedChargeOption}
                        onValueChange={setSelectedChargeOption}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select charge" />
                        </SelectTrigger>
                        <SelectContent>
                          {loanTemplate.chargeOptions
                            .filter(
                              (opt: any) =>
                                !editableCharges.some(
                                  (c) => c.chargeId === opt.id
                                )
                            )
                            .map((option: any) => (
                              <SelectItem
                                key={option.id}
                                value={option.id.toString()}
                              >
                                {option.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newChargeAmount}
                        onChange={(e) => setNewChargeAmount(e.target.value)}
                      />
                    </div>
                    {/* Only show Due Date for charges with "Specified Due Date" time type */}
                    {(() => {
                      const selectedCharge = loanTemplate.chargeOptions?.find(
                        (opt: any) => opt.id.toString() === selectedChargeOption
                      );
                      const requiresDueDate =
                        selectedCharge?.chargeTimeType?.code === "specifiedDueDate" ||
                        selectedCharge?.chargeTimeType?.value === "Specified Due Date" ||
                        selectedCharge?.chargeTimeType?.id === 2;
                      
                      return requiresDueDate ? (
                    <div className="space-y-2">
                      <Label>Due Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !newChargeDueDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newChargeDueDate
                              ? format(newChargeDueDate, "PPP")
                              : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={newChargeDueDate}
                            onSelect={setNewChargeDueDate}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                      ) : null;
                    })()}
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddCharge}
                    disabled={(() => {
                      const selectedCharge = loanTemplate.chargeOptions?.find(
                        (opt: any) => opt.id.toString() === selectedChargeOption
                      );
                      const requiresDueDate =
                        selectedCharge?.chargeTimeType?.code === "specifiedDueDate" ||
                        selectedCharge?.chargeTimeType?.value === "Specified Due Date" ||
                        selectedCharge?.chargeTimeType?.id === 2;
                      
                      return !selectedChargeOption ||
                      !newChargeAmount ||
                        (requiresDueDate && !newChargeDueDate);
                    })()}
                  >
                    Add Charge
                  </Button>
                </div>
              )}

              {/* Editable Charges List */}
              <div className="space-y-4">
                {editableCharges.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No charges added. Click "Add Charge" to add one.
                  </p>
                ) : (
                  editableCharges.map((charge, index) => (
                    <div
                      key={`${charge.chargeId}-${index}`}
                      className="border rounded-lg p-4 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium">{charge.name}</h4>
                          {charge.originalCharge?.penalty && (
                            <span className="inline-block mt-1 px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">
                              Penalty
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCharge(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Amount</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={charge.amount}
                            onChange={(e) =>
                              handleUpdateChargeAmount(
                                index,
                                parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        </div>
                        {/* Only show Due Date for charges with "Specified Due Date" time type */}
                        {(charge.originalCharge?.chargeTimeType?.code === "specifiedDueDate" ||
                          charge.originalCharge?.chargeTimeType?.value === "Specified Due Date" ||
                          charge.originalCharge?.chargeTimeType?.id === 2) && (
                        <div className="space-y-2">
                          <Label>Due Date</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !charge.dueDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {charge.dueDate
                                  ? format(charge.dueDate, "PPP")
                                  : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={charge.dueDate}
                                onSelect={(date) =>
                                  date && handleUpdateChargeDueDate(index, date)
                                }
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Collaterals Data */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Collaterals Data</CardTitle>
                <CardDescription>
                  Add collateral information for the loan
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                onClick={addCollateral}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Collateral
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {form.watch("collaterals").length > 0 && (
              <div className="border rounded-lg">
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    <div className="grid grid-cols-5 gap-4 p-2 font-medium text-xs border-b bg-muted/50">
                      <div className="min-w-0">Name</div>
                      <div className="min-w-0">Quantity</div>
                      <div className="min-w-0">Total Value</div>
                      <div className="min-w-0">Total Collateral Value</div>
                      <div className="min-w-0">Actions</div>
                    </div>
                    {form.watch("collaterals").map((collateral, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-5 gap-4 p-2 border-b"
                      >
                        <div className="min-w-0">
                          <Controller
                            control={form.control}
                            name={`collaterals.${index}.name`}
                            render={({ field }) => (
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                                disabled
                              >
                                <SelectTrigger className="h-7 w-full">
                                  <SelectValue placeholder="Select collateral" />
                                </SelectTrigger>
                                <SelectContent>
                                  {loanTemplate.loanCollateralOptions?.map(
                                    (option) => (
                                      <SelectItem
                                        key={option.id}
                                        value={option.name}
                                      >
                                        {option.name}
                                      </SelectItem>
                                    )
                                  )}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div className="min-w-0">
                          <Input
                            type="number"
                            className="h-7 w-full"
                            disabled
                            {...form.register(`collaterals.${index}.quantity`, {
                              valueAsNumber: true,
                            })}
                          />
                        </div>
                        <div className="min-w-0">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-7 w-full"
                            disabled
                            {...form.register(
                              `collaterals.${index}.totalValue`,
                              {
                                valueAsNumber: true,
                              }
                            )}
                          />
                        </div>
                        <div className="flex items-center min-w-0">
                          <span className="text-sm text-muted-foreground truncate">
                            {form.watch(`collaterals.${index}.totalValue`) || 0}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled
                            onClick={() => removeCollateral(index)}
                            className="h-7 px-2 text-red-600 hover:text-red-700 w-full sm:w-auto text-xs"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {form.watch("collaterals").length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No collaterals added. Click "Add Collateral" to add one.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Navigation Buttons */}
      <Card>
        <CardFooter className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="px-6"
            disabled={isSaving}
          >
            Previous
          </Button>

          <Button
            type="submit"
            className="px-6 transition-all duration-300"
            disabled={isLoading || isSaving}
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Loading...
              </>
            ) : (
              "Save & Next"
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
