"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCurrency } from "@/contexts/currency-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Save,
  Loader2,
  Calculator,
  CreditCard,
  Shield,
  User,
  FileText,
  Info,
  Calendar,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import type { AffordabilityResult } from "@/lib/affordability-calculator";
import { FormValidationSummary } from "@/components/ui/form-validation-summary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Define LoanOffer type locally
interface LoanOffer {
  id: string;
  amount: number;
  term: number;
  interestRate: number;
  monthlyPayment: number;
  totalPayment: number;
  description: string;
}
import { SimplifiedAffordabilityForm } from "./simplified-affordability-form";
import { ClientRegistrationForm } from "./client-registration-form";
import { LoanDetailsForm } from "@/components/loan-details-form";
import { LoanTermsForm } from "@/app/(application)/leads/new/components/loan-terms-form";
import { RepaymentScheduleForm } from "@/app/(application)/leads/new/components/repayment-schedule-form";
import { LoanContracts } from "@/app/(application)/leads/new/components/loan-contracts";
import { toast } from "@/components/ui/use-toast";


// Define the type for the client form data
type ClientFormData = {
  offices: any[];
  legalForms: any[];
  genders: any[];
  clientTypes: any[];
  clientClassifications: any[];
  savingsProducts: any[];
  activationDate: Date | null;
};

// Simple fetcher for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Form validation schema — mirrors client-registration-form clientFormSchema for Person vs Entity
const leadFormSchema = z
  .object({
    officeId: z.string().min(1, { message: "Office is required" }),
    legalFormId: z.string().min(1, { message: "Legal form is required" }),
    externalId: z.string().optional(),

    firstname: z.string().optional(),
    middlename: z.string().optional(),
    lastname: z.string().optional(),
    dateOfBirth: z.date().optional(),
    genderId: z.string().optional(),

    fullname: z.string().optional(),
    tradingName: z.string().optional(),
    registrationNumber: z.string().optional(),
    dateOfIncorporation: z.date().optional(),
    natureOfBusiness: z.string().optional(),
    businessAddress: z.string().optional(),

    isStaff: z.boolean().default(false),
    mobileNo: z
      .string()
      .min(1, { message: "Mobile number is required" })
      .refine((val) => {
        const digitsOnly = val.replace(/\D/g, "");
        return digitsOnly.length >= 7 && digitsOnly.length <= 12;
      }, "Please enter a valid phone number"),
    countryCode: z.string().default("+260"),
    emailAddress: z
      .union([
        z.string().email({ message: "Valid email is required" }),
        z.literal(""),
      ])
      .default(""),
    clientTypeId: z.string().optional(),
    clientClassificationId: z.string().optional(),
    submittedOnDate: z
      .date()
      .default(() => new Date())
      .refine(
        (d) => {
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          return d.getTime() <= today.getTime();
        },
        { message: "Submitted date cannot be in the future" },
      ),
    active: z.boolean().default(true),
    activationDate: z.date().optional(),
    openSavingsAccount: z.boolean().default(false),
    savingsProductId: z.string().optional(),

    monthlyIncomeRange: z.string().optional(),
    employmentStatus: z.string().optional(),
    employerName: z.string().optional(),
    yearsAtCurrentJob: z.string().optional(),
    hasExistingLoans: z.boolean().default(false),
    monthlyDebtPayments: z
      .union([z.number(), z.string()])
      .transform((val) => {
        if (typeof val === "string") {
          const parsed = parseFloat(val);
          return isNaN(parsed) ? 0 : parsed;
        }
        return val;
      })
      .default(0),
    propertyOwnership: z.string().optional(),
    businessOwnership: z.boolean().default(false),
    businessType: z.string().optional(),

    priority: z.string().optional(),
    assignTo: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.active && !data.activationDate) return false;
      return true;
    },
    {
      message: "Activation date is required when account is active",
      path: ["activationDate"],
    },
  )
  .refine(
    (data) => {
      if (data.openSavingsAccount && !data.savingsProductId) return false;
      return true;
    },
    {
      message: "Savings product is required when opening a savings account",
      path: ["savingsProductId"],
    },
  )
  .refine(
    (data) => {
      const isEntity = data.legalFormId === "2";
      if (!isEntity && !data.firstname) return false;
      return true;
    },
    { message: "First name is required", path: ["firstname"] },
  )
  .refine(
    (data) => {
      const isEntity = data.legalFormId === "2";
      if (!isEntity && !data.lastname) return false;
      return true;
    },
    { message: "Last name is required", path: ["lastname"] },
  )
  .refine(
    (data) => {
      const isEntity = data.legalFormId === "2";
      if (!isEntity && !data.dateOfBirth) return false;
      return true;
    },
    { message: "Date of birth is required", path: ["dateOfBirth"] },
  )
  .refine(
    (data) => {
      const isEntity = data.legalFormId === "2";
      if (isEntity && !data.fullname) return false;
      return true;
    },
    { message: "Business name is required", path: ["fullname"] },
  )
  .refine(
    (data) => {
      const isEntity = data.legalFormId === "2";
      if (isEntity && !data.registrationNumber) return false;
      return true;
    },
    {
      message: "Registration number is required",
      path: ["registrationNumber"],
    },
  );

type LeadFormValues = z.infer<typeof leadFormSchema>;

const VALID_TABS = new Set([
  "client",
  "affordability",
  "loan",
  "invoice",
  "terms",
  "schedule",
  "contracts",
]);

