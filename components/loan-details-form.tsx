"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, ChevronDownIcon, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect, Option } from "@/components/searchable-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calender";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-currency";

// Helper function to calculate first repayment date
const calculateFirstRepaymentDate = (): Date => {
  const today = new Date();
  const dayOfMonth = today.getDate();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed (0 = January, 11 = December)

  let targetDate: Date;

  if (dayOfMonth >= 16) {
    // If 16th or later, go to last day of next month
    // month + 2 means: current month + 1 (next month) + 1 (to get to the month after next)
    // day 0 of that month = last day of previous month (which is next month)
    targetDate = new Date(year, month + 2, 0);
  } else {
    // If before 16th, go to last day of current month
    // month + 1 means: next month
    // day 0 of next month = last day of current month
    targetDate = new Date(year, month + 1, 0);
  }

  // Set time to midnight to avoid timezone issues
  targetDate.setHours(0, 0, 0, 0);

  return targetDate;
};

// Form validation schema
const loanDetailsSchema = z.object({
  productName: z.string().min(1, "Product name is required"),
  externalId: z.string().optional(),
  loanPurpose: z.string().optional(),
  submittedOn: z.date({
    required_error: "Submitted on date is required",
  }),
  loanOfficer: z.string().optional(),
  fund: z.string().optional(),
  disbursementOn: z.date({
    required_error: "Disbursement date is required",
  }),
  firstRepaymentOn: z.date({
    required_error: "First repayment date is required",
  }),
  linkSavings: z.string().optional(),
  createStandingInstructions: z.boolean(),
});

type LoanDetailsFormData = z.infer<typeof loanDetailsSchema>;

interface LoanProduct {
  id: number;
  name: string;
}

interface LoanOfficer {
  id: number;
  firstname: string;
  lastname: string;
  displayName: string;
  officeId: number;
  officeName: string;
  isLoanOfficer: boolean;
  isActive: boolean;
}

interface LoanTemplate {
  clientId: number;
  clientAccountNo: string;
  clientName: string;
  clientExternalId: string;
  clientOfficeId: number;
  productOptions: LoanProduct[];
  loanOfficerOptions: LoanOfficer[];
  fundOptions: Array<{
    id: number;
    name: string;
  }>;
  loanPurposeOptions: Array<{
    id: number;
    name: string;
    position: number;
    description: string;
    active: boolean;
    mandatory: boolean;
  }>;
  expectedDisbursementDate: number[];
  principal?: number;
  interestRatePerPeriod?: number;
  loanTermFrequency?: number;
  loanTermFrequencyType?: number;
  numberOfRepayments?: number;
  repaymentEvery?: number;
  repaymentFrequencyType?: number;
  interestRateFrequencyType?: number;
  amortizationType?: { id: number };
  interestType?: { id: number };
  interestCalculationPeriodType?: { id: number };
  transactionProcessingStrategyCode?: string;
  productId?: number;
  fundId?: number;
  isEqualAmortization?: boolean;
  product?: {
    amortizationType?: { id: number };
    interestType?: { id: number };
    interestCalculationPeriodType?: { id: number };
    interestRateFrequencyType?: { id: number };
    repaymentFrequencyType?: { id: number };
    transactionProcessingStrategyCode?: string;
    isEqualAmortization?: boolean;
  };
}

interface RepaymentSchedulePeriod {
  period?: number;
  fromDate?: number[];
  dueDate: number[];
  daysInPeriod?: number;
  principalDue?: number;
  principalOriginalDue?: number;
  principalOutstanding?: number;
  principalLoanBalanceOutstanding?: number;
  interestDue?: number;
  interestOriginalDue?: number;
  interestOutstanding?: number;
  feeChargesDue?: number;
  feeChargesOutstanding?: number;
  penaltyChargesDue?: number;
  penaltyChargesOutstanding?: number;
  totalOriginalDueForPeriod?: number;
  totalDueForPeriod?: number;
  totalOutstandingForPeriod?: number;
  totalActualCostOfLoanForPeriod?: number;
  totalInstallmentAmountForPeriod?: number;
  downPaymentPeriod?: boolean;
}

interface RepaymentSchedule {
  currency: {
    code: string;
    name: string;
    decimalPlaces: number;
    displayLabel: string;
  };
  loanTermInDays: number;
  totalPrincipalDisbursed: number;
  totalPrincipalExpected: number;
  totalPrincipalPaid: number;
  totalInterestCharged: number;
  totalFeeChargesCharged: number;
  totalPenaltyChargesCharged: number;
  totalRepaymentExpected: number;
  totalOutstanding: number;
  periods: RepaymentSchedulePeriod[];
}

interface LoanDetailsFormProps {
  clientId: number;
  leadId?: string;
  onSubmit: (data: LoanDetailsFormData) => void;
  onBack: () => void;
  onNext: (templateData?: LoanTemplate) => void;
  onComplete?: () => void;
}

export function LoanDetailsForm({
  clientId,
  leadId,
  onSubmit,
  onBack,
  onNext,
  onComplete,
}: LoanDetailsFormProps) {
  const [loanTemplate, setLoanTemplate] = useState<LoanTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCompleteTemplate, setHasCompleteTemplate] = useState(false);
  const [repaymentSchedule, setRepaymentSchedule] =
    useState<RepaymentSchedule | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isGeneratingSchedule, setIsGeneratingSchedule] = useState(false);
  const hasLoadedLoanDetails = useRef(false);
  const [showAddLoanPurposeDialog, setShowAddLoanPurposeDialog] =
    useState(false);
  const [isAddingLoanPurpose, setIsAddingLoanPurpose] = useState(false);
  const [loanPurposeName, setLoanPurposeName] = useState("");
  const [loanPurposeDescription, setLoanPurposeDescription] = useState("");
  const [sectionCompletion, setSectionCompletion] = useState({
    loanInfo: false,
    savingsLinkage: false,
  });
  const [sectionSaved, setSectionSaved] = useState({
    loanInfo: false,
    savingsLinkage: false,
  });

  const form = useForm<LoanDetailsFormData>({
    resolver: zodResolver(loanDetailsSchema),
    defaultValues: {
      productName: "",
      externalId: "",
      submittedOn: new Date(),
      disbursementOn: new Date(),
      firstRepaymentOn: undefined as any, // Will be set in useEffect
      createStandingInstructions: false,
    },
  });

  // Ensure firstRepaymentOn has a default value on mount (before any data loading)
  useEffect(() => {
    // Calculate and set the date immediately on mount
    const calculatedDate = calculateFirstRepaymentDate();
    console.log("Setting initial firstRepaymentOn on mount:", {
      today: new Date().toISOString().split("T")[0],
      dayOfMonth: new Date().getDate(),
      calculatedDate: calculatedDate.toISOString().split("T")[0],
    });
    form.setValue("firstRepaymentOn", calculatedDate, {
      shouldValidate: false,
      shouldDirty: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Fetch loan template data
  useEffect(() => {
    const fetchLoanTemplate = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // First, we need to get the product options to get a productId
        const productResponse = await fetch(
          `/api/fineract/loans/template?clientId=${clientId}&activeOnly=true&staffInSelectedOfficeOnly=true&templateType=individual`
        );

        if (!productResponse.ok) {
          throw new Error("Failed to fetch product options");
        }

        const productData = await productResponse.json();
        console.log("Product options data:", productData); // Debug log
        console.log(
          "Loan officer options in initial response:",
          productData.loanOfficerOptions
        ); // Debug log
        console.log(
          "Type of loanOfficerOptions:",
          typeof productData.loanOfficerOptions,
          Array.isArray(productData.loanOfficerOptions)
        ); // Debug log
        console.log(
          "Loan officer options length:",
          productData.loanOfficerOptions?.length
        ); // Debug log

        // Set the product options (this includes loanOfficerOptions from the initial response)
        setLoanTemplate(productData);
        console.log(
          "Set loanTemplate with productData, loanOfficerOptions:",
          productData.loanOfficerOptions
        );

        // Set default values from template
        if (
          productData.productOptions &&
          productData.productOptions.length > 0
        ) {
          const firstProduct = productData.productOptions[0];
          form.setValue("productName", firstProduct.name);

          // Now fetch the detailed template with the selected product
          const templateResponse = await fetch(
            `/api/fineract/loans/template?clientId=${clientId}&productId=${firstProduct.id}&activeOnly=true&staffInSelectedOfficeOnly=true&templateType=individual`
          );

          if (!templateResponse.ok) {
            throw new Error("Failed to fetch loan template");
          }

          const templateData = await templateResponse.json();
          console.log("Detailed loan template data:", templateData); // Debug log
          console.log(
            "Loan officer options in detailed response:",
            templateData.loanOfficerOptions
          ); // Debug log

          // Merge the detailed template data while preserving critical arrays from initial response
          // (in case the detailed response doesn't include them)
          const mergedTemplate = {
            ...templateData,
            productOptions:
              templateData.productOptions || productData.productOptions || [],
            loanOfficerOptions:
              templateData.loanOfficerOptions ||
              productData.loanOfficerOptions ||
              [],
            loanPurposeOptions:
              templateData.loanPurposeOptions ||
              productData.loanPurposeOptions ||
              [],
            fundOptions:
              templateData.fundOptions || productData.fundOptions || [],
          };

          console.log(
            "Merged template loanOfficerOptions:",
            mergedTemplate.loanOfficerOptions
          );
          console.log(
            "Merged template loanOfficerOptions length:",
            mergedTemplate.loanOfficerOptions?.length
          );

          // Update the template with the merged data
          setLoanTemplate(mergedTemplate);
          console.log(
            "Updated loanTemplate state, checking if it has loanOfficerOptions"
          );
          setHasCompleteTemplate(true);

          if (templateData.expectedDisbursementDate) {
            const [year, month, day] = templateData.expectedDisbursementDate;
            const disbursementDate = new Date(year, month - 1, day);
            form.setValue("disbursementOn", disbursementDate);
          }
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch loan template"
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (clientId) {
      fetchLoanTemplate();
    }
  }, [clientId, form]);

  const handleProductChange = async (productName: string) => {
    try {
      // Find the product by name to get its ID
      const selectedProduct = loanTemplate?.productOptions?.find(
        (product) => product.name === productName
      );

      if (selectedProduct) {
        // Fetch the detailed template for the selected product
        const response = await fetch(
          `/api/fineract/loans/template?clientId=${clientId}&productId=${selectedProduct.id}&activeOnly=true&staffInSelectedOfficeOnly=true&templateType=individual`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch loan template for selected product");
        }

        const data = await response.json();

        // Merge the detailed template data while preserving critical arrays
        // (in case the detailed response doesn't include them)
        const mergedTemplate = {
          ...data,
          productOptions:
            data.productOptions || loanTemplate?.productOptions || [],
          loanOfficerOptions:
            data.loanOfficerOptions || loanTemplate?.loanOfficerOptions || [],
          loanPurposeOptions:
            data.loanPurposeOptions || loanTemplate?.loanPurposeOptions || [],
          fundOptions: data.fundOptions || loanTemplate?.fundOptions || [],
        };

        console.log("Merged template after product change:", {
          productOptionsCount: mergedTemplate.productOptions?.length,
          loanOfficerOptionsCount: mergedTemplate.loanOfficerOptions?.length,
          selectedProductId: selectedProduct.id,
        });

        // Update the template with the merged data
        setLoanTemplate(mergedTemplate);

        // Update disbursement date if available
        if (data.expectedDisbursementDate) {
          const [year, month, day] = data.expectedDisbursementDate;
          const disbursementDate = new Date(year, month - 1, day);
          form.setValue("disbursementOn", disbursementDate);
        }
      }
    } catch (err) {
      console.error("Error fetching template for selected product:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch template for selected product"
      );
    }
  };

  // Load existing loan details when component mounts and template is loaded (only once)
  useEffect(() => {
    const loadLoanDetails = async () => {
      if (
        !leadId ||
        !hasCompleteTemplate ||
        !loanTemplate ||
        hasLoadedLoanDetails.current
      )
        return;

      hasLoadedLoanDetails.current = true;

      try {
        console.log("Loading existing loan details for leadId:", leadId);
        const response = await fetch(`/api/leads/${leadId}/loan-details`);
        if (response.ok) {
          const result = await response.json();
          console.log("Loaded loan details result:", result);
          if (result.success && result.data) {
            console.log("Setting form values from loaded data:", result.data);
            // Update form with existing data
            if (result.data.productName) {
              console.log("Setting productName:", result.data.productName);
              form.setValue("productName", result.data.productName);
              // Trigger product change to load full template
              const selectedProduct = loanTemplate.productOptions?.find(
                (p) => p.name === result.data.productName
              );
              if (selectedProduct) {
                handleProductChange(result.data.productName);
              }
            }
            if (result.data.loanPurpose) {
              form.setValue("loanPurpose", result.data.loanPurpose);
            }
            if (result.data.loanOfficer) {
              form.setValue("loanOfficer", result.data.loanOfficer);
            }
            if (result.data.fund) {
              form.setValue("fund", result.data.fund);
            }
            if (result.data.submittedOn) {
              form.setValue("submittedOn", new Date(result.data.submittedOn));
            }
            if (result.data.disbursementOn) {
              form.setValue(
                "disbursementOn",
                new Date(result.data.disbursementOn)
              );
            }
            if (result.data.firstRepaymentOn) {
              const savedDate = new Date(result.data.firstRepaymentOn);
              console.log(
                "Loading saved firstRepaymentOn:",
                savedDate.toISOString().split("T")[0]
              );
              form.setValue("firstRepaymentOn", savedDate);
            } else {
              // If no saved firstRepaymentOn, recalculate the default
              const calculatedDate = calculateFirstRepaymentDate();
              console.log(
                "No saved firstRepaymentOn, setting calculated default:",
                calculatedDate.toISOString().split("T")[0]
              );
              form.setValue("firstRepaymentOn", calculatedDate);
            }
            if (result.data.linkSavings) {
              form.setValue("linkSavings", result.data.linkSavings);
            }
            if (result.data.createStandingInstructions !== undefined) {
              form.setValue(
                "createStandingInstructions",
                result.data.createStandingInstructions
              );
            }

            console.log("Pre-populated loan details form with existing data");

            // Mark sections as saved if they are complete (data is coming from server)
            // Wait a bit for form state to update, then check completion
            setTimeout(() => {
              const loanInfoComplete =
                !!result.data.productName &&
                !!result.data.submittedOn &&
                !!result.data.disbursementOn &&
                !!result.data.firstRepaymentOn;
              const savingsLinkageComplete = true; // Optional section

              if (loanInfoComplete || savingsLinkageComplete) {
                setSectionSaved({
                  loanInfo: loanInfoComplete,
                  savingsLinkage: savingsLinkageComplete,
                });
                setSectionCompletion({
                  loanInfo: loanInfoComplete,
                  savingsLinkage: savingsLinkageComplete,
                });
              }
            }, 100);
          }
        }
      } catch (error) {
        console.error("Error loading loan details:", error);
        hasLoadedLoanDetails.current = false; // Reset on error so we can retry
      }
    };

    loadLoanDetails();
    // Only depend on leadId and hasCompleteTemplate, not loanTemplate to avoid infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, hasCompleteTemplate]);

  // Check section completion
  const watchedValues = form.watch();
  useEffect(() => {
    const loanInfoComplete =
      !!watchedValues.productName &&
      !!watchedValues.submittedOn &&
      !!watchedValues.disbursementOn &&
      !!watchedValues.firstRepaymentOn;
    const savingsLinkageComplete = true; // Optional section

    setSectionCompletion({
      loanInfo: loanInfoComplete,
      savingsLinkage: savingsLinkageComplete,
    });
  }, [
    watchedValues.productName,
    watchedValues.submittedOn,
    watchedValues.disbursementOn,
    watchedValues.firstRepaymentOn,
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

  const handleGenerateSchedule = async () => {
    try {
      setIsGeneratingSchedule(true);
      setError(null);

      const formData = form.getValues();

      // Find selected product
      const selectedProduct = loanTemplate?.productOptions?.find(
        (p) => p.name === formData.productName
      );

      if (!selectedProduct || !loanTemplate) {
        throw new Error("Please select a product first");
      }

      // Build payload from form and template data
      // Use product object if available, otherwise fall back to template fields
      const product = loanTemplate.product;
      const amortizationTypeId =
        product?.amortizationType?.id || loanTemplate.amortizationType?.id || 1;
      const interestTypeId =
        product?.interestType?.id || loanTemplate.interestType?.id || 1;
      const interestCalcTypeId =
        product?.interestCalculationPeriodType?.id ||
        loanTemplate.interestCalculationPeriodType?.id ||
        1;

      const payload = {
        allowPartialPeriodInterestCalcualtion:
          interestCalcTypeId === 0 || false,
        amortizationType: amortizationTypeId,
        charges: [],
        clientId: loanTemplate.clientId,
        collateral: [],
        createStandingInstructionAtDisbursement:
          formData.createStandingInstructions ? "true" : "",
        dateFormat: "dd MMMM yyyy",
        expectedDisbursementDate: format(
          formData.disbursementOn,
          "dd MMMM yyyy"
        ),
        externalId: formData.externalId || "",
        fundId: formData.fund || loanTemplate.fundId?.toString() || "",
        interestCalculationPeriodType: interestCalcTypeId,
        interestChargedFromDate: null,
        interestRateFrequencyType:
          typeof loanTemplate.interestRateFrequencyType === "number"
            ? loanTemplate.interestRateFrequencyType
            : (product?.interestRateFrequencyType as any)?.id || 2,
        interestRatePerPeriod: loanTemplate.interestRatePerPeriod || 10,
        interestType: interestTypeId,
        isEqualAmortization:
          product?.isEqualAmortization !== undefined
            ? product.isEqualAmortization
            : loanTemplate.isEqualAmortization || false,
        isTopup: "",
        linkAccountId: formData.linkSavings || "",
        loanIdToClose: "",
        loanOfficerId: formData.loanOfficer || "",
        loanPurposeId: formData.loanPurpose || "",
        loanTermFrequency: loanTemplate.loanTermFrequency || 1,
        loanTermFrequencyType: loanTemplate.loanTermFrequencyType || 2,
        loanType: "individual",
        locale: "en",
        numberOfRepayments: loanTemplate.numberOfRepayments || 1,
        principal: loanTemplate.principal || 100,
        productId: selectedProduct.id,
        repaymentEvery: loanTemplate.repaymentEvery || 1,
        repaymentFrequencyDayOfWeekType: "",
        repaymentFrequencyNthDayType: "",
        repaymentFrequencyType:
          typeof loanTemplate.repaymentFrequencyType === "number"
            ? loanTemplate.repaymentFrequencyType
            : (product?.repaymentFrequencyType as any)?.id || 2,
        repaymentsStartingFromDate: null,
        submittedOnDate: format(formData.submittedOn, "dd MMMM yyyy"),
        transactionProcessingStrategyCode:
          product?.transactionProcessingStrategyCode ||
          loanTemplate.transactionProcessingStrategyCode ||
          "creocore-strategy",
      };

      const response = await fetch("/api/fineract/loans/calculate-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to calculate repayment schedule"
        );
      }

      const scheduleData = await response.json();
      setRepaymentSchedule(scheduleData);
      setIsScheduleModalOpen(true);
    } catch (err) {
      console.error("Error generating repayment schedule:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate repayment schedule"
      );
    } finally {
      setIsGeneratingSchedule(false);
    }
  };

  const handleSubmit = async (data: LoanDetailsFormData) => {
    console.log("=== FORM SUBMIT DEBUG ===");
    console.log("Form data received:", data);
    console.log("Form data productName:", data.productName);
    console.log("Form data loanPurpose:", data.loanPurpose);
    console.log("Form data loanOfficer:", data.loanOfficer);
    console.log("Form data fund:", data.fund);
    console.log("hasCompleteTemplate:", hasCompleteTemplate);
    console.log("loanTemplate exists:", !!loanTemplate);
    console.log("=== END FORM SUBMIT DEBUG ===");

    // Warn if template is incomplete, but try to proceed anyway
    if (!loanTemplate) {
      console.error("No loan template available, cannot proceed");
      setError("Loan template not loaded. Please wait and try again.");
      return;
    }

    if (!hasCompleteTemplate) {
      console.warn("Template may not be complete, but proceeding with save");
    }

    if (!loanTemplate.fundOptions || !loanTemplate.loanPurposeOptions) {
      console.warn("Some template options missing, but proceeding with save");
    }

    // Find product ID from product name (needed for both saving and navigation)
    console.log("=== PRODUCT MATCHING DEBUG ===");
    console.log("Product name from form:", data.productName);
    console.log("Product name type:", typeof data.productName);
    console.log(
      "Available products:",
      loanTemplate.productOptions?.map((p) => ({
        id: p.id,
        name: p.name,
        nameType: typeof p.name,
      }))
    );

    const selectedProduct = loanTemplate.productOptions?.find(
      (p) => p.name === data.productName
    );

    console.log("Selected product:", selectedProduct);
    console.log("Selected product ID:", selectedProduct?.id);
    console.log("=== END PRODUCT DEBUG ===");

    // Warn if product not found, but try to proceed anyway
    if (!selectedProduct) {
      console.warn(
        "Product not found in template options, but proceeding with save"
      );
      console.warn(
        "This might cause issues. Available products:",
        loanTemplate.productOptions?.map((p) => p.name)
      );
    }

    // Find loan purpose name from ID
    const selectedPurpose = loanTemplate.loanPurposeOptions?.find(
      (p) => p.id.toString() === data.loanPurpose
    );

    // Save loan details to database if leadId is available
    if (leadId) {
      setIsSaving(true);
      try {
        // Get productId - try from selectedProduct first, fallback to template productId or empty
        const productId =
          selectedProduct?.id?.toString() ||
          loanTemplate.productId?.toString() ||
          "";

        const loanDetailsData = {
          productName: data.productName,
          productId: productId,
          loanPurpose: data.loanPurpose || "",
          loanPurposeName: selectedPurpose?.name || "",
          loanOfficer: data.loanOfficer || "",
          fund: data.fund || "",
          submittedOn: data.submittedOn.toISOString(),
          disbursementOn: data.disbursementOn.toISOString(),
          firstRepaymentOn: data.firstRepaymentOn.toISOString(),
          linkSavings: data.linkSavings || "",
          createStandingInstructions: data.createStandingInstructions || false,
        };

        console.log("=== SAVING LOAN DETAILS ===");
        console.log("Product ID being saved:", productId);
        console.log("Product ID type:", typeof productId);
        console.log("Full loan details data:", loanDetailsData);
        console.log("=== END SAVING ===");

        const response = await fetch(`/api/leads/${leadId}/loan-details`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(loanDetailsData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to save loan details");
        }

        console.log("Loan details saved successfully");
        setSectionSaved({ loanInfo: true, savingsLinkage: true });

        // Call onComplete callback if provided
        if (onComplete) {
          onComplete();
        }
      } catch (error) {
        console.error("Error saving loan details:", error);
        setError(
          error instanceof Error ? error.message : "Failed to save loan details"
        );
        setIsSaving(false);
        return;
      } finally {
        setIsSaving(false);
      }
    }

    // Set external ID to a placeholder that will be updated to loan ID after creation
    const formDataWithExternalId = {
      ...data,
      externalId: data.externalId || "TEMP_LOAN_ID", // Will be updated to actual loan ID after creation
    };

    onSubmit(formDataWithExternalId);

    // Pass template with productId included and navigate to next tab
    const templateWithProductId = {
      ...loanTemplate,
      productId: selectedProduct?.id,
    } as LoanTemplate;

    onNext(templateWithProductId);
  };

  // Handle adding new loan purpose
  const handleAddLoanPurpose = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loanPurposeName.trim()) {
      return;
    }

    setIsAddingLoanPurpose(true);
    try {
      const response = await fetch("/api/fineract/codes/loan-purposes/values", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: loanPurposeName,
          description: loanPurposeDescription || undefined,
          position: (loanTemplate?.loanPurposeOptions?.length || 0) + 1,
          isActive: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add loan purpose");
      }

      const newPurpose = await response.json();

      // Update template with new loan purpose
      setLoanTemplate((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          loanPurposeOptions: [
            ...(prev.loanPurposeOptions || []),
            {
              id: newPurpose.resourceId || newPurpose.id,
              name: loanPurposeName,
              position: newPurpose.position,
              description: loanPurposeDescription,
              active: true,
            },
          ],
        };
      });

      // Set the newly created purpose as selected
      form.setValue(
        "loanPurpose",
        (newPurpose.resourceId || newPurpose.id).toString()
      );

      // Reset form and close dialog
      setLoanPurposeName("");
      setLoanPurposeDescription("");
      setShowAddLoanPurposeDialog(false);
    } catch (error) {
      console.error("Error adding loan purpose:", error);
      alert("Failed to add loan purpose. Please try again.");
    } finally {
      setIsAddingLoanPurpose(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading loan template...</p>
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

  // Don't render form if we don't have the template data
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
    <div className="space-y-6">
      <form
        onSubmit={form.handleSubmit(handleSubmit as any)}
        className="space-y-6"
      >
        {/* Loan Information */}
        <div className={getSectionClasses("loanInfo")}>
          <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
            <div className="flex items-center gap-2 mb-2">
              {getSectionStatus("loanInfo") === "saved" ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : getSectionStatus("loanInfo") === "pending" ? (
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
              <CardTitle className="text-lg font-medium">
                Loan Information
              </CardTitle>
              {getSectionStatus("loanInfo") === "saved" && (
                <Badge className="ml-2 bg-green-500 text-white">Complete</Badge>
              )}
              {getSectionStatus("loanInfo") === "pending" && (
                <Badge className="ml-2 bg-amber-500 text-white">
                  Pending Save
                </Badge>
              )}
            </div>
            <CardDescription>
              Enter the loan application details and requirements
            </CardDescription>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Product Name */}
              <div className="space-y-2">
                <Label htmlFor="productName" className="text-sm font-medium">
                  Product Name <span className="text-red-500">*</span>
                </Label>
                <Controller
                  control={form.control}
                  name="productName"
                  render={({ field }) => {
                    const productOptions: Option[] =
                      loanTemplate?.productOptions?.map((product) => ({
                        value: product.name,
                        label: product.name,
                      })) || [];

                    return (
                      <SearchableSelect
                        options={productOptions}
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleProductChange(value);
                        }}
                        placeholder="Select product"
                        emptyMessage="No products available"
                        disabled={isLoading || !loanTemplate}
                      />
                    );
                  }}
                />
                {form.formState.errors.productName && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.productName.message}
                  </p>
                )}
              </div>

              {/* External ID: Set to hidden since the user does not need to enter it*/}
              <div className="space-y-2">
                <Input
                  id="externalId"
                  placeholder="Enter external ID"
                  className="h-10"
                  hidden={true}
                  {...form.register("externalId")}
                />
              </div>

              {/* Loan Purpose */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="loanPurpose" className="text-sm font-medium">
                    Loan Purpose
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddLoanPurposeDialog(true)}
                    className="text-blue-600 hover:text-blue-700 h-6 px-2"
                  >
                    + Add New
                  </Button>
                </div>
                <Controller
                  control={form.control}
                  name="loanPurpose"
                  render={({ field }) => {
                    const purposeOptions: Option[] =
                      loanTemplate?.loanPurposeOptions?.map((purpose) => ({
                        value: purpose.id.toString(),
                        label: purpose.name,
                      })) || [];

                    return (
                      <SearchableSelect
                        options={purposeOptions}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Select purpose"
                        emptyMessage="No loan purposes available"
                        disabled={isLoading || !loanTemplate}
                      />
                    );
                  }}
                />
              </div>

              {/* Submitted On */}
              <div className="space-y-2">
                <Label htmlFor="submittedOn" className="text-sm font-medium">
                  Submitted On <span className="text-red-500">*</span>
                </Label>
                <Controller
                  control={form.control}
                  name="submittedOn"
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
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
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
                {form.formState.errors.submittedOn && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.submittedOn.message}
                  </p>
                )}
              </div>

              {/* First Repayment On */}
              <div className="space-y-2">
                <Label
                  htmlFor="firstRepaymentOn"
                  className="text-sm font-medium"
                >
                  First Repayment On <span className="text-red-500">*</span>
                </Label>
                <Controller
                  control={form.control}
                  name="firstRepaymentOn"
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
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
                {form.formState.errors.firstRepaymentOn && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.firstRepaymentOn.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Default: Last day of{" "}
                  {new Date().getDate() >= 16 ? "next" : "current"} month
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Savings Linkage */}
        <div className={getSectionClasses("savingsLinkage")}>
          <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
            <div className="flex items-center gap-2 mb-2">
              {getSectionStatus("savingsLinkage") === "saved" ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : getSectionStatus("savingsLinkage") === "pending" ? (
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
              <CardTitle className="text-lg font-medium">
                Savings Linkage
              </CardTitle>
              {getSectionStatus("savingsLinkage") === "saved" && (
                <Badge className="ml-2 bg-green-500 text-white">Complete</Badge>
              )}
              {getSectionStatus("savingsLinkage") === "pending" && (
                <Badge className="ml-2 bg-amber-500 text-white">
                  Pending Save
                </Badge>
              )}
            </div>
            <CardDescription>
              Configure savings account linkage and standing instructions
            </CardDescription>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Link Savings */}
            <div className="space-y-2">
              <Label htmlFor="linkSavings" className="text-sm font-medium">
                Link Savings
              </Label>
              <Controller
                control={form.control}
                name="linkSavings"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select savings account" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Savings Link</SelectItem>
                      <SelectItem value="auto">
                        Auto-Debit from Savings
                      </SelectItem>
                      <SelectItem value="manual">
                        Manual Savings Link
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Create Standing Instructions */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Standing Instructions
              </Label>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="createStandingInstructions"
                  checked={form.watch("createStandingInstructions")}
                  onCheckedChange={(checked) =>
                    form.setValue(
                      "createStandingInstructions",
                      checked as boolean
                    )
                  }
                />
                <Label
                  htmlFor="createStandingInstructions"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Create standing instructions at disbursement
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <Card>
          <CardFooter className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="px-6"
            >
              Previous
            </Button>

            <Button
              type="submit"
              className="px-6 transition-all duration-300"
              disabled={isLoading || !loanTemplate || isSaving}
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

      {/* Repayment Schedule Modal */}
      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent className="!max-w-[85vw] !w-[85vw] max-h-[95vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>Repayment Schedule</DialogTitle>
            <DialogDescription>
              Loan repayment schedule based on the current loan details
            </DialogDescription>
          </DialogHeader>

          {repaymentSchedule && (
            <div className="space-y-6">
              {/* Summary Information */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-muted rounded-lg">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">
                    Principal
                  </p>
                  <p className="text-lg font-semibold break-words">
                    {formatCurrency(
                      repaymentSchedule.totalPrincipalExpected,
                      repaymentSchedule.currency.code
                    )}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">Interest</p>
                  <p className="text-lg font-semibold break-words">
                    {formatCurrency(
                      repaymentSchedule.totalInterestCharged,
                      repaymentSchedule.currency.code
                    )}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">
                    Total Repayment
                  </p>
                  <p className="text-lg font-semibold break-words">
                    {formatCurrency(
                      repaymentSchedule.totalRepaymentExpected,
                      repaymentSchedule.currency.code
                    )}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">Term</p>
                  <p className="text-lg font-semibold">
                    {repaymentSchedule.loanTermInDays} days
                  </p>
                </div>
              </div>

              {/* Schedule Table */}
              <div className="rounded-md border w-full">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        Period
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        Due Date
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Principal Due
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Interest Due
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Fees
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Penalties
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Total Due
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Balance Outstanding
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repaymentSchedule.periods
                      .filter(
                        (period) =>
                          period.period !== undefined &&
                          !period.downPaymentPeriod
                      )
                      .map((period, index) => {
                        const dueDate =
                          period.dueDate && Array.isArray(period.dueDate)
                            ? new Date(
                                period.dueDate[0],
                                period.dueDate[1] - 1,
                                period.dueDate[2]
                              )
                            : null;

                        return (
                          <TableRow key={`period-${period.period || index}`}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {period.period ?? "-"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {dueDate ? format(dueDate, "MMM dd, yyyy") : "-"}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {formatCurrency(
                                period.principalDue ||
                                  period.principalOriginalDue ||
                                  0,
                                repaymentSchedule.currency.code
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {formatCurrency(
                                period.interestDue ||
                                  period.interestOriginalDue ||
                                  0,
                                repaymentSchedule.currency.code
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {formatCurrency(
                                period.feeChargesDue || 0,
                                repaymentSchedule.currency.code
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {formatCurrency(
                                period.penaltyChargesDue || 0,
                                repaymentSchedule.currency.code
                              )}
                            </TableCell>
                            <TableCell className="text-right font-semibold whitespace-nowrap">
                              {formatCurrency(
                                period.totalDueForPeriod ||
                                  period.totalOriginalDueForPeriod ||
                                  0,
                                repaymentSchedule.currency.code
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              {formatCurrency(
                                period.principalLoanBalanceOutstanding || 0,
                                repaymentSchedule.currency.code
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Loan Purpose Dialog */}
      {showAddLoanPurposeDialog && (
        <Dialog
          open={showAddLoanPurposeDialog}
          onOpenChange={setShowAddLoanPurposeDialog}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Loan Purpose</DialogTitle>
              <DialogDescription>
                Enter the details of the new loan purpose.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddLoanPurpose} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="purposeName">
                  Loan Purpose Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="purposeName"
                  placeholder="Enter loan purpose name"
                  value={loanPurposeName}
                  onChange={(e) => setLoanPurposeName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purposeDescription">Description</Label>
                <Input
                  id="purposeDescription"
                  placeholder="Enter description (optional)"
                  value={loanPurposeDescription}
                  onChange={(e) => setLoanPurposeDescription(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddLoanPurposeDialog(false);
                    setLoanPurposeName("");
                    setLoanPurposeDescription("");
                  }}
                  disabled={isAddingLoanPurpose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAddingLoanPurpose || !loanPurposeName.trim()}
                >
                  {isAddingLoanPurpose ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    "Add Loan Purpose"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