export function NewLeadForm() {
  // ALL HOOKS MUST BE CALLED FIRST, BEFORE ANY CONDITIONAL RETURNS
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currencyCode, currencySymbol, locale: tenantLocale } = useCurrency();
  const skipAffordabilityForCompanies =
    !!tenantLocale.skipAffordabilityForCompanies;
  const requestedTab = searchParams?.get("tab");
  const initialTab =
    requestedTab && VALID_TABS.has(requestedTab) ? requestedTab : "client";
  const [hideAffordability, setHideAffordability] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [affordabilityResult, setAffordabilityResult] =
    useState<AffordabilityResult | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<LoanOffer | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loanTemplateData, setLoanTemplateData] = useState<any>(null);
  const [formCompletionStatus, setFormCompletionStatus] = useState({
    client: false,
    affordability: false,
    loan: false,
    terms: false,
    schedule: false,
    contracts: false,
  });
  const [affordabilityAutoSkipped, setAffordabilityAutoSkipped] =
    useState(false);
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(() => {
    const fromUrl =
      searchParams?.get("id") || searchParams?.get("leadId");
    return fromUrl || null;
  });
  const [clientCreatedInFineract, setClientCreatedInFineract] = useState(false);
  const [fineractClientId, setFineractClientId] = useState<number | null>(null);
  const [loanProductId, setLoanProductId] = useState<number | null>(null);
  const [allClientSectionsComplete, setAllClientSectionsComplete] =
    useState(false);
  const [repaymentSchedule, setRepaymentSchedule] = useState<any>(null);
  const [loanDetails, setLoanDetails] = useState<any>(null);
  const [loanTerms, setLoanTerms] = useState<any>(null);
  const [sharedFirstRepaymentOn, setSharedFirstRepaymentOn] = useState<
    Date | undefined
  >(undefined);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  const tabsCount = hideAffordability ? 5 : 6;
  const tabsGridClass = hideAffordability
    ? "grid-cols-5 lg:grid-cols-5"
    : "grid-cols-6 lg:grid-cols-6";

  const handleWipeLead = () => {
    setCurrentLeadId(null);
    setClientCreatedInFineract(false);
    setFineractClientId(null);
    setLoanProductId(null);
    setLoanTemplateData(null);
    setRepaymentSchedule(null);
    setLoanDetails(null);
    setLoanTerms(null);
    setAffordabilityResult(null);
    setSelectedOffer(null);
    setAllClientSectionsComplete(false);
    setSharedFirstRepaymentOn(undefined);
    setFormCompletionStatus({
      client: false,
      affordability: false,
      loan: false,
      terms: false,
      schedule: false,
      contracts: false,
    });
    setAffordabilityAutoSkipped(false);
    setActiveTab("client");

    form.reset();

    window.history.replaceState(null, "", "/leads/new");

    setShowWipeConfirm(false);

    toast({
      title: "Lead Cleared",
      description: "All lead data has been wiped. You can start a fresh lead.",
    });
  };

  // Load leadId from URL or localStorage on mount
  useEffect(() => {
    const loadLeadData = async () => {
      console.log("=== LOAD LEAD DATA START ===");
      // Check for both 'id' and 'leadId' URL parameters for compatibility
      const leadId =
        searchParams?.get("id") || searchParams?.get("leadId");
      console.log("Final lead ID to use:", leadId);

      if (leadId) {
        console.log("Setting currentLeadId to:", leadId);
        setCurrentLeadId(leadId);

        // Store fineractClientId locally for use in subsequent calls
        let loadedFineractClientId: number | null = null;

        // Fetch lead data to get fineractClientId
        try {
          const leadResponse = await fetch(`/api/leads/${leadId}`);
          if (leadResponse.ok) {
            const leadData = await leadResponse.json();
            if (leadData.fineractClientId) {
              loadedFineractClientId = leadData.fineractClientId;
              setFineractClientId(leadData.fineractClientId);
              console.log(
                "Loaded fineractClientId from lead:",
                leadData.fineractClientId,
              );
            }
            // Also check window for fineractClientId (set by client registration form)
            if ((window as any).fineractClientId) {
              loadedFineractClientId = (window as any).fineractClientId;
              setFineractClientId((window as any).fineractClientId);
            }
          } else if (leadResponse.status === 404) {
            console.log("Lead not found (404)");
            setCurrentLeadId(null);
            return;
          }
        } catch (error) {
          console.error("Error loading lead data:", error);
        }

        if (!hideAffordability) {
          // Check if affordability data exists for this lead
          try {
            const response = await fetch(`/api/leads/${leadId}/affordability`);
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                // Check if affordability data has been filled
                const hasAffordabilityData =
                  result.data.netMonthlyIncome > 0 ||
                  result.data.grossMonthlyIncome > 0;

                if (hasAffordabilityData) {
                  console.log("Affordability data found, marking as complete");
                  setFormCompletionStatus((prev) => ({
                    ...prev,
                    affordability: true,
                  }));
                }
              }
            }
          } catch (error) {
            console.error("Error checking affordability data:", error);
          }
        }

        // Check if loan details exist for this lead
        let loadedLoanDetails: any = null;
        let loadedProductId: number | null = null;

        try {
          const loanResponse = await fetch(`/api/leads/${leadId}/loan-details`);
          if (loanResponse.ok) {
            const loanResult = await loanResponse.json();
            if (loanResult.success && loanResult.data) {
              // Check if loan details have been filled
              const hasLoanDetails =
                loanResult.data.productName ||
                loanResult.data.loanPurpose ||
                loanResult.data.loanOfficer;

              if (hasLoanDetails) {
                console.log(
                  "Loan details found, marking as complete and setting state",
                );
                loadedLoanDetails = loanResult.data;
                setLoanDetails(loanResult.data);
                setFormCompletionStatus((prev) => ({
                  ...prev,
                  loan: true,
                }));
                // Set loanProductId from loan details if available
                if (loanResult.data.productId) {
                  loadedProductId = parseInt(loanResult.data.productId);
                  setLoanProductId(loadedProductId);
                }
              }
            }
          }
        } catch (error) {
          console.error("Error checking loan details:", error);
        }

        // Check if loan terms exist for this lead
        let loadedLoanTerms: any = null;
        try {
          const loanTermsResponse = await fetch(
            `/api/leads/${leadId}/loan-terms`,
          );
          if (loanTermsResponse.ok) {
            const loanTermsResult = await loanTermsResponse.json();
            if (loanTermsResult.success && loanTermsResult.data) {
              // Check if loan terms have been filled
              const hasLoanTerms =
                loanTermsResult.data.principal ||
                loanTermsResult.data.nominalInterestRate ||
                loanTermsResult.data.numberOfRepayments;

              if (hasLoanTerms) {
                console.log(
                  "Loan terms found, marking as complete and setting state",
                );
                loadedLoanTerms = loanTermsResult.data;
                setLoanTerms(loanTermsResult.data); // Actually set the state!
                setFormCompletionStatus((prev) => ({
                  ...prev,
                  terms: true,
                }));
              }
            }
          }
        } catch (error) {
          console.error("Error checking loan terms:", error);
        }

        // If we have loan details with productId and fineractClientId, fetch the loan template
        // Note: loadedFineractClientId was set at the beginning of this block when fetching lead data
        if (loadedProductId && loadedFineractClientId) {
          try {
            console.log(
              "Fetching loan template for productId:",
              loadedProductId,
              "clientId:",
              loadedFineractClientId,
            );
            const templateResponse = await fetch(
              `/api/fineract/loans/template?clientId=${loadedFineractClientId}&productId=${loadedProductId}&activeOnly=true&staffInSelectedOfficeOnly=true&templateType=individual`,
            );
            if (templateResponse.ok) {
              const templateData = await templateResponse.json();
              console.log("Loan template loaded for continued application");
              setLoanTemplateData(templateData);

              // If we have all the data needed, calculate the repayment schedule
              if (loadedLoanDetails && loadedLoanTerms && templateData) {
                console.log(
                  "All data available, calculating repayment schedule for continued application",
                );
                try {
                  const { format } = await import("date-fns");

                  const submittedDate = loadedLoanDetails.submittedOn
                    ? format(
                        new Date(loadedLoanDetails.submittedOn),
                        "dd MMMM yyyy",
                      )
                    : format(new Date(), "dd MMMM yyyy");

                  const disbursementDate = loadedLoanDetails.disbursementOn
                    ? format(
                        new Date(loadedLoanDetails.disbursementOn),
                        "dd MMMM yyyy",
                      )
                    : format(new Date(), "dd MMMM yyyy");

                  const charges = (loadedLoanTerms.charges || []).map(
                    (charge: any) => ({
                      chargeId: charge.chargeId,
                      amount: charge.amount,
                      dueDate: charge.dueDate,
                    }),
                  );

                  const payload = {
                    productId: loadedProductId,
                    loanOfficerId: loadedLoanDetails.loanOfficer || "",
                    loanPurposeId: loadedLoanDetails.loanPurpose || "",
                    fundId: loadedLoanDetails.fund || "",
                    submittedOnDate: submittedDate,
                    expectedDisbursementDate: disbursementDate,
                    externalId: "",
                    linkAccountId: loadedLoanDetails.linkSavings || "",
                    createStandingInstructionAtDisbursement:
                      loadedLoanDetails.createStandingInstructions
                        ? "true"
                        : "",
                    loanTermFrequency: loadedLoanTerms.loanTerm || 1,
                    loanTermFrequencyType: loadedLoanTerms.termFrequency
                      ? parseInt(loadedLoanTerms.termFrequency)
                      : templateData?.termPeriodFrequencyType?.id || 2,
                    numberOfRepayments: loadedLoanTerms.numberOfRepayments || 1,
                    repaymentEvery: loadedLoanTerms.repaymentEvery || 1,
                    repaymentFrequencyType: loadedLoanTerms.repaymentFrequency
                      ? parseInt(loadedLoanTerms.repaymentFrequency)
                      : templateData?.repaymentFrequencyType?.id || 2,
                    repaymentFrequencyNthDayType:
                      loadedLoanTerms.repaymentFrequencyNthDay || "",
                    repaymentFrequencyDayOfWeekType:
                      loadedLoanTerms.repaymentFrequencyDayOfWeek || "",
                    repaymentsStartingFromDate: loadedLoanTerms.firstRepaymentOn
                      ? format(
                          new Date(loadedLoanTerms.firstRepaymentOn),
                          "dd MMMM yyyy",
                        )
                      : null,
                    interestChargedFromDate: loadedLoanTerms.interestChargedFrom
                      ? format(
                          new Date(loadedLoanTerms.interestChargedFrom),
                          "dd MMMM yyyy",
                        )
                      : null,
                    interestType: loadedLoanTerms.interestMethod
                      ? parseInt(loadedLoanTerms.interestMethod)
                      : templateData?.interestType?.id || 1,
                    isEqualAmortization:
                      loadedLoanTerms.isEqualAmortization || false,
                    amortizationType: loadedLoanTerms.amortization
                      ? parseInt(loadedLoanTerms.amortization)
                      : templateData?.amortizationType?.id || 1,
                    interestCalculationPeriodType:
                      loadedLoanTerms.interestCalculationPeriod
                        ? parseInt(loadedLoanTerms.interestCalculationPeriod)
                        : templateData?.interestCalculationPeriodType?.id || 1,
                    loanIdToClose: loadedLoanTerms.loanIdToClose || "",
                    isTopup: loadedLoanTerms.isTopup || "",
                    transactionProcessingStrategyCode:
                      loadedLoanTerms.repaymentStrategy ||
                      templateData?.transactionProcessingStrategyCode ||
                      "creocore-strategy",
                    interestRateFrequencyType:
                      loadedLoanTerms.interestRateFrequency
                        ? parseInt(loadedLoanTerms.interestRateFrequency)
                        : templateData?.interestRateFrequencyType?.id || 2,
                    interestRatePerPeriod:
                      loadedLoanTerms.nominalInterestRate || 0,
                    charges: charges,
                    collateral: [],
                    dateFormat: "dd MMMM yyyy",
                    locale: "en",
                    clientId: loadedFineractClientId,
                    loanType: "individual",
                    principal: loadedLoanTerms.principal || 0,
                    allowPartialPeriodInterestCalcualtion: false,
                  };

                  const scheduleResponse = await fetch(
                    `/api/fineract/loans/calculate-schedule`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify(payload),
                    },
                  );

                  if (scheduleResponse.ok) {
                    const scheduleData = await scheduleResponse.json();
                    console.log(
                      "Repayment schedule calculated for continued application",
                    );
                    setRepaymentSchedule(scheduleData);
                    setFormCompletionStatus((prev) => ({
                      ...prev,
                      schedule: true,
                    }));
                  } else {
                    console.error(
                      "Failed to calculate repayment schedule:",
                      await scheduleResponse.text(),
                    );
                  }
                } catch (scheduleError) {
                  console.error(
                    "Error calculating repayment schedule:",
                    scheduleError,
                  );
                }
              }
            }
          } catch (templateError) {
            console.error("Error fetching loan template:", templateError);
          }
        }
      } else {
        console.log("No lead ID found, starting fresh lead");
      }
      console.log("=== LOAD LEAD DATA END ===");
    };

    loadLeadData();
  }, [searchParams, hideAffordability]);

  useEffect(() => {
    const nextTab = searchParams?.get("tab");
    if (nextTab && VALID_TABS.has(nextTab)) {
      setActiveTab(nextTab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (hideAffordability) {
      setFormCompletionStatus((prev) => ({ ...prev, affordability: true }));
      setAffordabilityAutoSkipped(true);
      if (activeTab === "affordability") {
        setActiveTab("loan");
      }
      return;
    }

    if (affordabilityAutoSkipped) {
      setFormCompletionStatus((prev) => ({ ...prev, affordability: false }));
      setAffordabilityAutoSkipped(false);
    }
  }, [hideAffordability, activeTab, affordabilityAutoSkipped]);

  // Debug state changes
  useEffect(() => {
    console.log(
      "==========> clientCreatedInFineract state changed to:",
      clientCreatedInFineract,
    );
  }, [clientCreatedInFineract]);

  // Debug currentLeadId changes
  useEffect(() => {
    console.log("==========> currentLeadId changed to:", currentLeadId);
  }, [currentLeadId]);

  // Debug fineractClientId changes
  useEffect(() => {
    console.log("==========> fineractClientId changed to:", fineractClientId);
  }, [fineractClientId]);

  // Update fineractClientId when client is created in Fineract
  useEffect(() => {
    if (clientCreatedInFineract && (window as any).fineractClientId) {
      const clientId = (window as any).fineractClientId;
      setFineractClientId(clientId);
      console.log("Updated fineractClientId from window:", clientId);
    }
  }, [clientCreatedInFineract]);

  // Fetch template data using SWR
  const { data: templateResult, error: templateError } = useSWR(
    "/api/leads/template",
    fetcher,
  );
  const rawTemplateData = templateResult?.data || {
    offices: [],
    legalForms: [],
    genders: [],
    clientTypes: [],
    clientClassifications: [],
    savingsProducts: [],
    activationDate: null,
  };
  const clientFormData = {
    ...rawTemplateData,
    activationDate: rawTemplateData.activationDate
      ? new Date(rawTemplateData.activationDate)
      : null,
  };

  // Check if client exists in Fineract by National ID
  const checkClientExists = async (nationalId: string) => {
    try {
      const response = await fetch(`/api/fineract/clients/external-id`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ externalId: nationalId }),
      });
      if (response.ok) {
        const clientData = await response.json();
        setClientCreatedInFineract(true);
        setFormCompletionStatus((prev) => ({ ...prev, client: true }));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error checking client existence:", error);
      return false;
    }
  };

  // Initialize form with default values - MUST BE BEFORE ANY CONDITIONAL RETURNS
  const form = useForm({
    resolver: zodResolver(leadFormSchema),
    mode: "onBlur", // Validate on blur for better UX
    reValidateMode: "onChange", // Re-validate on change after first validation
    defaultValues: {
      officeId: "1",
      legalFormId: "1",
      externalId: "",
      firstname: "",
      middlename: "",
      lastname: "",
      dateOfBirth: undefined,
      genderId: "",
      fullname: "",
      tradingName: "",
      registrationNumber: "",
      dateOfIncorporation: undefined,
      natureOfBusiness: "",
      businessAddress: "",
      isStaff: false,
      mobileNo: "",
      countryCode: "+263",
      emailAddress: "",
      clientTypeId: "",
      clientClassificationId: "",
      submittedOnDate: new Date(),
      active: true,
      activationDate: undefined,
      openSavingsAccount: false,
      savingsProductId: "",
      // Financial fields
      monthlyIncomeRange: "",
      employmentStatus: "",
      employerName: "",
      yearsAtCurrentJob: "",
      hasExistingLoans: false,
      monthlyDebtPayments: 0,
      propertyOwnership: "",
      businessOwnership: false,
      businessType: "",
      // Additional Information fields
      priority: "",
      assignTo: "",
      notes: "",
    },
  });

  useEffect(() => {
    const updateAffordabilityVisibility = (legalFormId: unknown) => {
      const isEntityLead = String(legalFormId || "") === "2";
      setHideAffordability(skipAffordabilityForCompanies && isEntityLead);
    };

    // Initialize from current form state
    updateAffordabilityVisibility(form.getValues("legalFormId"));

    // Keep in sync as legal form changes
    const subscription = form.watch((values, { name }) => {
      if (!name || name === "legalFormId") {
        updateAffordabilityVisibility(values.legalFormId);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, skipAffordabilityForCompanies]);

  // Handle template loading error
  if (templateError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" asChild className="h-8 w-8">
              <Link href="/leads">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              Create New Lead
            </h1>
          </div>
        </div>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-red-600 font-medium">
                Error loading form data
              </div>
              <div className="text-sm text-red-500 mt-1">
                {templateError.message}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle loading state
  if (!templateResult) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" asChild className="h-8 w-8">
              <Link href="/leads">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">
              Create New Lead
            </h1>
          </div>
        </div>

        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle form submission
  const onSubmit = async (
    data: LeadFormValues,
    entityData?: {
      entityStakeholders: any[];
      entityBankAccounts: any[];
    },
  ) => {
    setIsSubmitting(true);

    try {
      // Trigger form validation
      const isValid = await form.trigger();

      if (!isValid) {
        toast({
          title: "Validation Error",
          description: "Please fix the errors in the form before submitting",
          variant: "destructive",
        });
        throw new Error("Form validation failed");
      }

      // Validate required fields before submission
      if (!data.officeId || !data.legalFormId) {
        toast({
          title: "Validation Error",
          description:
            "Please fill in all required fields (Office and Legal Form)",
          variant: "destructive",
        });
        throw new Error("Missing required fields");
      }

      console.log("Form data being submitted:", data);

      // Determine operation based on whether client was found
      console.log(
        "==========> clientCreatedInFineract state:",
        clientCreatedInFineract,
      );
      const operation = clientCreatedInFineract
        ? "updateClient"
        : "createLeadWithClient";
      console.log("==========> Selected operation:", operation);

      // Prepare data for the API call
      const apiData = {
        ...data,
        // Convert string IDs to numbers
        officeId: data.officeId ? Number(data.officeId) : undefined,
        legalFormId: data.legalFormId ? Number(data.legalFormId) : undefined,
        clientTypeId: data.clientTypeId ? Number(data.clientTypeId) : undefined,
        clientClassificationId: data.clientClassificationId
          ? Number(data.clientClassificationId)
          : undefined,
        genderId: (() => {
          const raw = data.genderId?.trim();
          if (raw) return Number(raw);
          return undefined;
        })(),
        // Convert data types to match the schema expectations
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        submittedOnDate: data.submittedOnDate
          ? new Date(data.submittedOnDate)
          : new Date(),
        activationDate: data.activationDate
          ? new Date(data.activationDate)
          : undefined,
        savingsProductId: data.savingsProductId
          ? Number(data.savingsProductId)
          : undefined,
        monthlyDebtPayments: data.monthlyDebtPayments
          ? Number(data.monthlyDebtPayments)
          : undefined,
        // Add affordability data
        affordabilityResult,
        selectedOffer,
        entityStakeholdersDraft: entityData?.entityStakeholders || [],
        entityBankAccountsDraft: entityData?.entityBankAccounts || [],
      };

      // If updating client, add the Fineract client ID and existing lead ID
      if (operation === "updateClient") {
        // Get the Fineract client ID from the client lookup
        const fineractClientId = (window as any).fineractClientId;
        console.log(
          "==========> Retrieved fineractClientId from window:",
          fineractClientId,
        );
        console.log("==========> Current leadId:", currentLeadId);

        if (!fineractClientId) {
          throw new Error("Cannot update client: Fineract client ID not found");
        }

        // Add Fineract client ID
        (apiData as any).fineractClientId = fineractClientId;

        // CRITICAL: Add existing lead ID to update the same lead instead of creating a new one
        if (currentLeadId) {
          (apiData as any).leadId = currentLeadId;
          console.log(
            "==========> Added existing leadId to apiData:",
            currentLeadId,
          );
        } else {
          console.warn(
            "==========> No currentLeadId found, may create new lead",
          );
        }

        console.log(
          "==========> Final apiData for update:",
          (apiData as any).fineractClientId,
          "leadId:",
          (apiData as any).leadId,
        );
      }

      // Call the appropriate API operation
      console.log("==========> Making API call to /api/leads/operations");
      console.log("==========> Operation:", operation);
      console.log("==========> API Data:", apiData);

      const response = await fetch("/api/leads/operations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operation,
          data: apiData,
        }),
      });

      console.log("==========> Response status:", response.status);
      console.log("==========> Response headers:", response.headers);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error(
            "==========> Failed to parse error response as JSON:",
            parseError,
          );
          errorData = {
            error: `HTTP ${response.status}: ${response.statusText}`,
          };
        }
        console.error("==========> API Error:", errorData);
        throw new Error(
          errorData.error ||
            `Failed to ${
              operation === "updateClient" ? "update" : "create"
            } lead and client`,
        );
      }

      const result = await response.json();
      console.log(
        `${
          operation === "updateClient"
            ? "Client updated"
            : "Lead and client created"
        } successfully:`,
        result,
      );

      // Store the lead ID for future operations
      // Only update if we don't already have a leadId (prevents overwriting when updating)
      if (result.leadId && (!currentLeadId || operation !== "updateClient")) {
        console.log("==========> Setting leadId to:", result.leadId);
        console.log("==========> Updating URL with leadId:", result.leadId);
        setCurrentLeadId(result.leadId);
        // Update URL with the new lead ID using replace to avoid history clutter
        window.history.replaceState(null, "", `/leads/new?id=${result.leadId}`);
      } else {
        console.log("==========> Keeping existing leadId:", currentLeadId);
      }

      // Update UI state to reflect successful operation
      setClientCreatedInFineract(true);
      setFormCompletionStatus((prev) => ({ ...prev, client: true }));

      toast({
        title: "Success",
        description:
          operation === "updateClient"
            ? `Client updated successfully! Account: ${
                result.fineractAccountNo || "N/A"
              }`
            : `Lead and client created successfully! Account: ${
                result.fineractAccountNo || "N/A"
              }`,
      });

    } catch (error: any) {
      console.error("Error creating lead:", error);

      // Check if it's a Fineract-specific error
      const isFineractError =
        error.message?.includes("Fineract") ||
        error.message?.includes("client");

      toast({
        title: isFineractError ? "Fineract Connection Error" : "Error",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
        variant: "destructive",
        action: isFineractError
          ? {
              label: "Retry",
              onClick: () => {
                // Retry the operation
                onSubmit(data);
              },
            }
          : undefined,
      });

      // Re-throw the error so the caller can handle it (e.g., prevent navigation)
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAffordabilityCalculation = (result: AffordabilityResult) => {
    setAffordabilityResult(result);

    // Update loan amount in the form if offers are available
    if (result.offers.length > 0) {
      // Update the form with the first offer's details
      const firstOffer = result.offers[0];
      // Note: We're not updating form fields here since this form is for client registration
      // The loan details will be handled in a separate loan application form
    }
  };

  const handleOfferSelect = (offer: LoanOffer) => {
    toast({
      title: "Selected Offer",
      description: "Offer selected successfully",
    });
    setSelectedOffer(offer);

    // Note: We're not updating form fields here since this form is for client registration
    // The loan details will be handled in a separate loan application form
  };

  // Format currency - uses currency from context
  const formatCurrencyLocal = (amount: number | string) => {
    const numAmount =
      typeof amount === "string" ? Number.parseFloat(amount) : amount;
    if (isNaN(numAmount)) return `${currencySymbol}0`;

    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(numAmount);
    } catch {
      return `${currencySymbol}${numAmount.toLocaleString()}`;
    }
  };

  // Handle step navigation
  const handleStepNavigation = (stepId: string) => {
    setActiveTab(stepId);
  };

  // Check if next button should be disabled
  const isNextButtonDisabled = (currentTab: string) => {
    const tabOrder = hideAffordability
      ? ["client", "loan", "terms", "schedule", "contracts"]
      : ["client", "affordability", "loan", "terms", "schedule", "contracts"];
    const currentIndex = tabOrder.indexOf(currentTab);

    // Disable if any previous tab is not completed
    for (let i = 0; i < currentIndex; i++) {
      if (
        !formCompletionStatus[tabOrder[i] as keyof typeof formCompletionStatus]
      ) {
        return true;
      }
    }
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 px-2 py-2 lg:px-6 lg:py-6 border-b bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" asChild className="h-8 w-8">
              <Link href="/leads">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-lg lg:text-2xl font-bold tracking-tight">
              Create New Lead
            </h1>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowWipeConfirm(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Wipe & Start Over</span>
            <span className="sm:hidden">Wipe</span>
          </Button>
        </div>
      </div>

      {/* Wipe Confirmation Dialog */}
      <Dialog open={showWipeConfirm} onOpenChange={setShowWipeConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wipe Current Lead?</DialogTitle>
            <DialogDescription>
              This will permanently clear all saved data for this lead, remove it
              from local storage, and start a completely fresh lead. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowWipeConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleWipeLead}>
              <Trash2 className="h-4 w-4 mr-1" />
              Wipe Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scrollable Content */}
      <div className="flex-1">
        <div className="px-2 py-2 lg:px-6 lg:py-6 space-y-2 lg:space-y-6">
          {/* Form Validation Summary */}
          {Object.keys(form.formState.errors).length > 0 && (
            <FormValidationSummary
              errors={Object.entries(form.formState.errors).map(
                ([field, error]) => ({
                  field: field.charAt(0).toUpperCase() + field.slice(1),
                  message: error?.message || "Invalid value",
                }),
              )}
              onDismiss={() => {
                // Clear errors by resetting the form state
                form.clearErrors();
              }}
            />
          )}

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <TabsList
              className={`w-full grid gap-0 lg:grid lg:gap-0 ${tabsGridClass}`}
            >
              <TabsTrigger
                value="client"
                className={`data-[state=active]:bg-blue-500 flex-1 justify-center ${
                  formCompletionStatus.client
                    ? "bg-green-100 text-green-700"
                    : ""
                }`}
                title="Client Information"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline ml-1 lg:ml-2">Client</span>
                {formCompletionStatus.client && (
                  <Badge className="ml-1 bg-green-500 text-white text-xs">
                    ✓
                  </Badge>
                )}
              </TabsTrigger>
              {!hideAffordability && (
                <TabsTrigger
                  value="affordability"
                  className={`data-[state=active]:bg-blue-500 flex-1 justify-center ${
                    formCompletionStatus.affordability
                      ? "bg-green-100 text-green-700"
                      : ""
                  }`}
                  title="Affordability"
                >
                  <Calculator className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1 lg:ml-2">
                    Affordability
                  </span>
                  {formCompletionStatus.affordability && (
                    <Badge className="ml-1 bg-green-500 text-white text-xs">
                      ✓
                    </Badge>
                  )}
                </TabsTrigger>
              )}
              <TabsTrigger
                value="loan"
                className={`data-[state=active]:bg-blue-500 flex-1 justify-center ${
                  formCompletionStatus.loan ? "bg-green-100 text-green-700" : ""
                }`}
                title="Loan Details"
              >
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline ml-1 lg:ml-2">Loan</span>
                {formCompletionStatus.loan && (
                  <Badge className="ml-1 bg-green-500 text-white text-xs">
                    ✓
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="terms"
                className={`data-[state=active]:bg-blue-500 flex-1 justify-center ${
                  formCompletionStatus.terms
                    ? "bg-green-100 text-green-700"
                    : ""
                }`}
                title="Terms and Charges"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline ml-1 lg:ml-2">
                  Terms and Charges
                </span>
                {formCompletionStatus.terms && (
                  <Badge className="ml-1 bg-green-500 text-white text-xs">
                    ✓
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="schedule"
                className={`data-[state=active]:bg-blue-500 flex-1 justify-center ${
                  formCompletionStatus.schedule
                    ? "bg-green-100 text-green-700"
                    : ""
                }`}
                title="Repayment Schedule"
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline ml-1 lg:ml-2">Schedule</span>
                {formCompletionStatus.schedule && (
                  <Badge className="ml-1 bg-green-500 text-white text-xs">
                    ✓
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="contracts"
                className={`data-[state=active]:bg-blue-500 flex-1 justify-center ${
                  formCompletionStatus.contracts
                    ? "bg-green-100 text-green-700"
                    : ""
                }`}
                title="Loan Contracts"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline ml-1 lg:ml-2">Contracts</span>
                {formCompletionStatus.contracts && (
                  <Badge className="ml-1 bg-green-500 text-white text-xs">
                    ✓
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Client Information Tab */}
            <TabsContent value="client" className="mt-0">
              <Card className="px-2 py-2 lg:px-6 lg:py-6">
                <CardHeader className="px-2 lg:px-6">
                  <CardTitle>Client Information</CardTitle>
                  <CardDescription>
                    Enter the client's personal and contact information.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-2 lg:px-6">
                  <ClientRegistrationForm
                    leadId={currentLeadId || undefined}
                    formData={clientFormData}
                    externalForm={form}
                    onFormSubmit={onSubmit}
                    clientCreatedInFineract={clientCreatedInFineract}
                    setFormCompletionStatus={setFormCompletionStatus}
                    setClientCreatedInFineract={setClientCreatedInFineract}
                    isSubmitting={isSubmitting}
                    onAllSectionsComplete={setAllClientSectionsComplete}
                    onLeadIdChange={(newLeadId) => {
                      console.log(
                        "==========> Lead ID propagated from ClientRegistrationForm:",
                        newLeadId,
                      );
                      setCurrentLeadId(newLeadId);
                      window.history.replaceState(
                        null,
                        "",
                        `/leads/new?id=${newLeadId}`,
                      );
                    }}
                    onClientCreated={() => {
                      setClientCreatedInFineract(true);
                      setFormCompletionStatus((prev) => ({
                        ...prev,
                        client: true,
                      }));
                    }}
                  />

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      className={`w-full sm:w-auto ${
                        clientCreatedInFineract && allClientSectionsComplete
                          ? "bg-green-500 hover:bg-green-600"
                          : "bg-blue-500 hover:bg-blue-600"
                      }`}
                      disabled={
                        !clientCreatedInFineract || !allClientSectionsComplete
                      }
                      onClick={() =>
                        setActiveTab(hideAffordability ? "loan" : "affordability")
                      }
                    >
                      {!clientCreatedInFineract ? (
                        "Complete Client Registration First"
                      ) : !allClientSectionsComplete ? (
                        "Complete All Client Tabs"
                      ) : (
                        <>
                          ✓ All Tabs Complete - Next:{" "}
                          {hideAffordability ? "Loan Details" : "Affordability"}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Affordability Tab */}
            {!hideAffordability && (
              <TabsContent value="affordability" className="mt-0">
                <Card className="px-2 py-2 lg:px-6 lg:py-6">
                  <CardHeader className="px-2 lg:px-6">
                    <CardTitle>Affordability Assessment</CardTitle>
                    <CardDescription>
                      Capture loan request and affordability details for the
                      client
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-2 lg:px-6">
                    <SimplifiedAffordabilityForm
                      leadId={currentLeadId || undefined}
                      onComplete={() => {
                        setFormCompletionStatus((prev) => ({
                          ...prev,
                          affordability: true,
                        }));
                        toast({
                          title: "Success",
                          description:
                            "Affordability assessment completed. You can now proceed to loan details.",
                        });
                        setActiveTab("loan");
                      }}
                      onBack={() => setActiveTab("client")}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Loan Details Tab */}
            <TabsContent value="loan" className="mt-0">
              <Card className="px-2 py-2 lg:px-6 lg:py-6">
                <CardContent className="p-2 lg:p-6">
                  {fineractClientId ? (
                    <LoanDetailsForm
                      clientId={fineractClientId}
                      leadId={currentLeadId || undefined}
                      onSubmit={(data) => {
                        console.log("Loan details submitted:", data);
                        // Handle loan details submission
                      }}
                      onBack={() =>
                        setActiveTab(hideAffordability ? "client" : "affordability")
                      }
                      onNext={(templateData) => {
                        console.log(
                          "Received template data in main form:",
                          templateData,
                        );
                        setLoanTemplateData(templateData);
                        // Extract productId from templateData if available
                        if (templateData?.productId) {
                          setLoanProductId(templateData.productId);
                        }
                        setFormCompletionStatus((prev) => ({
                          ...prev,
                          loan: true,
                        }));
                        setActiveTab("terms");
                      }}
                      onComplete={() => {
                        setFormCompletionStatus((prev) => ({
                          ...prev,
                          loan: true,
                        }));
                        toast({
                          title: "Success",
                          description:
                            "Loan details saved successfully. You can proceed to the next stage.",
                        });
                        // Note: Navigation to next tab is handled by onNext callback
                      }}
                      sharedFirstRepaymentOn={sharedFirstRepaymentOn}
                      onFirstRepaymentDateChange={setSharedFirstRepaymentOn}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        Please complete the client registration first to access
                        loan details.
                      </p>
                      <Button onClick={() => setActiveTab("client")}>
                        Go to Client Details
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>


            {/* Loan Terms Tab */}
            <TabsContent value="terms" className="mt-0">
              <Card className="p-2 lg:p-6">
                <CardContent className="p-2 lg:p-6">
                  {loanTemplateData || (fineractClientId && loanProductId) ? (
                    <LoanTermsForm
                      key={`loan-terms-${currentLeadId}`}
                      loanTemplate={loanTemplateData}
                      clientId={fineractClientId || undefined}
                      productId={loanProductId || undefined}
                      leadId={currentLeadId || undefined}
                      onSubmit={(data) => {
                        console.log("Loan terms submitted:", data);
                        // Update loanTerms state with submitted data including charges
                        setLoanTerms(data);
                        // Handle loan terms submission
                        form.handleSubmit((formValues) => onSubmit(formValues))();
                      }}
                      onBack={() => setActiveTab("loan")}
                      onNext={() => setActiveTab("schedule")}
                      onComplete={() => {
                        setFormCompletionStatus((prev) => ({
                          ...prev,
                          terms: true,
                        }));
                        toast({
                          title: "Success",
                          description:
                            "Loan terms saved successfully. You can proceed to the next stage.",
                        });
                      }}
                      sharedFirstRepaymentOn={sharedFirstRepaymentOn}
                      onFirstRepaymentDateChange={setSharedFirstRepaymentOn}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        No loan template data available
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Please complete the Loan Details tab first to load the
                        template data.
                      </p>
                      <Button
                        onClick={() => setActiveTab("loan")}
                        className="mt-2"
                      >
                        Go to Loan Details
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Repayment Schedule Tab */}
            <TabsContent value="schedule" className="mt-0">
              <Card className="px-2 py-2 lg:px-6 lg:py-6">
                <CardContent className="p-2 lg:p-6">
                  <RepaymentScheduleForm
                    leadId={currentLeadId || undefined}
                    clientId={fineractClientId || undefined}
                    onBack={() => setActiveTab("terms")}
                    onNext={() => setActiveTab("contracts")}
                    onComplete={(data) => {
                      if (data) {
                        setRepaymentSchedule(data.repaymentSchedule);
                        setLoanDetails(data.loanDetails);
                        setLoanTerms(data.loanTerms);
                        setFormCompletionStatus((prev) => ({
                          ...prev,
                          schedule: true,
                        }));
                        toast({
                          title: "Success",
                          description:
                            "Repayment schedule generated successfully. Review the schedule and proceed to contracts when ready.",
                        });
                        // Don't auto-advance - let user review the schedule first
                      }
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Loan Contracts Tab */}
            <TabsContent value="contracts" className="mt-0">
              <Card className="px-2 py-2 lg:px-6 lg:py-6">
                <CardHeader className="px-2 lg:px-6">
                  <CardTitle>Loan Contracts</CardTitle>
                  <CardDescription>
                    Generate and sign loan contracts for the borrower
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-2 lg:p-6">
                  {repaymentSchedule && loanTemplateData ? (
                    <LoanContracts
                      leadId={currentLeadId || undefined}
                      clientId={fineractClientId || undefined}
                      repaymentSchedule={repaymentSchedule}
                      loanDetails={loanDetails}
                      loanTerms={loanTerms}
                      loanTemplate={loanTemplateData}
                      onBack={() => setActiveTab("schedule")}
                      onComplete={() => {
                        setFormCompletionStatus((prev) => ({
                          ...prev,
                          contracts: true,
                        }));
                        toast({
                          title: "Success",
                          description:
                            "Loan contracts completed successfully. Loan application is complete.",
                        });
                      }}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        Please complete the repayment schedule first to access
                        loan contracts.
                      </p>
                      <Button onClick={() => setActiveTab("schedule")}>
                        Go to Repayment Schedule
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
