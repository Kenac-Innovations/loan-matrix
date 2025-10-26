"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import {
  CalendarIcon,
  Loader2,
  X,
  Search,
  UserCheck,
  UserPlus,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/searchable-select";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  saveDraft,
  getLead,
  closeLead,
  addFamilyMember,
  removeFamilyMember,
  getOffices,
  getLegalForms,
  getGenders,
  getClientTypes,
  getClientClassifications,
  getSavingsProducts,
  getActivationDate,
} from "@/app/actions/client-actions";
import {
  autoSaveField,
  getLeadStageHistory,
  cancelProspect,
  getLeadById,
} from "@/app/actions/client-actions-with-autosave";
import { LeadLocalStorage } from "@/lib/lead-local-storage";
import { ProspectContinuationDialog } from "@/app/(application)/leads/new/components/prospect-continuation-dialog";
import { useToast } from "@/hooks/use-toast";
import { useThemeColors } from "@/lib/theme-utils";
import { Calendar } from "@/components/ui/calender";
import { SkeletonForm } from "./client-registration-form-skeleton";
import { AddOfficeDialog } from "./add-office-dialogue";
import { submitClientForm } from "@/app/actions/submit-client-form";
import {
  getInputErrorStyling,
  getSelectErrorStyling,
  hasFieldError,
  getFieldError,
} from "@/lib/form-styling-utils";

// Form validation schema
const clientFormSchema = z
  .object({
    // Step 1: General Information
    officeId: z.string().min(1, "Office is required"),
    legalFormId: z.string().min(1, "Legal form is required"),
    externalId: z.string().min(1, "National ID is required"),
    firstname: z.string().min(1, "First name is required"),
    middlename: z.string().optional(),
    lastname: z.string().min(1, "Last name is required"),
    dateOfBirth: z.date({
      required_error: "Date of birth is required",
    }),
    genderId: z.string().optional(),
    isStaff: z.boolean().default(false),
    mobileNo: z.string().min(1, "Mobile number is required"),
    countryCode: z.string().default("+263"),
    emailAddress: z.string().email("Invalid email address"),
    clientTypeId: z.string().optional(),
    clientClassificationId: z.string().optional(),
    submittedOnDate: z.date().default(() => new Date()),

    // Financial Information
    monthlyIncomeRange: z.string().optional(),
    employmentStatus: z.string().optional(),
    employerName: z.string().optional(),
    yearsAtCurrentJob: z.string().optional(),
    hasExistingLoans: z.boolean().default(false),
    monthlyDebtPayments: z.number().optional(),
    propertyOwnership: z.string().optional(),
    businessOwnership: z.boolean().default(false),
    businessType: z.string().optional(),

    // Step 2: Account Settings
    active: z.boolean().default(true),
    activationDate: z.date().optional(),
    openSavingsAccount: z.boolean().default(false),
    savingsProductId: z.string().optional(),

    // Tracking
    currentStep: z.number().default(1),
  })
  .refine(
    (data) => {
      // If active is true, activationDate is required
      if (data.active && !data.activationDate) {
        return false;
      }
      return true;
    },
    {
      message: "Activation date is required when account is active",
      path: ["activationDate"],
    }
  )
  .refine(
    (data) => {
      // If openSavingsAccount is true, savingsProductId is required
      if (data.openSavingsAccount && !data.savingsProductId) {
        return false;
      }
      return true;
    },
    {
      message: "Savings product is required when opening a savings account",
      path: ["savingsProductId"],
    }
  );

// Family member schema
const familyMemberSchema = z.object({
  firstname: z.string().min(1, "First name is required"),
  lastname: z.string().min(1, "Last name is required"),
  middlename: z.string().optional(),
  relationship: z.string().min(1, "Relationship is required"),
  dateOfBirth: z.date().optional(),
  mobileNo: z.string().optional(),
  emailAddress: z.string().email("Invalid email address").optional(),
  isDependent: z.boolean().default(false),
});

// New legal form schema
const legalFormSchema = z.object({
  name: z.string().min(1, "Legal form name is required"),
  description: z.string().optional(),
});

// New gender schema
const genderSchema = z.object({
  name: z.string().min(1, "Gender name is required"),
});

// New client type schema
const clientTypeSchema = z.object({
  name: z.string().min(1, "Client type name is required"),
  description: z.string().optional(),
});

// New client classification schema
const clientClassificationSchema = z.object({
  name: z.string().min(1, "Classification name is required"),
  description: z.string().optional(),
});

// New savings product schema
const savingsProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  code: z.string().min(1, "Product code is required"),
  interestRate: z.string().min(1, "Interest rate is required"),
  description: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientFormSchema>;
type FamilyMemberValues = z.infer<typeof familyMemberSchema>;
type LegalFormValues = z.infer<typeof legalFormSchema>;
type GenderFormValues = z.infer<typeof genderSchema>;
type ClientTypeValues = z.infer<typeof clientTypeSchema>;
type ClientClassificationValues = z.infer<typeof clientClassificationSchema>;
type SavingsProductValues = z.infer<typeof savingsProductSchema>;

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

interface ClientRegistrationFormProps {
  leadId?: string;
  formData?: ClientFormData;
  externalForm?: any;
  clientCreatedInFineract?: boolean;
  onClientCreated?: () => void;
  onFormSubmit?: (data: any) => void;
  setFormCompletionStatus?: (updater: (prev: any) => any) => void;
  setClientCreatedInFineract?: (value: boolean) => void;
  isSubmitting?: boolean;
}

export function ClientRegistrationForm({
  leadId,
  formData,
  externalForm,
  clientCreatedInFineract = false,
  onClientCreated,
  onFormSubmit,
  setFormCompletionStatus,
  setClientCreatedInFineract,
  isSubmitting = false,
}: ClientRegistrationFormProps) {
  const {
    success,
    error,
    saveSuccess,
    saveError,
    validationError,
    networkError,
  } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const colors = useThemeColors();

  // State for multi-step form
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [showFamilyMemberDialog, setShowFamilyMemberDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedField, setLastSavedField] = useState<string | null>(null);
  const [stageHistory, setStageHistory] = useState<any[]>([]);

  const [nationalIdLookup, setNationalIdLookup] = useState("");
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [clientLookupStatus, setClientLookupStatus] = useState<
    "idle" | "not_found" | "found" | "error"
  >(clientCreatedInFineract ? "found" : "idle");
  const [isFormDisabled, setIsFormDisabled] = useState(false);

  // Update clientLookupStatus when clientCreatedInFineract changes
  useEffect(() => {
    if (clientCreatedInFineract) {
      setClientLookupStatus("found");
      setIsFormDisabled(false);
    }
  }, [clientCreatedInFineract]);

  // State for dropdown options
  const [offices, setOffices] = useState<any[]>([]);
  const [legalForms, setLegalForms] = useState<any[]>([]);
  const [genders, setGenders] = useState<any[]>([]);
  const [clientTypes, setClientTypes] = useState<any[]>([]);
  const [clientClassifications, setClientClassifications] = useState<any[]>([]);
  const [savingsProducts, setSavingsProducts] = useState<any[]>([]);

  // State for add new dialogs
  const [showAddOfficeDialog, setShowAddOfficeDialog] = useState(false);
  const [showAddLegalFormDialog, setShowAddLegalFormDialog] = useState(false);
  const [showAddGenderDialog, setShowAddGenderDialog] = useState(false);
  const [showAddClientTypeDialog, setShowAddClientTypeDialog] = useState(false);
  const [
    showAddClientClassificationDialog,
    setShowAddClientClassificationDialog,
  ] = useState(false);
  const [showAddSavingsProductDialog, setShowAddSavingsProductDialog] =
    useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Local storage and prospect continuation state
  const [showProspectDialog, setShowProspectDialog] = useState(false);
  const [existingProspectData, setExistingProspectData] = useState<{
    leadId: string;
    firstname?: string;
    lastname?: string;
    externalId?: string;
    emailAddress?: string;
    mobileNo?: string;
    timestamp: number;
  } | null>(null);
  const [currentLeadId, setCurrentLeadId] = useState<string | undefined>(
    leadId
  );
  const [isSettingLeadIdFromAutoSave, setIsSettingLeadIdFromAutoSave] =
    useState(false);

  // Initialize form - use external form if provided, otherwise create new one
  const form =
    externalForm ||
    useForm<ClientFormValues>({
      resolver: zodResolver(clientFormSchema) as any,
      defaultValues: {
        officeId: "1",
        legalFormId: "1",
        externalId: "",
        firstname: "",
        middlename: "",
        lastname: "",
        isStaff: false,
        mobileNo: "",
        countryCode: "+263",
        emailAddress: "",
        submittedOnDate: new Date(),
        active: true,
        openSavingsAccount: false,
        currentStep: 1,
      },
    });

  // Family member form
  const familyMemberForm = useForm<FamilyMemberValues>({
    resolver: zodResolver(familyMemberSchema) as any,
    defaultValues: {
      firstname: "",
      lastname: "",
      middlename: "",
      relationship: "",
      isDependent: false,
    },
  });

  // Legal form form
  const legalFormForm = useForm<LegalFormValues>({
    resolver: zodResolver(legalFormSchema) as any,
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Gender form
  const genderForm = useForm<GenderFormValues>({
    resolver: zodResolver(genderSchema) as any,
    defaultValues: {
      name: "",
    },
  });

  // Client type form
  const clientTypeForm = useForm<ClientTypeValues>({
    resolver: zodResolver(clientTypeSchema) as any,
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Client classification form
  const clientClassificationForm = useForm<ClientClassificationValues>({
    resolver: zodResolver(clientClassificationSchema) as any,
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Savings product form
  const savingsProductForm = useForm<SavingsProductValues>({
    resolver: zodResolver(savingsProductSchema) as any,
    defaultValues: {
      name: "",
      code: "",
      interestRate: "",
      description: "",
    },
  });

  // Convert data to options for searchable select
  const officeOptions = offices.map((office) => ({
    value: office.id.toString(),
    label: office.name,
  }));

  const legalFormOptions = legalForms.map((form) => ({
    value: form.id.toString(),
    label: form.name,
  }));

  const genderOptions = genders.map((gender) => ({
    value: gender.id.toString(),
    label: gender.name,
  }));

  const clientTypeOptions = clientTypes.map((type) => ({
    value: type.id.toString(),
    label: type.name,
  }));

  const clientClassificationOptions = clientClassifications.map(
    (classification) => ({
      value: classification.id.toString(),
      label: classification.name,
    })
  );

  const savingsProductOptions = savingsProducts.map((product) => ({
    value: product.id.toString(),
    label: product.name,
  }));

  // Check for existing prospects on mount
  useEffect(() => {
    const checkExistingProspect = async () => {
      console.log("Checking for existing prospect...", {
        leadId,
        localStorageExists: LeadLocalStorage.exists(),
        isExpired: LeadLocalStorage.isExpired(),
      });

      // Only check if no leadId is provided (new form)
      if (
        !leadId &&
        LeadLocalStorage.exists() &&
        !LeadLocalStorage.isExpired()
      ) {
        const existingData = LeadLocalStorage.load();
        console.log("Found existing data in localStorage:", existingData);

        if (existingData) {
          try {
            // Fetch the lead data from the server to verify it still exists
            const result = await getLeadById(existingData.leadId);
            console.log("Server response for existing lead:", result);

            if (result.success && result.lead) {
              setExistingProspectData({
                leadId: existingData.leadId,
                firstname: result.lead.firstname || undefined,
                lastname: result.lead.lastname || undefined,
                externalId: result.lead.externalId || undefined,
                emailAddress: result.lead.emailAddress || undefined,
                mobileNo: result.lead.mobileNo || undefined,
                timestamp: existingData.timestamp,
              });
              setShowProspectDialog(true);
              console.log("Showing prospect continuation dialog");
            } else {
              // Lead not found on server, clear local storage
              console.log("Lead not found on server, clearing localStorage");
              LeadLocalStorage.clear();
            }
          } catch (error) {
            console.error("Error fetching existing prospect:", error);
            // Clear invalid data
            LeadLocalStorage.clear();
          }
        }
      } else {
        console.log("No existing prospect check needed:", {
          hasLeadId: !!leadId,
          localStorageExists: LeadLocalStorage.exists(),
          isExpired: LeadLocalStorage.isExpired(),
        });
      }
    };

    checkExistingProspect();
  }, [leadId]);

  // Load data on mount or from props
  useEffect(() => {
    const loadData = async () => {
      if (isSettingLeadIdFromAutoSave) {
        setIsSettingLeadIdFromAutoSave(false);
        return;
      }

      setIsLoading(true);

      try {
        // If formData is provided, use it
        if (formData) {
          setOffices(formData.offices);
          setLegalForms(formData.legalForms);
          setGenders(formData.genders);
          setClientTypes(formData.clientTypes);
          setClientClassifications(formData.clientClassifications);
          setSavingsProducts(formData.savingsProducts);

          // Set activation date if provided
          if (formData.activationDate) {
            form.setValue("activationDate", formData.activationDate);
          }
        } else {
          // Otherwise fetch data from server actions
          const officesData = await getOffices();
          const legalFormsData = await getLegalForms();
          const gendersData = await getGenders();
          const clientTypesData = await getClientTypes();
          const clientClassificationsData = await getClientClassifications();
          const savingsProductsData = await getSavingsProducts();

          // Set state with fetched data
          setOffices(officesData as any[]);
          setLegalForms(legalFormsData as any[]);
          setGenders(gendersData as any[]);
          setClientTypes(clientTypesData as any[]);
          setClientClassifications(clientClassificationsData as any[]);
          setSavingsProducts(savingsProductsData as any[]);

          // Get activation date from API
          try {
            const activationDate = await getActivationDate();
            if (activationDate) {
              form.setValue("activationDate", activationDate);
            }
          } catch (error) {
            console.error("Error fetching activation date:", error);
          }
        }

        // If leadId is provided, load the lead data
        if (currentLeadId) {
          const lead = await getLead(currentLeadId);
          if (lead) {
            // Set form values from saved lead data
            form.reset({
              officeId: lead.officeId?.toString() || "1",
              legalFormId: lead.legalFormId?.toString() || "1",
              externalId: lead.externalId || "",
              firstname: lead.firstname || "",
              middlename: lead.middlename || "",
              lastname: lead.lastname || "",
              dateOfBirth: lead.dateOfBirth || undefined,
              genderId: lead.genderId?.toString() || undefined,
              isStaff: lead.isStaff || false,
              mobileNo: lead.mobileNo || "",
              countryCode: lead.countryCode || "+263",
              emailAddress: lead.emailAddress || "",
              clientTypeId: lead.clientTypeId?.toString() || undefined,
              clientClassificationId:
                lead.clientClassificationId?.toString() || undefined,
              submittedOnDate: lead.submittedOnDate || new Date(),
              active: lead.active,
              activationDate: lead.activationDate || undefined,
              openSavingsAccount: lead.openSavingsAccount || false,
              savingsProductId: lead.savingsProductId?.toString() || undefined,
              currentStep: lead.currentStep || 1,
            });

            // Set family members
            setFamilyMembers(lead.familyMembers || []);

            // Trigger actual lookup if externalId exists
            if (lead.externalId) {
              console.log("==========> Resuming prospect with externalId:", lead.externalId);
              console.log("==========> Triggering lookup to determine client state...");
              
              // Set the national ID lookup value and trigger the lookup
              setNationalIdLookup(lead.externalId);
              
              // Trigger the actual lookup process
              // This will check Fineract and local DB to determine if client exists
              setIsSearchingClient(true);
              
              try {
                let fineractData: any = null;
                let localData: any = null;

                // Step 1: Try to get client details from Fineract (PRIMARY SOURCE)
                try {
                  const externalIdResponse = await fetch(
                    `/api/fineract/clients/external-id/${lead.externalId}`
                  );

                  if (externalIdResponse.ok) {
                    const clientData = await externalIdResponse.json();
                    const fullClientResponse = await fetch(
                      `/api/fineract/clients/${clientData.id}`
                    );

                    if (fullClientResponse.ok) {
                      fineractData = await fullClientResponse.json();
                    }
                  }
                } catch (error) {
                  console.log("Fineract lookup failed, trying search method");
                  
                  // Try search method as fallback
                  try {
                    const searchResponse = await fetch("/api/fineract/clients/search", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        text: lead.externalId,
                        page: 0,
                        size: 50,
                      }),
                    });

                    if (searchResponse.ok) {
                      const searchData = await searchResponse.json();
                      if (searchData.pageItems && searchData.pageItems.length > 0) {
                        const client = searchData.pageItems[0];
                        const detailResponse = await fetch(
                          `/api/fineract/clients/${client.id}`
                        );
                        if (detailResponse.ok) {
                          fineractData = await detailResponse.json();
                        }
                      }
                    }
                  } catch (searchError) {
                    console.log("Fineract search also failed");
                  }
                }

                // Step 2: Try to get additional data from local database
                try {
                  const localResponse = await fetch(
                    `/api/leads/search-by-external-id?externalId=${lead.externalId}`
                  );
                  if (localResponse.ok) {
                    const localResult = await localResponse.json();
                    if (localResult.success && localResult.leads.length > 0) {
                      localData = localResult.leads[0];
                    }
                  }
                } catch (localError) {
                  console.log("Local database lookup failed:", localError);
                }

                // Step 3: Determine state based on lookup results
                if (fineractData || localData) {
                  console.log("==========> Lookup successful - client found in Fineract or local DB");
                  
                  // Helper function to check if a value is meaningful
                  const hasValue = (value: any): boolean => {
                    return value !== null && value !== undefined && value !== "";
                  };

                  // Helper function to get the best value with proper fallback
                  const getBestValue = (
                    fineractValue: any,
                    localValue: any,
                    defaultValue: any = ""
                  ) => {
                    if (hasValue(fineractValue)) return fineractValue;
                    if (hasValue(localValue)) return localValue;
                    return defaultValue;
                  };

                  const interlacedData = {
                    fineractClientId: fineractData?.id?.toString(),
                    fineractAccountNo: fineractData?.accountNo,
                    officeId: getBestValue(
                      fineractData?.officeId?.toString(),
                      localData?.officeId?.toString(),
                      lead.officeId?.toString() || "1"
                    ),
                    legalFormId: getBestValue(
                      fineractData?.legalForm?.id?.toString(),
                      localData?.legalFormId?.toString(),
                      lead.legalFormId?.toString() || "1"
                    ),
                    externalId: getBestValue(
                      fineractData?.externalId,
                      localData?.externalId,
                      lead.externalId
                    ),
                    firstname: getBestValue(
                      fineractData?.firstname,
                      localData?.firstname,
                      lead.firstname
                    ),
                    middlename: getBestValue(
                      fineractData?.middlename,
                      localData?.middlename,
                      lead.middlename
                    ),
                    lastname: getBestValue(
                      fineractData?.lastname,
                      localData?.lastname,
                      lead.lastname
                    ),
                  };

                  // If we have Fineract data, client exists in Fineract
                  if (fineractData) {
                    console.log("==========> Client exists in Fineract");
                    console.log("==========> Setting clientCreatedInFineract to true");
                    
                    setClientLookupStatus("found");
                    setIsFormDisabled(false);
                    
                    // Update parent component's state
                    if (setFormCompletionStatus) {
                      setFormCompletionStatus((prev) => ({ ...prev, client: true }));
                    }
                    if (setClientCreatedInFineract) {
                      setClientCreatedInFineract(true);
                    }

                    // Store the Fineract client ID for future updates
                    if (fineractData?.id) {
                      (window as any).fineractClientId = fineractData.id;
                    }
                  } else if (localData) {
                    // Client exists locally but not in Fineract yet
                    console.log("==========> Client exists in local DB but not in Fineract");
                    setClientLookupStatus("not_found");
                    setIsFormDisabled(false);
                  } else {
                    // No data found
                    console.log("==========> No client data found");
                    setClientLookupStatus("not_found");
                    setIsFormDisabled(false);
                  }
                } else {
                  console.log("==========> No client found in Fineract or local DB");
                  setClientLookupStatus("not_found");
                  setIsFormDisabled(false);
                }
              } catch (err) {
                console.error("Error during lookup:", err);
                setClientLookupStatus("not_found");
                setIsFormDisabled(false);
              } finally {
                setIsSearchingClient(false);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error loading data:", err);
        error({
          title: "Error",
          description: "Failed to load form data. Please try again.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentLeadId, form, searchParams]);

  // Load stage history when leadId changes
  useEffect(() => {
    const loadStageHistory = async () => {
      if (currentLeadId) {
        try {
          const history = await getLeadStageHistory(currentLeadId);
          setStageHistory(history);
        } catch (error) {
          console.error("Error loading stage history:", error);
        }
      }
    };

    loadStageHistory();
  }, [currentLeadId]);

  // Handle prospect continuation
  useEffect(() => {
    const loadStageHistory = async () => {
      if (currentLeadId) {
        try {
          const history = await getLeadStageHistory(currentLeadId);
          setStageHistory(history);
        } catch (error) {
          console.error("Error loading stage history:", error);
        }
      }
    };

    loadStageHistory();
  }, [currentLeadId]);

  // Handle prospect continuation
  const handleContinueProspect = async () => {
    console.log("Continuing with existing prospect:", existingProspectData);

    if (existingProspectData) {
      // Set the current lead ID and navigate to the existing prospect
      setCurrentLeadId(existingProspectData.leadId);

      // Update the URL to reflect the leadId
      const newUrl = `/leads/new?id=${existingProspectData.leadId}`;
      router.replace(newUrl);

      // Load the lead data to get the external ID
      try {
        const lead = await getLead(existingProspectData.leadId);
        if (lead && lead.externalId) {
          // Pre-populate the search field with the external ID
          setNationalIdLookup(lead.externalId);
        }
      } catch (error) {
        console.error("Error loading lead data for search field:", error);
      }

      // Skip the search step since we're resuming an existing prospect
      setClientLookupStatus("found");
      setIsFormDisabled(false);

      setShowProspectDialog(false);

      success({
        title: "Prospect Restored",
        description: "Continuing with your existing prospect.",
      });
    }
  };

  const handleCancelProspect = async (reason: string) => {
    console.log("Canceling existing prospect with reason:", reason);

    if (existingProspectData) {
      try {
        // Cancel the prospect in the database
        const result = await cancelProspect(
          existingProspectData.leadId,
          reason
        );

        if (result.success) {
          // Clear local storage
          LeadLocalStorage.clear();

          success({
            title: "Prospect Canceled",
            description:
              "The previous prospect has been canceled. You can now start a new one.",
          });

          // Reset the form for a new prospect
          form.reset({
            officeId: "1",
            legalFormId: "1",
            externalId: "",
            firstname: "",
            middlename: "",
            lastname: "",
            isStaff: false,
            mobileNo: "",
            countryCode: "+263",
            emailAddress: "",
            submittedOnDate: new Date(),
            active: true,
            activationDate: new Date(),
            openSavingsAccount: false,
            currentStep: 1,
          });

          setFamilyMembers([]);
          setCurrentLeadId(undefined);
        } else {
          error({
            title: "Error",
            description: result.error || "Failed to cancel prospect",
          });
        }
      } catch (err) {
        console.error("Error canceling prospect:", err);
        error({
          title: "Error",
          description:
            "An unexpected error occurred while canceling the prospect",
        });
      }
    }

    setShowProspectDialog(false);
    setExistingProspectData(null);
  };

  const handleCloseProspectDialog = () => {
    setShowProspectDialog(false);
  };

  // Handle field blur for auto-save
  const handleFieldBlur = async (fieldName: string, value: any) => {
    setIsAutoSaving(true);
    setLastSavedField(fieldName);

    try {
      const formData = form.getValues();
      console.log("Auto-saving field:", fieldName, "with value:", value);

      const result = await autoSaveField(
        {
          ...formData,
          [fieldName]: value,
          fieldName: fieldName,
        },
        currentLeadId
      );

      console.log("Auto-save result:", result);

      if (result.success) {
        const leadId = result.leadId;

        if (!currentLeadId && leadId) {
          setIsSettingLeadIdFromAutoSave(true);
          // If no leadId yet, update URL and state with the new leadId
          setCurrentLeadId(leadId);
        }

        // Save to local storage
        LeadLocalStorage.save({
          leadId: leadId!,
          formData: formData,
          timestamp: Date.now(),
          step: "lead",
        });
      }
    } catch (error) {
      console.error("Error auto-saving field:", error);
    } finally {
      setTimeout(() => {
        setIsAutoSaving(false);
      }, 1000); // Show saving indicator for at least 1 second
    }
  };

  // Handle client lookup by National ID
  const handleClientLookup = async () => {
    if (!nationalIdLookup.trim()) {
      validationError("Please enter a national ID number");
      return;
    }

    setIsSearchingClient(true);
    setClientLookupStatus("idle");

    try {
      let fineractData: any = null;
      let localData: any = null;

      // Step 1: Try to get client details from Fineract (PRIMARY SOURCE)
      try {
        const externalIdResponse = await fetch(
          `/api/fineract/clients/external-id/${nationalIdLookup}`
        );

        if (externalIdResponse.ok) {
          // Client found by external ID - this gives us the email address
          const clientData = await externalIdResponse.json();

          // Now we need to get the FULL client details using the client ID
          // This will give us gender, client type, classification, etc.
          const fullClientResponse = await fetch(
            `/api/fineract/clients/${clientData.id}`
          );

          if (fullClientResponse.ok) {
            const fullClientData = await fullClientResponse.json();

            console.log(
              "==========> DEBUG: Full Fineract client data:",
              fullClientData
            );
            console.log(
              "==========> DEBUG: Available fields:",
              Object.keys(fullClientData)
            );
            console.log(
              "==========> DEBUG: Account number field:",
              fullClientData.accountNo
            );
            console.log(
              "==========> DEBUG: Activation date field:",
              fullClientData.activationDate
            );
            console.log(
              "==========> DEBUG: Activation date is array:",
              Array.isArray(fullClientData.activationDate)
            );
            console.log(
              "==========> DEBUG: Submitted on date field:",
              fullClientData.submittedOnDate
            );
            console.log(
              "==========> DEBUG: Submitted on date is array:",
              Array.isArray(fullClientData.submittedOnDate)
            );

            // Combine both Fineract responses
            fineractData = {
              ...fullClientData, // Base data (gender, client type, classification, etc.)
              emailAddress: clientData.emailAddress, // Email from external ID endpoint
              externalId: clientData.externalId, // External ID from external ID endpoint
            };
          } else {
            // Fall back to using just the external ID data if full client lookup fails
            fineractData = {
              ...clientData,
              emailAddress: clientData.emailAddress,
              externalId: clientData.externalId,
            };
          }
        }
      } catch (externalIdError) {
        console.log("Fineract external ID lookup failed, trying search method");

        // Try search method as fallback
        try {
          const searchResponse = await fetch("/api/fineract/clients/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: nationalIdLookup,
              page: 0,
              size: 50,
            }),
          });

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();

            if (searchData.pageItems && searchData.pageItems.length > 0) {
              const client = searchData.pageItems[0];

              // Fetch detailed client information
              const detailResponse = await fetch(
                `/api/fineract/clients/${client.id}`
              );

              if (detailResponse.ok) {
                const clientData = await detailResponse.json();

                console.log(
                  "==========> DEBUG: Search method - Full client data:",
                  clientData
                );
                console.log(
                  "==========> DEBUG: Search method - Available fields:",
                  Object.keys(clientData)
                );
                console.log(
                  "==========> DEBUG: Search method - Account number field:",
                  clientData.accountNo
                );

                fineractData = {
                  ...clientData,
                  ...client, // Merge search result data
                };
              }
            }
          }
        } catch (searchError) {
          console.log("Fineract search also failed");
        }
      }

      // Step 2: Try to get additional data from local database (SECONDARY SOURCE)
      try {
        const localResponse = await fetch(
          `/api/leads/search-by-external-id?externalId=${nationalIdLookup}`
        );

        if (localResponse.ok) {
          const localResult = await localResponse.json();
          if (localResult.success && localResult.leads.length > 0) {
            // Get the most recent lead (first in the array due to ordering)
            localData = localResult.leads[0];
          }
        }
      } catch (localError) {
        console.log("Local database lookup failed:", localError);
      }

      // Step 3: Interlace the data - Fineract takes priority, local fills gaps
      if (fineractData || localData) {
        console.log("==========> Client lookup successful - interlacing data");
        console.log("Fineract data:", fineractData);
        console.log("Local data:", localData);

        // Helper function to check if a value is meaningful (not empty, null, or undefined)
        const hasValue = (value: any): boolean => {
          return value !== null && value !== undefined && value !== "";
        };

        // Helper function to get the best value with proper fallback
        const getBestValue = (
          fineractValue: any,
          localValue: any,
          defaultValue: any = ""
        ) => {
          if (hasValue(fineractValue)) return fineractValue;
          if (hasValue(localValue)) return localValue;
          return defaultValue;
        };

        const interlacedData = {
          // Fineract client identification (CRITICAL for updates)
          fineractClientId: fineractData?.id?.toString(),
          fineractAccountNo: fineractData?.accountNo,

          // Primary: Fineract data (takes priority), but fallback to local if Fineract value is empty
          officeId: getBestValue(
            fineractData?.officeId?.toString(),
            localData?.officeId?.toString(),
            "1"
          ),
          legalFormId: getBestValue(
            fineractData?.legalForm?.id?.toString(),
            localData?.legalFormId?.toString(),
            "1"
          ),
          externalId: getBestValue(
            fineractData?.externalId,
            localData?.externalId,
            nationalIdLookup
          ),
          firstname: getBestValue(
            fineractData?.firstname,
            localData?.firstname
          ),
          middlename: getBestValue(
            fineractData?.middlename,
            localData?.middlename
          ),
          lastname: getBestValue(fineractData?.lastname, localData?.lastname),
          dateOfBirth: fineractData?.dateOfBirth
            ? new Date(fineractData.dateOfBirth)
            : localData?.dateOfBirth
            ? new Date(localData.dateOfBirth)
            : undefined,
          genderId: getBestValue(
            fineractData?.gender?.id?.toString(),
            localData?.genderId?.toString()
          ),
          isStaff:
            fineractData?.isStaff !== undefined
              ? fineractData.isStaff
              : localData?.isStaff !== undefined
              ? localData.isStaff
              : false,
          // Phone number from Fineract, but country code from local if Fineract doesn't have it
          mobileNo: getBestValue(fineractData?.mobileNo, localData?.mobileNo),
          countryCode: getBestValue(
            fineractData?.countryCode,
            localData?.countryCode,
            "+263"
          ),
          emailAddress: getBestValue(
            fineractData?.emailAddress,
            localData?.emailAddress
          ),
          clientTypeId: getBestValue(
            fineractData?.clientType?.id?.toString(),
            localData?.clientTypeId?.toString()
          ),
          clientClassificationId: getBestValue(
            fineractData?.clientClassification?.id?.toString(),
            localData?.clientClassificationId?.toString()
          ),
          submittedOnDate: fineractData?.submittedOnDate
            ? Array.isArray(fineractData.submittedOnDate)
              ? (() => {
                  const [year, month, day] = fineractData.submittedOnDate;
                  // Create date at midnight to avoid timezone issues
                  return new Date(Date.UTC(year, month - 1, day));
                })()
              : new Date(fineractData.submittedOnDate)
            : localData?.submittedOnDate
            ? new Date(localData.submittedOnDate)
            : new Date(),
          active:
            fineractData?.active !== undefined
              ? fineractData.active
              : localData?.active !== undefined
              ? localData.active
              : true,
          activationDate: fineractData?.activationDate
            ? Array.isArray(fineractData.activationDate)
              ? (() => {
                  const [year, month, day] = fineractData.activationDate;
                  // Create date at midnight to avoid timezone issues
                  return new Date(Date.UTC(year, month - 1, day));
                })()
              : new Date(fineractData.activationDate)
            : localData?.activationDate
            ? new Date(localData.activationDate)
            : undefined,
          openSavingsAccount: false,
          currentStep: 1,
        };

        console.log("==========> DEBUG: Interlaced data with Fineract IDs:");
        console.log(
          "==========> fineractClientId:",
          interlacedData.fineractClientId
        );
        console.log(
          "==========> fineractAccountNo:",
          interlacedData.fineractAccountNo
        );
        console.log("==========> Full interlaced data:", interlacedData);

        // Pre-populate form with interlaced data
        console.log(
          "==========> Resetting form with interlaced data:",
          interlacedData
        );
        form.reset(interlacedData);

        // Set family members if available (from either source)
        const familyMembers =
          fineractData?.familyMembers || localData?.familyMembers;
        if (familyMembers && familyMembers.length > 0) {
          setFamilyMembers(familyMembers);
        }

        console.log("==========> Setting client lookup status to found");
        setClientLookupStatus("found");
        setIsFormDisabled(false);

        // Save the populated form data as a draft in the database
        try {
          const formValues = form.getValues();
          console.log("==========> Saving lookup data as draft:", formValues);
          console.log("==========> Form values keys:", Object.keys(formValues));
          console.log(
            "==========> Email address value:",
            formValues.emailAddress
          );
          console.log("==========> First name value:", formValues.firstname);
          console.log("==========> Last name value:", formValues.lastname);

          // Save as draft which will create/update a lead in the database
          const saveResult = await handleSaveDraft(formValues);
          console.log("==========> Save result:", saveResult);

          if (saveResult.success && saveResult.leadId) {
            // Update currentLeadId with the newly created lead
            setCurrentLeadId(saveResult.leadId);

            // Save to localStorage for persistence
            LeadLocalStorage.save({
              leadId: saveResult.leadId,
              formData: formValues,
              timestamp: Date.now(),
              step: "client",
            });

            console.log(
              "==========> Lookup data saved as draft with leadId:",
              saveResult.leadId
            );
          } else {
            console.error("==========> Save failed:", saveResult.error);
          }
        } catch (error) {
          console.error(
            "==========> Error saving lookup data as draft:",
            error
          );
          console.error("==========> Error type:", typeof error);
          console.error(
            "==========> Error message:",
            error instanceof Error ? error.message : String(error)
          );
          console.error(
            "==========> Error stack:",
            error instanceof Error ? error.stack : "No stack"
          );
        }

        // Mark the client step as completed since we found an existing client
        console.log("==========> Marking client step as completed");
        if (setFormCompletionStatus) {
          setFormCompletionStatus((prev) => ({ ...prev, client: true }));
        }
        if (setClientCreatedInFineract) {
          console.log("==========> Setting clientCreatedInFineract to true");
          setClientCreatedInFineract(true);
        } else {
          console.log(
            "==========> setClientCreatedInFineract function not available"
          );
        }

        // Store the Fineract client ID for future updates
        if (fineractData?.id) {
          console.log(
            "==========> Storing Fineract client ID:",
            fineractData.id
          );
          // Store in a way that can be accessed by the parent component
          (window as any).fineractClientId = fineractData.id;
          console.log(
            "==========> Stored fineractClientId in window:",
            (window as any).fineractClientId
          );
        } else {
          console.log(
            "==========> No fineractData.id found, cannot store Fineract client ID"
          );
        }

        // Determine success message based on data sources
        const dataSources = [];
        if (fineractData) dataSources.push("Fineract");
        if (localData) dataSources.push("Local Database");

        console.log("==========> Showing success message");
        success({
          title: "Client Found - Step 1 Complete",
          description: `Found existing client: ${
            interlacedData.firstname || ""
          } ${interlacedData.lastname || ""} (Email: ${
            interlacedData.emailAddress || "Not provided"
          }). You can now update client details or proceed to Step 2: Affordability.`,
        });

        console.log(
          "==========> Client lookup completed successfully, returning"
        );
        return; // Exit early since we found the client
      }

      // If no data found from either source
      setClientLookupStatus("not_found");
      setIsFormDisabled(false);

      // Set the searched national ID in the form's externalId field for new client
      form.setValue("externalId", nationalIdLookup);

      success({
        title: "Client Not Found",
        description:
          "No client found with this ID. You can proceed with new client registration.",
      });
    } catch (err) {
      console.error("==========> Error in client lookup:", err);
      console.error("==========> Error details:", {
        message: err instanceof Error ? err.message : "Unknown error",
        stack: err instanceof Error ? err.stack : undefined,
        name: err instanceof Error ? err.name : undefined,
      });
      setClientLookupStatus("error");

      error({
        title: "Error",
        description: "Failed to look up client. Please try again.",
      });
    } finally {
      console.log(
        "==========> Client lookup finally block - setting isSearchingClient to false"
      );
      setIsSearchingClient(false);
    }
  };

  // Handle clearing client lookup
  const handleClearClientLookup = () => {
    setNationalIdLookup("");
    setClientLookupStatus("idle");
    setIsFormDisabled(true);

    // Reset form to default values
    form.reset({
      officeId: "1",
      legalFormId: "1",
      externalId: "",
      firstname: "",
      middlename: "",
      lastname: "",
      isStaff: false,
      mobileNo: "",
      countryCode: "+263",
      emailAddress: "",
      submittedOnDate: new Date(),
      active: true,
      openSavingsAccount: false,
      currentStep: 1,
    });

    // Clear family members
    setFamilyMembers([]);
  };

  // Handle saving draft
  const handleSaveDraft = async (data: ClientFormValues) => {
    setIsSaving(true);

    try {
      console.log("==========> handleSaveDraft called with data:", data);
      console.log("==========> Email address in data:", data.emailAddress);

      // Convert data types to match the schema expectations
      const processedData = {
        ...data,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        submittedOnDate: data.submittedOnDate
          ? new Date(data.submittedOnDate)
          : new Date(),
        activationDate: data.activationDate
          ? new Date(data.activationDate)
          : undefined,
        // Convert string IDs to numbers for the API
        officeId: Number(data.officeId),
        legalFormId: Number(data.legalFormId),
        clientTypeId: data.clientTypeId ? Number(data.clientTypeId) : undefined,
        clientClassificationId: data.clientClassificationId
          ? Number(data.clientClassificationId)
          : undefined,
        genderId: data.genderId ? Number(data.genderId) : undefined,
        savingsProductId: data.savingsProductId
          ? Number(data.savingsProductId)
          : undefined,
      };

      console.log("==========> Processed data before save:", processedData);
      console.log(
        "==========> Email in processed data:",
        processedData.emailAddress
      );
      console.log("==========> Current leadId:", leadId);

      const result = await saveDraft(processedData, leadId);

      console.log("==========> Save draft result:", result);

      if (result.success) {
        // If no leadId yet, update URL with the new leadId
        if (!leadId && result.leadId) {
          router.push(`/leads/new?id=${result.leadId}`);
        }

        saveSuccess("Draft");

        return { success: true, leadId: result.leadId };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      return { success: false, error: "Failed to save draft" };
    } finally {
      setIsSaving(false);
    }
  };

  // Handle closing lead
  const handleCloseLead = async () => {
    if (!closeReason) {
      validationError("Please provide a reason for closing");
      return;
    }

    setIsClosing(true);

    try {
      if (!leadId) {
        error({
          title: "Error",
          description: "No lead ID found",
        });
        return;
      }

      const result = await closeLead(leadId, closeReason);

      if (result.success) {
        success({
          title: "Lead Closed",
          description: "The lead has been closed",
        });

        // Redirect to leads page
        router.push("/leads");
      } else {
        error({
          title: "Error",
          description: result.error || "Failed to close lead",
        });
      }
    } catch (err) {
      console.error("Error closing lead:", err);
      error({
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setIsClosing(false);
      setShowCloseDialog(false);
    }
  };
  // Handle adding family member
  const handleAddFamilyMember = async (data: FamilyMemberValues) => {
    let effectiveLeadId = currentLeadId;

    if (!effectiveLeadId) {
      // Save the form first to get a leadId
      const formData = form.getValues();
      const saveResult = await handleSaveDraft(formData);

      if (!saveResult.success) {
        error({
          title: "Error",
          description: saveResult.error || "Failed to save draft",
        });
        return;
      }

      effectiveLeadId = saveResult.leadId;
      setCurrentLeadId(effectiveLeadId);
    }

    try {
      const result = await addFamilyMember(effectiveLeadId!, data);

      if (result.success) {
        success({
          title: "Success",
          description: "Family member added",
        });

        // Reset form and close dialog
        familyMemberForm.reset();
        setShowFamilyMemberDialog(false);

        // Refresh family members
        const lead = await getLead(effectiveLeadId!);
        if (lead) {
          setFamilyMembers(lead.familyMembers || []);
        }
      } else {
        error({
          title: "Error",
          description: result.error || "Failed to add family member",
        });
      }
    } catch (err) {
      console.error("Error adding family member:", err);
      error({
        title: "Error",
        description: "An unexpected error occurred",
      });
    }
  };

  // Handle removing family member
  const handleRemoveFamilyMember = async (id: string) => {
    try {
      const result = await removeFamilyMember(id);

      if (result.success) {
        success({
          title: "Success",
          description: "Family member removed",
        });

        // Refresh family members
        if (leadId) {
          const lead = await getLead(leadId);
          if (lead) {
            setFamilyMembers(lead.familyMembers || []);
          }
        }
      } else {
        error({
          title: "Error",
          description: result.error || "Failed to remove family member",
        });
      }
    } catch (err) {
      console.error("Error removing family member:", err);
      error({
        title: "Error",
        description: "An unexpected error occurred",
      });
    }
  };

  // Handle adding new legal form
  const handleAddLegalForm = async (data: LegalFormValues) => {
    setIsAddingNew(true);
    try {
      // Simulate a successful response
      const mockResult = {
        success: true,
        id: Math.floor(Math.random() * 1000) + 100, // Generate a random ID
        name: data.name,
        description: data.description || null,
      };

      success({
        title: "Success",
        description: "Legal form added successfully",
      });

      // Add the new legal form to the local state
      setLegalForms([...legalForms, mockResult]);

      // Select the new legal form
      form.setValue("legalFormId", mockResult.id.toString());

      // Close dialog and reset form
      setShowAddLegalFormDialog(false);
      legalFormForm.reset();
    } catch (err) {
      console.error("Error adding legal form:", err);
      error({
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setIsAddingNew(false);
    }
  };

  // Handle adding new gender
  const handleAddGender = async (data: GenderFormValues) => {
    setIsAddingNew(true);
    try {
      // Simulate a successful response
      const mockResult = {
        success: true,
        id: Math.floor(Math.random() * 1000) + 100, // Generate a random ID
        name: data.name,
        description: null,
      };

      success({
        title: "Success",
        description: "Gender added successfully",
      });

      // Add the new gender to the local state
      setGenders([...genders, mockResult]);

      // Select the new gender
      form.setValue("genderId", mockResult.id.toString());

      // Close dialog and reset form
      setShowAddGenderDialog(false);
      genderForm.reset();
    } catch (err) {
      console.error("Error adding gender:", err);
      error({
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setIsAddingNew(false);
    }
  };

  // Handle adding new client type
  const handleAddClientType = async (data: ClientTypeValues) => {
    setIsAddingNew(true);
    try {
      // Simulate a successful response
      const mockResult = {
        success: true,
        id: Math.floor(Math.random() * 1000) + 100, // Generate a random ID
        name: data.name,
        description: data.description || null,
      };

      success({
        title: "Success",
        description: "Client type added successfully",
      });

      // Add the new client type to the local state
      setClientTypes([...clientTypes, mockResult]);

      // Select the new client type
      form.setValue("clientTypeId", mockResult.id.toString());

      // Close dialog and reset form
      setShowAddClientTypeDialog(false);
      clientTypeForm.reset();
    } catch (err) {
      console.error("Error adding client type:", err);
      error({
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setIsAddingNew(false);
    }
  };

  // Handle adding new client classification
  const handleAddClientClassification = async (
    data: ClientClassificationValues
  ) => {
    setIsAddingNew(true);
    try {
      // Simulate a successful response
      const mockResult = {
        success: true,
        id: Math.floor(Math.random() * 1000) + 100, // Generate a random ID
        name: data.name,
        description: data.description || null,
      };

      success({
        title: "Success",
        description: "Client classification added successfully",
      });

      // Add the new client classification to the local state
      setClientClassifications([...clientClassifications, mockResult]);

      // Select the new client classification
      form.setValue("clientClassificationId", mockResult.id.toString());

      // Close dialog and reset form
      setShowAddClientClassificationDialog(false);
      clientClassificationForm.reset();
    } catch (err) {
      console.error("Error adding client classification:", err);
      error({
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setIsAddingNew(false);
    }
  };

  // Handle adding new savings product
  const handleAddSavingsProduct = async (data: SavingsProductValues) => {
    setIsAddingNew(true);
    try {
      // Simulate a successful response
      const mockResult = {
        success: true,
        id: Math.floor(Math.random() * 1000) + 100, // Generate a random ID
        name: data.name,
        description: data.description || null,
        interestRate: parseFloat(data.interestRate),
        minBalance: 0,
      };

      success({
        title: "Success",
        description: "Savings product added successfully",
      });

      // Add the new savings product to the local state
      setSavingsProducts([...savingsProducts, mockResult]);

      // Select the new savings product
      form.setValue("savingsProductId", mockResult.id.toString());

      // Close dialog and reset form
      setShowAddSavingsProductDialog(false);
      savingsProductForm.reset();
    } catch (err) {
      console.error("Error adding savings product:", err);
      error({
        title: "Error",
        description: "An unexpected error occurred",
      });
    } finally {
      setIsAddingNew(false);
    }
  };

  return (
    <>
      {/* Prospect Continuation Dialog */}
      <div className="flex items-center justify-center p-4">
        <ProspectContinuationDialog
          isOpen={showProspectDialog}
          onContinue={handleContinueProspect}
          onCancel={handleCancelProspect}
          onClose={handleCloseProspectDialog}
          prospectData={existingProspectData || undefined}
        />
      </div>
      <div className="space-y-6">
        {isLoading ? (
          <SkeletonForm />
        ) : (
          <>
            {/* Client ID Lookup Section */}
            <Card className={`border-${colors.borderColor} ${colors.cardBg}`}>
              <CardHeader>
                <CardTitle className={colors.textColor}>
                  Client Registration
                </CardTitle>
                <CardDescription className={colors.textColorMuted}>
                  Enter client ID number to search for an existing client or
                  create a new one.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="nationalIdLookup"
                      className={colors.textColor}
                    >
                      National ID Number <span className="text-red-500">*</span>
                    </Label>
                    <div className="space-y-2">
                      {/* Mobile layout - stacked */}
                      <div className="sm:hidden space-y-2">
                        {/* Input field with close button on mobile */}
                        <div className="relative">
                          <Input
                            id="nationalIdLookup"
                            placeholder="Enter national ID number (e.g. 22-000000Z12)"
                            value={nationalIdLookup}
                            onChange={(e) =>
                              setNationalIdLookup(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                nationalIdLookup.trim() &&
                                !isSearchingClient
                              ) {
                                e.preventDefault();
                                handleClientLookup();
                              }
                            }}
                            className={`h-10 w-full border-${
                              colors.borderColor
                            } ${colors.inputBg} ${
                              clientLookupStatus !== "idle" ? "pr-10" : ""
                            }`}
                            disabled={isSearchingClient}
                          />
                          {/* Close button positioned absolutely on mobile */}
                          {clientLookupStatus !== "idle" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={handleClearClientLookup}
                              className={`absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 border-${colors.borderColor} hover:bg-${colors.hoverBgColor}`}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        {/* Search button on mobile */}
                        <Button
                          type="button"
                          onClick={handleClientLookup}
                          disabled={
                            isSearchingClient || !nationalIdLookup.trim()
                          }
                          className={`transition-all duration-300 ease-in-out w-full ${
                            isSearchingClient
                              ? "bg-blue-600 cursor-not-allowed opacity-75"
                              : "bg-blue-500 hover:bg-blue-600"
                          }`}
                        >
                          <div className="flex items-center justify-center transition-all duration-300">
                            {isSearchingClient ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin transition-opacity duration-300" />
                                <span className="transition-opacity duration-300">
                                  Searching...
                                </span>
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4 transition-transform duration-300" />
                                <span className="transition-all duration-300">
                                  Search
                                </span>
                              </>
                            )}
                          </div>
                        </Button>
                      </div>

                      {/* Desktop layout - inline */}
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="flex-1 relative">
                          <Input
                            id="nationalIdLookup"
                            placeholder="Enter national ID number (e.g. 22-000000Z12)"
                            value={nationalIdLookup}
                            onChange={(e) =>
                              setNationalIdLookup(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (
                                e.key === "Enter" &&
                                nationalIdLookup.trim() &&
                                !isSearchingClient
                              ) {
                                e.preventDefault();
                                handleClientLookup();
                              }
                            }}
                            className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                            disabled={isSearchingClient}
                          />
                        </div>

                        <Button
                          type="button"
                          onClick={handleClientLookup}
                          disabled={
                            isSearchingClient || !nationalIdLookup.trim()
                          }
                          className={`transition-all duration-300 ease-in-out min-w-[100px] flex-shrink-0 ${
                            isSearchingClient
                              ? "bg-blue-600 cursor-not-allowed opacity-75"
                              : "bg-blue-500 hover:bg-blue-600"
                          }`}
                        >
                          <div className="flex items-center justify-center transition-all duration-300">
                            {isSearchingClient ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin transition-opacity duration-300" />
                                <span className="transition-opacity duration-300">
                                  Searching...
                                </span>
                              </>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4 transition-transform duration-300" />
                                <span className="transition-all duration-300">
                                  Search
                                </span>
                              </>
                            )}
                          </div>
                        </Button>

                        {/* Clear button for desktop */}
                        {clientLookupStatus !== "idle" && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleClearClientLookup}
                            className={`border-${colors.borderColor} hover:bg-${colors.hoverBgColor} flex-shrink-0`}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className={`text-xs ${colors.textColorMuted}`}>
                      Enter the client's national ID number to search for
                      existing records
                    </p>
                  </div>

                  {clientLookupStatus === "found" && (
                    <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                      <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        <strong>Client Found:</strong> The form has been
                        pre-populated with the existing client's information.
                        You can review and update the details as needed.
                      </AlertDescription>
                    </Alert>
                  )}

                  {clientLookupStatus === "not_found" && (
                    <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                      <UserPlus className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <AlertDescription className="text-blue-800 dark:text-blue-200">
                        <strong>New Client:</strong> No client found with this
                        ID. Please proceed with entering the client's
                        information.
                      </AlertDescription>
                    </Alert>
                  )}

                  {clientLookupStatus === "error" && (
                    <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <AlertDescription className="text-red-800 dark:text-red-200">
                        <strong>Error:</strong> Failed to look up client. Please
                        try again or proceed with manual entry.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>

            {(() => {
              const FormWrapper = externalForm ? "div" : "form";
              const formProps = externalForm
                ? {}
                : { onSubmit: () => submitClientForm };

              return (
                <FormWrapper {...formProps}>
                  {/* Hidden field for current lead ID */}
                  <input
                    type="hidden"
                    name="currentLeadId"
                    value={currentLeadId || ""}
                  />

                  {/* Only show client information sections after National ID is checked */}
                  {clientLookupStatus !== "idle" && (
                    <Card
                      className={`border-${colors.borderColor} ${
                        colors.cardBg
                      } ${
                        clientCreatedInFineract
                          ? "border-green-500 bg-green-50 dark:bg-green-950"
                          : ""
                      }`}
                    >
                      <CardHeader>
                        <CardTitle className={colors.textColor}>
                          Client Information
                        </CardTitle>
                        <CardDescription className={colors.textColorMuted}>
                          {clientCreatedInFineract ? (
                            <div className="flex items-center text-green-600 dark:text-green-400">
                              <UserCheck className="h-4 w-4 mr-2" />
                              Client successfully created in Fineract! Form is
                              ready for next step.
                            </div>
                          ) : clientLookupStatus === "found" ? (
                            "Review and update the client's information as needed."
                          ) : (
                            "Enter the client's information to register them."
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-8">
                        {/* Administrative Information Section */}
                        <div className="space-y-6 mb-8">
                          <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                            <h3
                              className={`text-lg font-medium ${colors.textColor}`}
                            >
                              Administrative Information
                            </h3>
                            <p className={`text-sm ${colors.textColorMuted}`}>
                              Office and legal classification details
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Office */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="officeId"
                                className={colors.textColor}
                              >
                                Office <span className="text-red-500">*</span>
                              </Label>
                              <div className="relative">
                                <Controller
                                  control={
                                    externalForm
                                      ? externalForm.control
                                      : form.control
                                  }
                                  name="officeId"
                                  render={({ field }) => (
                                    <SearchableSelect
                                      options={officeOptions}
                                      value={field.value?.toString()}
                                      onValueChange={(value) => {
                                        field.onChange(value);
                                        handleFieldBlur("officeId", value);
                                      }}
                                      placeholder="Select office"
                                      className={getSelectErrorStyling(
                                        hasFieldError(
                                          form,
                                          "officeId",
                                          externalForm
                                        ),
                                        `border-${colors.borderColor} ${colors.inputBg}`
                                      )}
                                      onAddNew={() =>
                                        setShowAddOfficeDialog(true)
                                      }
                                      addNewLabel="Add new office"
                                      disabled={isFormDisabled}
                                    />
                                  )}
                                />
                                {lastSavedField === "officeId" &&
                                  isAutoSaving && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                      <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                    </div>
                                  )}
                              </div>
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Select the branch office managing this client
                              </p>
                              {(externalForm
                                ? externalForm.formState.errors.officeId
                                : form.formState.errors.officeId) && (
                                <p className="text-sm text-red-500">
                                  {
                                    (externalForm
                                      ? externalForm.formState.errors.officeId
                                      : form.formState.errors.officeId
                                    )?.message
                                  }
                                </p>
                              )}
                            </div>

                            {/* Legal Form */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="legalFormId"
                                className={colors.textColor}
                              >
                                Legal Form{" "}
                                <span className="text-red-500">*</span>
                              </Label>
                              <div className="relative">
                                <Controller
                                  control={
                                    externalForm
                                      ? externalForm.control
                                      : form.control
                                  }
                                  name="legalFormId"
                                  render={({ field }) => (
                                    <SearchableSelect
                                      options={legalFormOptions}
                                      value={field.value?.toString()}
                                      onValueChange={(value) => {
                                        field.onChange(value);
                                        handleFieldBlur("legalFormId", value);
                                      }}
                                      placeholder="Select legal form"
                                      className={getSelectErrorStyling(
                                        hasFieldError(
                                          form,
                                          "legalFormId",
                                          externalForm
                                        ),
                                        `border-${colors.borderColor} ${colors.inputBg}`
                                      )}
                                      onAddNew={() =>
                                        setShowAddLegalFormDialog(true)
                                      }
                                      addNewLabel="Add new legal form"
                                      disabled={isFormDisabled}
                                    />
                                  )}
                                />
                              </div>
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Legal classification of the client
                              </p>
                              {(externalForm
                                ? externalForm.formState.errors.legalFormId
                                : form.formState.errors.legalFormId) && (
                                <p className="text-sm text-red-500">
                                  {
                                    (externalForm
                                      ? externalForm.formState.errors
                                          .legalFormId
                                      : form.formState.errors.legalFormId
                                    )?.message
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Personal Information Section */}
                        <div className="space-y-6 mb-8">
                          <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                            <h3
                              className={`text-lg font-medium ${colors.textColor}`}
                            >
                              Personal Information
                            </h3>
                            <p className={`text-sm ${colors.textColorMuted}`}>
                              Client's personal identification details
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* First Name */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="firstname"
                                className={colors.textColor}
                              >
                                First Name{" "}
                                <span className="text-red-500">*</span>
                              </Label>
                              <div className="relative">
                                <Input
                                  id="firstname"
                                  name="firstname"
                                  placeholder="Enter first name"
                                  className={getInputErrorStyling(
                                    hasFieldError(
                                      form,
                                      "firstname",
                                      externalForm
                                    ),
                                    `h-10 w-full border-${colors.borderColor} ${colors.inputBg}`
                                  )}
                                  {...(externalForm
                                    ? externalForm.register("firstname", {
                                        onBlur: (e: {
                                          target: { value: any };
                                        }) =>
                                          handleFieldBlur(
                                            "firstname",
                                            e.target.value
                                          ),
                                      })
                                    : form.register("firstname", {
                                        onBlur: (e: {
                                          target: { value: any };
                                        }) =>
                                          handleFieldBlur(
                                            "firstname",
                                            e.target.value
                                          ),
                                      }))}
                                  disabled={isFormDisabled}
                                />
                                {lastSavedField === "firstname" &&
                                  isAutoSaving && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                      <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                    </div>
                                  )}
                              </div>
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Client's legal first name
                              </p>
                              {hasFieldError(
                                form,
                                "firstname",
                                externalForm
                              ) && (
                                <div className="flex items-center gap-1 text-sm text-red-600">
                                  <svg
                                    className="h-3 w-3 flex-shrink-0"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <span>
                                    {getFieldError(
                                      form,
                                      "firstname",
                                      externalForm
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Middle Name */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="middlename"
                                className={colors.textColor}
                              >
                                Middle Name
                              </Label>
                              <div className="relative">
                                <Input
                                  id="middlename"
                                  name="middlename"
                                  placeholder="Enter middle name"
                                  className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                                  {...(externalForm
                                    ? externalForm.register("middlename", {
                                        onBlur: (e: {
                                          target: { value: any };
                                        }) =>
                                          handleFieldBlur(
                                            "middlename",
                                            e.target.value
                                          ),
                                      })
                                    : form.register("middlename", {
                                        onBlur: (e: {
                                          target: { value: any };
                                        }) =>
                                          handleFieldBlur(
                                            "middlename",
                                            e.target.value
                                          ),
                                      }))}
                                  disabled={isFormDisabled}
                                />
                                {lastSavedField === "middlename" &&
                                  isAutoSaving && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                      <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                    </div>
                                  )}
                              </div>
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Client's middle name (if applicable)
                              </p>
                            </div>

                            {/* Last Name */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="lastname"
                                className={colors.textColor}
                              >
                                Last Name{" "}
                                <span className="text-red-500">*</span>
                              </Label>
                              <div className="relative">
                                <Input
                                  id="lastname"
                                  name="lastname"
                                  placeholder="Enter last name"
                                  className={getInputErrorStyling(
                                    hasFieldError(
                                      form,
                                      "lastname",
                                      externalForm
                                    ),
                                    `h-10 w-full border-${colors.borderColor} ${colors.inputBg}`
                                  )}
                                  {...(externalForm
                                    ? externalForm.register("lastname", {
                                        onBlur: (e: {
                                          target: { value: any };
                                        }) =>
                                          handleFieldBlur(
                                            "lastname",
                                            e.target.value
                                          ),
                                      })
                                    : form.register("lastname", {
                                        onBlur: (e: {
                                          target: { value: any };
                                        }) =>
                                          handleFieldBlur(
                                            "lastname",
                                            e.target.value
                                          ),
                                      }))}
                                  disabled={isFormDisabled}
                                />
                                {lastSavedField === "lastname" &&
                                  isAutoSaving && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                      <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                    </div>
                                  )}
                              </div>
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Client's legal last name/surname
                              </p>
                              {hasFieldError(
                                form,
                                "lastname",
                                externalForm
                              ) && (
                                <div className="flex items-center gap-1 text-sm text-red-600">
                                  <svg
                                    className="h-3 w-3 flex-shrink-0"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <span>
                                    {getFieldError(
                                      form,
                                      "lastname",
                                      externalForm
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Date of Birth */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="dateOfBirth"
                                className={colors.textColor}
                              >
                                Date of Birth{" "}
                                <span className="text-red-500">*</span>
                              </Label>

                              <Controller
                                control={form.control}
                                name="dateOfBirth"
                                render={({ field }) => (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          "h-10 w-full justify-start text-left font-normal",
                                          !field.value &&
                                            "text-muted-foreground",
                                          `border-${colors.borderColor} ${colors.inputBg}`
                                        )}
                                        disabled={isFormDisabled}
                                      >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {field.value ? (
                                          format(field.value, "PPP")
                                        ) : (
                                          <span>Pick a date</span>
                                        )}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      className="w-auto p-0"
                                      align="start"
                                    >
                                      <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={(date) => {
                                          field.onChange(date);
                                          if (date) {
                                            handleFieldBlur(
                                              "dateOfBirth",
                                              date
                                            );
                                          }
                                        }}
                                        disabled={(date) =>
                                          date > new Date() ||
                                          date < new Date("1900-01-01")
                                        }
                                        captionLayout="dropdown"
                                      />
                                    </PopoverContent>
                                  </Popover>
                                )}
                              />
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Client's date of birth for verification
                              </p>
                              {form.formState.errors.dateOfBirth && (
                                <p className="text-sm text-red-500">
                                  {form.formState.errors.dateOfBirth.message}
                                </p>
                              )}
                            </div>

                            {/* Gender */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="genderId"
                                className={colors.textColor}
                              >
                                Gender <span className="text-red-500">*</span>
                              </Label>

                              <Controller
                                control={form.control}
                                name="genderId"
                                render={({ field }) => (
                                  <SearchableSelect
                                    options={genderOptions}
                                    value={field.value?.toString()}
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      handleFieldBlur("genderId", value);
                                    }}
                                    placeholder="Select gender"
                                    className={`border-${colors.borderColor} ${colors.inputBg}`}
                                    onAddNew={() =>
                                      setShowAddGenderDialog(true)
                                    }
                                    addNewLabel="Add new gender"
                                    disabled={isFormDisabled}
                                  />
                                )}
                              />
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Client's gender for demographic purposes
                              </p>
                              {form.formState.errors.genderId && (
                                <p className="text-sm text-red-500">
                                  {form.formState.errors.genderId.message}
                                </p>
                              )}
                            </div>

                            {/* External ID (National ID) */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="externalId"
                                className={colors.textColor}
                              >
                                National ID{" "}
                                <span className="text-red-500">*</span>
                              </Label>
                              <div className="relative">
                                <Input
                                  id="externalId"
                                  placeholder="Enter national ID (e.g. 48-147220J12)"
                                  className={getInputErrorStyling(
                                    hasFieldError(
                                      form,
                                      "externalId",
                                      externalForm
                                    ),
                                    `h-10 w-full border-${colors.borderColor} ${colors.inputBg}`
                                  )}
                                  {...(externalForm
                                    ? externalForm.register("externalId", {
                                        onBlur: (e: {
                                          target: { value: any };
                                        }) =>
                                          handleFieldBlur(
                                            "externalId",
                                            e.target.value
                                          ),
                                        pattern: {
                                          value:
                                            /^[0-9]{2}-[0-9]{6}[A-Za-z][0-9]{2}$/,
                                          message:
                                            "National ID must be in format 48-147220J12",
                                        },
                                      })
                                    : form.register("externalId", {
                                        onBlur: (e: {
                                          target: { value: any };
                                        }) =>
                                          handleFieldBlur(
                                            "externalId",
                                            e.target.value
                                          ),
                                        pattern: {
                                          value:
                                            /^[0-9]{2}-[0-9]{6}[A-Za-z][0-9]{2}$/,
                                          message:
                                            "National ID must be in format 48-147220J12",
                                        },
                                      }))}
                                  disabled={isFormDisabled}
                                />
                                {lastSavedField === "externalId" &&
                                  isAutoSaving && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                      <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                    </div>
                                  )}
                              </div>
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Government-issued identification number
                              </p>
                              {hasFieldError(
                                form,
                                "externalId",
                                externalForm
                              ) && (
                                <div className="flex items-center gap-1 text-sm text-red-600">
                                  <svg
                                    className="h-3 w-3 flex-shrink-0"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <span>
                                    {getFieldError(
                                      form,
                                      "externalId",
                                      externalForm
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Contact Information Section */}
                        <div className="space-y-6 mb-8">
                          <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                            <h3
                              className={`text-lg font-medium ${colors.textColor}`}
                            >
                              Contact Information
                            </h3>
                            <p className={`text-sm ${colors.textColorMuted}`}>
                              Client's contact details for communication
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Mobile Number */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="mobileNo"
                                className={colors.textColor}
                              >
                                Mobile Number{" "}
                                <span className="text-red-500">*</span>
                              </Label>
                              <div className="flex space-x-2">
                                <Controller
                                  control={form.control}
                                  name="countryCode"
                                  render={({ field }) => (
                                    <Select
                                      onValueChange={field.onChange}
                                      defaultValue={field.value}
                                      disabled={isFormDisabled}
                                    >
                                      <SelectTrigger
                                        className={`h-10 w-24 sm:w-28 lg:w-32 border-${colors.borderColor} ${colors.inputBg} flex-shrink-0`}
                                      >
                                        <SelectValue placeholder="+263" />
                                      </SelectTrigger>
                                      <SelectContent
                                        className={`border-${colors.borderColor} ${colors.dropdownBg} ${colors.textColor}`}
                                      >
                                        <SelectItem value="+263">
                                          🇿🇼 +263
                                        </SelectItem>
                                        <SelectItem value="+27">
                                          🇿🇦 +27
                                        </SelectItem>
                                        <SelectItem value="+260">
                                          🇿🇲 +260
                                        </SelectItem>
                                        <SelectItem value="+258">
                                          🇲🇿 +258
                                        </SelectItem>
                                        <SelectItem value="+265">
                                          🇲🇼 +265
                                        </SelectItem>
                                        <SelectItem value="+266">
                                          🇱🇸 +266
                                        </SelectItem>
                                        <SelectItem value="+267">
                                          🇧🇼 +267
                                        </SelectItem>
                                        <SelectItem value="+268">
                                          🇸🇿 +268
                                        </SelectItem>
                                        <SelectItem value="+236">
                                          🇨🇫 +236
                                        </SelectItem>
                                        <SelectItem value="+257">
                                          🇧🇮 +257
                                        </SelectItem>
                                        <SelectItem value="+253">
                                          🇩🇯 +253
                                        </SelectItem>
                                        <SelectItem value="+291">
                                          🇪🇷 +291
                                        </SelectItem>
                                        <SelectItem value="+251">
                                          🇪🇹 +251
                                        </SelectItem>
                                        <SelectItem value="+254">
                                          🇰🇪 +254
                                        </SelectItem>
                                        <SelectItem value="+250">
                                          🇷🇼 +250
                                        </SelectItem>
                                        <SelectItem value="+248">
                                          🇸🇨 +248
                                        </SelectItem>
                                        <SelectItem value="+255">
                                          🇹🇿 +255
                                        </SelectItem>
                                        <SelectItem value="+256">
                                          🇺🇬 +256
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                                <div className="relative">
                                  <Input
                                    id="mobileNo"
                                    placeholder="Enter mobile number"
                                    className={getInputErrorStyling(
                                      hasFieldError(
                                        form,
                                        "mobileNo",
                                        externalForm
                                      ),
                                      `h-10 flex-1 border-${colors.borderColor} ${colors.inputBg}`
                                    )}
                                    {...(externalForm
                                      ? externalForm.register("mobileNo", {
                                          onBlur: (e: {
                                            target: { value: any };
                                          }) =>
                                            handleFieldBlur(
                                              "mobileNo",
                                              e.target.value
                                            ),
                                        })
                                      : form.register("mobileNo", {
                                          onBlur: (e: {
                                            target: { value: any };
                                          }) =>
                                            handleFieldBlur(
                                              "mobileNo",
                                              e.target.value
                                            ),
                                        }))}
                                    disabled={isFormDisabled}
                                  />
                                  {lastSavedField === "mobileNo" &&
                                    isAutoSaving && (
                                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                        <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                      </div>
                                    )}
                                </div>
                              </div>
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Primary contact number for notifications
                              </p>
                              {hasFieldError(
                                form,
                                "mobileNo",
                                externalForm
                              ) && (
                                <div className="flex items-center gap-1 text-sm text-red-600">
                                  <svg
                                    className="h-3 w-3 flex-shrink-0"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <span>
                                    {getFieldError(
                                      form,
                                      "mobileNo",
                                      externalForm
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Email Address */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="emailAddress"
                                className={colors.textColor}
                              >
                                Email Address{" "}
                                <span className="text-red-500">*</span>
                              </Label>
                              <div className="relative">
                                <Input
                                  id="emailAddress"
                                  type="email"
                                  placeholder="Enter email address"
                                  className={getInputErrorStyling(
                                    hasFieldError(
                                      form,
                                      "emailAddress",
                                      externalForm
                                    ),
                                    `h-10 w-full border-${colors.borderColor} ${colors.inputBg}`
                                  )}
                                  {...(externalForm
                                    ? externalForm.register("emailAddress", {
                                        onBlur: (e: {
                                          target: { value: any };
                                        }) =>
                                          handleFieldBlur(
                                            "emailAddress",
                                            e.target.value
                                          ),
                                      })
                                    : form.register("emailAddress", {
                                        onBlur: (e: {
                                          target: { value: any };
                                        }) =>
                                          handleFieldBlur(
                                            "emailAddress",
                                            e.target.value
                                          ),
                                      }))}
                                  disabled={isFormDisabled}
                                />
                                {lastSavedField === "emailAddress" &&
                                  isAutoSaving && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                      <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                    </div>
                                  )}
                              </div>
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Email for statements and notifications
                              </p>
                              {hasFieldError(
                                form,
                                "emailAddress",
                                externalForm
                              ) && (
                                <div className="flex items-center gap-1 text-sm text-red-600">
                                  <svg
                                    className="h-3 w-3 flex-shrink-0"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <span>
                                    {getFieldError(
                                      form,
                                      "emailAddress",
                                      externalForm
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Financial Information Section */}
                        <div className="space-y-6 mb-8">
                          <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                            <h3
                              className={`text-lg font-medium ${colors.textColor}`}
                            >
                              Financial Information
                            </h3>
                            <p className={`text-sm ${colors.textColorMuted}`}>
                              Client's financial profile for loan assessment
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Monthly Income Range */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="monthlyIncomeRange"
                                className={colors.textColor}
                              >
                                Monthly Income Range
                              </Label>
                              <Controller
                                control={form.control}
                                name="monthlyIncomeRange"
                                render={({ field }) => (
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      handleFieldBlur(
                                        "monthlyIncomeRange",
                                        value
                                      );
                                    }}
                                    defaultValue={field.value}
                                    disabled={isFormDisabled}
                                  >
                                    <SelectTrigger
                                      className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                                    >
                                      <SelectValue placeholder="Select income range" />
                                    </SelectTrigger>
                                    <SelectContent
                                      className={`border-${colors.borderColor} ${colors.dropdownBg} ${colors.textColor}`}
                                    >
                                      <SelectItem value="under_500">
                                        Under $500
                                      </SelectItem>
                                      <SelectItem value="500_1000">
                                        $500 - $1,000
                                      </SelectItem>
                                      <SelectItem value="1000_2500">
                                        $1,000 - $2,500
                                      </SelectItem>
                                      <SelectItem value="2500_5000">
                                        $2,500 - $5,000
                                      </SelectItem>
                                      <SelectItem value="5000_10000">
                                        $5,000 - $10,000
                                      </SelectItem>
                                      <SelectItem value="over_10000">
                                        Over $10,000
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Approximate monthly income range
                              </p>
                            </div>

                            {/* Employment Status */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="employmentStatus"
                                className={colors.textColor}
                              >
                                Employment Status
                              </Label>
                              <Controller
                                control={form.control}
                                name="employmentStatus"
                                render={({ field }) => (
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      handleFieldBlur(
                                        "employmentStatus",
                                        value
                                      );
                                    }}
                                    defaultValue={field.value}
                                    disabled={isFormDisabled}
                                  >
                                    <SelectTrigger
                                      className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                                    >
                                      <SelectValue placeholder="Select employment status" />
                                    </SelectTrigger>
                                    <SelectContent
                                      className={`border-${colors.borderColor} ${colors.dropdownBg} ${colors.textColor}`}
                                    >
                                      <SelectItem value="EMPLOYED">
                                        Employed
                                      </SelectItem>
                                      <SelectItem value="SELF_EMPLOYED">
                                        Self-Employed
                                      </SelectItem>
                                      <SelectItem value="UNEMPLOYED">
                                        Unemployed
                                      </SelectItem>
                                      <SelectItem value="RETIRED">
                                        Retired
                                      </SelectItem>
                                      <SelectItem value="STUDENT">
                                        Student
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Current employment situation
                              </p>
                            </div>

                            {/* Employer Name */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="employerName"
                                className={colors.textColor}
                              >
                                Employer Name
                              </Label>
                              <div className="relative">
                                <Input
                                  id="employerName"
                                  placeholder="Enter employer name"
                                  className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                                  {...form.register("employerName", {
                                    onBlur: (e: { target: { value: any } }) =>
                                      handleFieldBlur(
                                        "employerName",
                                        e.target.value
                                      ),
                                  })}
                                  disabled={isFormDisabled}
                                />
                                {lastSavedField === "employerName" &&
                                  isAutoSaving && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                      <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                    </div>
                                  )}
                              </div>
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Name of current employer (if employed)
                              </p>
                            </div>

                            {/* Years at Current Job */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="yearsAtCurrentJob"
                                className={colors.textColor}
                              >
                                Years at Current Job
                              </Label>
                              <Controller
                                control={form.control}
                                name="yearsAtCurrentJob"
                                render={({ field }) => (
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      handleFieldBlur(
                                        "yearsAtCurrentJob",
                                        value
                                      );
                                    }}
                                    defaultValue={field.value}
                                    disabled={isFormDisabled}
                                  >
                                    <SelectTrigger
                                      className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                                    >
                                      <SelectValue placeholder="Select years at job" />
                                    </SelectTrigger>
                                    <SelectContent
                                      className={`border-${colors.borderColor} ${colors.dropdownBg} ${colors.textColor}`}
                                    >
                                      <SelectItem value="less_than_1">
                                        Less than 1 year
                                      </SelectItem>
                                      <SelectItem value="1_2">
                                        1-2 years
                                      </SelectItem>
                                      <SelectItem value="2_5">
                                        2-5 years
                                      </SelectItem>
                                      <SelectItem value="5_10">
                                        5-10 years
                                      </SelectItem>
                                      <SelectItem value="over_10">
                                        Over 10 years
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Employment stability indicator
                              </p>
                            </div>

                            {/* Existing Loans */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="hasExistingLoans"
                                className={colors.textColor}
                              >
                                Existing Loans
                              </Label>
                              <Card
                                className={`border-${colors.borderColor} ${colors.cardBg} flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 space-y-2 sm:space-y-0`}
                              >
                                <div className="flex items-center space-x-2">
                                  <Controller
                                    control={form.control}
                                    name="hasExistingLoans"
                                    render={({ field }) => (
                                      <Checkbox
                                        id="hasExistingLoans"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={isFormDisabled}
                                      />
                                    )}
                                  />
                                  <Label
                                    htmlFor="hasExistingLoans"
                                    className={colors.textColor}
                                  >
                                    Has existing loans
                                  </Label>
                                </div>
                                <p
                                  className={`text-xs ${colors.textColorMuted}`}
                                >
                                  Check if client has other loans
                                </p>
                              </Card>
                            </div>

                            {/* Monthly Debt Payments */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="monthlyDebtPayments"
                                className={colors.textColor}
                              >
                                Monthly Debt Payments
                              </Label>
                              <div className="relative">
                                <Input
                                  id="monthlyDebtPayments"
                                  type="number"
                                  placeholder="Enter monthly debt payments"
                                  className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                                  {...form.register("monthlyDebtPayments", {
                                    onBlur: (e: { target: { value: any } }) =>
                                      handleFieldBlur(
                                        "monthlyDebtPayments",
                                        parseFloat(e.target.value) || 0
                                      ),
                                  })}
                                  disabled={isFormDisabled}
                                />
                                {lastSavedField === "monthlyDebtPayments" &&
                                  isAutoSaving && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                      <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                    </div>
                                  )}
                              </div>
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Approximate monthly debt obligations
                              </p>
                            </div>

                            {/* Property Ownership */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="propertyOwnership"
                                className={colors.textColor}
                              >
                                Property Ownership
                              </Label>
                              <Controller
                                control={form.control}
                                name="propertyOwnership"
                                render={({ field }) => (
                                  <Select
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      handleFieldBlur(
                                        "propertyOwnership",
                                        value
                                      );
                                    }}
                                    defaultValue={field.value}
                                    disabled={isFormDisabled}
                                  >
                                    <SelectTrigger
                                      className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                                    >
                                      <SelectValue placeholder="Select property status" />
                                    </SelectTrigger>
                                    <SelectContent
                                      className={`border-${colors.borderColor} ${colors.dropdownBg} ${colors.textColor}`}
                                    >
                                      <SelectItem value="OWN">
                                        Own Property
                                      </SelectItem>
                                      <SelectItem value="RENT">Rent</SelectItem>
                                      <SelectItem value="FAMILY">
                                        Live with Family
                                      </SelectItem>
                                      <SelectItem value="OTHER">
                                        Other
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                )}
                              />
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Housing situation
                              </p>
                            </div>

                            {/* Business Ownership */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="businessOwnership"
                                className={colors.textColor}
                              >
                                Business Ownership
                              </Label>
                              <Card
                                className={`border-${colors.borderColor} ${colors.cardBg} flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 space-y-2 sm:space-y-0`}
                              >
                                <div className="flex items-center space-x-2">
                                  <Controller
                                    control={form.control}
                                    name="businessOwnership"
                                    render={({ field }) => (
                                      <Checkbox
                                        id="businessOwnership"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={isFormDisabled}
                                      />
                                    )}
                                  />
                                  <Label
                                    htmlFor="businessOwnership"
                                    className={colors.textColor}
                                  >
                                    Owns a business
                                  </Label>
                                </div>
                                <p
                                  className={`text-xs ${colors.textColorMuted}`}
                                >
                                  Check if client owns a business
                                </p>
                              </Card>
                            </div>
                          </div>

                          {/* Business Type - Only shown when businessOwnership is true */}
                          {form.watch("businessOwnership") && (
                            <div className="space-y-3">
                              <Label
                                htmlFor="businessType"
                                className={colors.textColor}
                              >
                                Business Type
                              </Label>
                              <div className="relative">
                                <Input
                                  id="businessType"
                                  placeholder="Enter type of business"
                                  className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                                  {...form.register("businessType", {
                                    onBlur: (e: { target: { value: any } }) =>
                                      handleFieldBlur(
                                        "businessType",
                                        e.target.value
                                      ),
                                  })}
                                  disabled={isFormDisabled}
                                />
                                {lastSavedField === "businessType" &&
                                  isAutoSaving && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                      <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                    </div>
                                  )}
                              </div>
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Type or nature of business owned
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Classification Information Section */}
                        <div className="space-y-6 mb-8">
                          <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                            <h3
                              className={`text-lg font-medium ${colors.textColor}`}
                            >
                              Client Classification
                            </h3>
                            <p className={`text-sm ${colors.textColorMuted}`}>
                              Client categorization for service offerings
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Client Type */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="clientTypeId"
                                className={colors.textColor}
                              >
                                Client Type{" "}
                                <span className="text-red-500">*</span>
                              </Label>

                              <Controller
                                control={form.control}
                                name="clientTypeId"
                                render={({ field }) => (
                                  <SearchableSelect
                                    options={clientTypeOptions}
                                    value={field.value?.toString()}
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      handleFieldBlur("clientTypeId", value);
                                    }}
                                    placeholder="Select client type"
                                    className={`border-${colors.borderColor} ${colors.inputBg}`}
                                    onAddNew={() =>
                                      setShowAddClientTypeDialog(true)
                                    }
                                    addNewLabel="Add new client type"
                                    disabled={isFormDisabled}
                                  />
                                )}
                              />
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Type of client for service eligibility
                              </p>
                              {form.formState.errors.clientTypeId && (
                                <p className="text-sm text-red-500">
                                  {form.formState.errors.clientTypeId.message}
                                </p>
                              )}
                            </div>

                            {/* Client Classification */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="clientClassificationId"
                                className={colors.textColor}
                              >
                                Client Classification{" "}
                                <span className="text-red-500">*</span>
                              </Label>

                              <Controller
                                control={form.control}
                                name="clientClassificationId"
                                render={({ field }) => (
                                  <SearchableSelect
                                    options={clientClassificationOptions}
                                    value={field.value?.toString()}
                                    onValueChange={(value) => {
                                      field.onChange(value);
                                      handleFieldBlur(
                                        "clientClassificationId",
                                        value
                                      );
                                    }}
                                    placeholder="Select client classification"
                                    className={`border-${colors.borderColor} ${colors.inputBg}`}
                                    onAddNew={() =>
                                      setShowAddClientClassificationDialog(true)
                                    }
                                    addNewLabel="Add new classification"
                                    disabled={isFormDisabled}
                                  />
                                )}
                              />
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Classification for risk assessment
                              </p>
                              {form.formState.errors.clientClassificationId && (
                                <p className="text-sm text-red-500">
                                  {
                                    form.formState.errors.clientClassificationId
                                      .message
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Additional Information Section */}
                        <div className="space-y-6 mb-8">
                          <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                            <h3
                              className={`text-lg font-medium ${colors.textColor}`}
                            >
                              Additional Information
                            </h3>
                            <p className={`text-sm ${colors.textColorMuted}`}>
                              Submission details and special status
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Submitted On Date */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="submittedOnDate"
                                className={colors.textColor}
                              >
                                Submitted On{" "}
                                <span className="text-red-500">*</span>
                              </Label>

                              <Controller
                                control={form.control}
                                name="submittedOnDate"
                                render={({ field }) => (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className={cn(
                                          "h-10 w-full justify-start text-left font-normal",
                                          !field.value &&
                                            "text-muted-foreground",
                                          `border-${colors.borderColor} ${colors.inputBg}`
                                        )}
                                        disabled={isFormDisabled}
                                      >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {field.value ? (
                                          format(field.value, "PPP")
                                        ) : (
                                          <span>Pick a date</span>
                                        )}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                      className="w-auto p-0"
                                      align="start"
                                    >
                                      <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        disabled={(date) => date < new Date()}
                                        captionLayout="dropdown"
                                        initialFocus
                                      />
                                    </PopoverContent>
                                  </Popover>
                                )}
                              />
                              <p className={`text-xs ${colors.textColorMuted}`}>
                                Date when application was submitted
                              </p>
                              {form.formState.errors.submittedOnDate && (
                                <p className="text-sm text-red-500">
                                  {
                                    form.formState.errors.submittedOnDate
                                      .message
                                  }
                                </p>
                              )}
                            </div>

                            {/* Is Staff */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="isStaff"
                                className={colors.textColor}
                              >
                                Staff Status
                              </Label>
                              <Card
                                className={`border-${colors.borderColor} ${colors.cardBg} flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 space-y-2 sm:space-y-0`}
                              >
                                <div className="flex items-center space-x-2">
                                  <Controller
                                    control={form.control}
                                    name="isStaff"
                                    render={({ field }) => (
                                      <Checkbox
                                        id="isStaff"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={isFormDisabled}
                                      />
                                    )}
                                  />
                                  <Label
                                    htmlFor="isStaff"
                                    className={colors.textColor}
                                  >
                                    Is staff member
                                  </Label>
                                </div>
                                <p
                                  className={`text-xs ${colors.textColorMuted}`}
                                >
                                  Indicate if client is a staff member
                                </p>
                              </Card>
                            </div>
                          </div>
                        </div>

                        {/* Next of Kin (Family Members) Section */}
                        <div className="space-y-6 mb-8">
                          <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6 flex justify-between items-center">
                            <div>
                              <h3
                                className={`text-lg font-medium ${colors.textColor}`}
                              >
                                Next of Kin
                              </h3>
                              <p className={`text-sm ${colors.textColorMuted}`}>
                                Add next of kin details
                              </p>
                            </div>

                            <Button
                              type="button"
                              onClick={() => setShowFamilyMemberDialog(true)}
                              className="bg-blue-500 hover:bg-blue-600"
                              disabled={isFormDisabled}
                            >
                              Add Next of Kin
                            </Button>
                          </div>

                          {familyMembers.length === 0 ? (
                            <div
                              className={`text-center py-8 ${colors.textColorMuted}`}
                            >
                              No next of kin added yet. Click the button above
                              to add one.
                            </div>
                          ) : (
                            <div className="space-y-6">
                              {familyMembers.map((member) => (
                                <Card
                                  key={member.id}
                                  className={`border-${colors.borderColor} ${colors.cardBg}`}
                                >
                                  <CardContent className="p-4">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <h4
                                          className={`font-medium ${colors.textColor}`}
                                        >
                                          {member.firstname}{" "}
                                          {member.middlename
                                            ? `${member.middlename} `
                                            : ""}
                                          {member.lastname}
                                        </h4>
                                        <p
                                          className={`text-sm ${colors.textColorMuted}`}
                                        >
                                          Relationship: {member.relationship}
                                        </p>
                                        {member.mobileNo && (
                                          <p
                                            className={`text-sm ${colors.textColorMuted}`}
                                          >
                                            Phone: {member.mobileNo}
                                          </p>
                                        )}
                                        {member.emailAddress && (
                                          <p
                                            className={`text-sm ${colors.textColorMuted}`}
                                          >
                                            Email: {member.emailAddress}
                                          </p>
                                        )}
                                        {member.isDependent && (
                                          <Badge className="mt-2 bg-blue-500">
                                            Dependent
                                          </Badge>
                                        )}
                                      </div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          handleRemoveFamilyMember(member.id)
                                        }
                                        className="text-red-500 hover:text-red-700 hover:bg-red-100"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Account Settings Section */}
                        <div className="space-y-6 mb-8">
                          <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                            <h3
                              className={`text-lg font-medium ${colors.textColor}`}
                            >
                              Account Settings
                            </h3>
                            <p className={`text-sm ${colors.textColorMuted}`}>
                              Configure account activation settings
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Active */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="active"
                                className={colors.textColor}
                              >
                                Account Status
                              </Label>
                              <Card
                                className={`border-${colors.borderColor} ${colors.cardBg} flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 space-y-2 sm:space-y-0`}
                              >
                                <div className="flex items-center space-x-2">
                                  <Controller
                                    control={form.control}
                                    name="active"
                                    render={({ field }) => (
                                      <Checkbox
                                        id="active"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={isFormDisabled}
                                      />
                                    )}
                                  />
                                  <Label
                                    htmlFor="active"
                                    className={colors.textColor}
                                  >
                                    Active account
                                  </Label>
                                </div>
                                <p
                                  className={`text-xs ${colors.textColorMuted}`}
                                >
                                  Set whether the account is active upon
                                  creation
                                </p>
                              </Card>
                            </div>

                            {/* Open Savings Account */}
                            <div className="space-y-3">
                              <Label
                                htmlFor="openSavingsAccount"
                                className={colors.textColor}
                              >
                                Savings Account
                              </Label>
                              <Card
                                className={`border-${colors.borderColor} ${colors.cardBg} flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 space-y-2 sm:space-y-0`}
                              >
                                <div className="flex items-center space-x-2">
                                  <Controller
                                    control={form.control}
                                    name="openSavingsAccount"
                                    render={({ field }) => (
                                      <Checkbox
                                        id="openSavingsAccount"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={isFormDisabled}
                                      />
                                    )}
                                  />
                                  <Label
                                    htmlFor="openSavingsAccount"
                                    className={colors.textColor}
                                  >
                                    Open savings account
                                  </Label>
                                </div>
                                <p
                                  className={`text-xs ${colors.textColorMuted}`}
                                >
                                  Create a savings account for this client
                                </p>
                              </Card>
                            </div>
                          </div>

                          {/* Conditional Fields */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            {/* Activation Date - Only shown when active is true */}
                            {form.watch("active") && (
                              <div className="space-y-3">
                                <Label
                                  htmlFor="activationDate"
                                  className={colors.textColor}
                                >
                                  Activation Date{" "}
                                  <span className="text-red-500">*</span>
                                </Label>

                                <Controller
                                  control={form.control}
                                  name="activationDate"
                                  render={({ field }) => (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="outline"
                                          className={cn(
                                            "h-10 w-full justify-start text-left font-normal",
                                            !field.value &&
                                              "text-muted-foreground",
                                            `border-${colors.borderColor} ${colors.inputBg}`
                                          )}
                                          disabled={isFormDisabled}
                                        >
                                          <CalendarIcon className="mr-2 h-4 w-4" />
                                          {field.value ? (
                                            format(field.value, "PPP")
                                          ) : (
                                            <span>Pick a date</span>
                                          )}
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        className="w-auto p-0"
                                        align="start"
                                      >
                                        <Calendar
                                          mode="single"
                                          selected={field.value}
                                          onSelect={field.onChange}
                                          disabled={(date) => date < new Date()}
                                          captionLayout="dropdown"
                                          initialFocus
                                        />
                                      </PopoverContent>
                                    </Popover>
                                  )}
                                />
                                <p
                                  className={`text-xs ${colors.textColorMuted}`}
                                >
                                  Date when the account becomes active
                                </p>
                                {form.formState.errors.activationDate && (
                                  <p className="text-sm text-red-500">
                                    {
                                      form.formState.errors.activationDate
                                        .message
                                    }
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Savings Product - Only shown when openSavingsAccount is true */}
                            {form.watch("openSavingsAccount") && (
                              <div className="space-y-3">
                                <Label
                                  htmlFor="savingsProductId"
                                  className={colors.textColor}
                                >
                                  Savings Product{" "}
                                  <span className="text-red-500">*</span>
                                </Label>

                                <Controller
                                  control={form.control}
                                  name="savingsProductId"
                                  render={({ field }) => (
                                    <SearchableSelect
                                      options={savingsProductOptions}
                                      value={field.value?.toString()}
                                      onValueChange={(value) => {
                                        field.onChange(value);
                                        handleFieldBlur(
                                          "savingsProductId",
                                          value
                                        );
                                      }}
                                      placeholder="Select savings product"
                                      className={`border-${colors.borderColor} ${colors.inputBg}`}
                                      onAddNew={() =>
                                        setShowAddSavingsProductDialog(true)
                                      }
                                      addNewLabel="Add new savings product"
                                      disabled={isFormDisabled}
                                    />
                                  )}
                                />
                                <p
                                  className={`text-xs ${colors.textColorMuted}`}
                                >
                                  Type of savings account to open
                                </p>
                                {form.formState.errors.savingsProductId && (
                                  <p className="text-sm text-red-500">
                                    {
                                      form.formState.errors.savingsProductId
                                        .message
                                    }
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => router.push("/leads")}
                          className={`border-${colors.borderColor} hover:bg-${colors.hoverBgColor}`}
                        >
                          Cancel
                        </Button>

                        <Button
                          type={externalForm ? "button" : "submit"}
                          className={`transition-all duration-300 ease-in-out ${
                            isSubmitting
                              ? "bg-blue-600 cursor-not-allowed opacity-75"
                              : clientLookupStatus === "found"
                              ? "bg-green-600 hover:bg-green-700"
                              : "bg-blue-500 hover:bg-blue-600"
                          }`}
                          disabled={isSubmitting || isFormDisabled}
                          onClick={
                            externalForm && onFormSubmit
                              ? () => onFormSubmit(form.getValues())
                              : undefined
                          }
                        >
                          <div className="flex items-center justify-center transition-all duration-300">
                            {isSubmitting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin transition-opacity duration-300" />
                                <span className="transition-opacity duration-300">
                                  {clientLookupStatus === "found"
                                    ? "Updating Client..."
                                    : "Creating Client..."}
                                </span>
                              </>
                            ) : (
                              <>
                                {clientLookupStatus === "found" ? (
                                  <>
                                    <svg
                                      className="mr-2 h-4 w-4 transition-transform duration-300"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                      />
                                    </svg>
                                    <span className="transition-all duration-300">
                                      Update Client
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <svg
                                      className="mr-2 h-4 w-4 transition-transform duration-300"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                      />
                                    </svg>
                                    <span className="transition-all duration-300">
                                      Create Client
                                    </span>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </Button>
                      </CardFooter>
                    </Card>
                  )}
                </FormWrapper>
              );
            })()}
          </>
        )}

        {/* Add Office Dialog */}
        {showAddOfficeDialog && (
          <AddOfficeDialog
            {...{
              setIsAddingNew,
              isAddingNew,
              setShowAddOfficeDialog,
              setOffices,
              offices,
              form,
            }}
          />
        )}
        {/* TODO package out thes components */}
        {/* Add Legal Form Dialog */}
        {showAddLegalFormDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card
              className={`w-full max-w-4xl border-${colors.borderColor} ${colors.cardBg}`}
            >
              <CardHeader>
                <CardTitle className={colors.textColor}>
                  Add New Legal Form
                </CardTitle>
                <CardDescription className={colors.textColorMuted}>
                  Enter the details of the new legal form.
                </CardDescription>
              </CardHeader>
              <form onSubmit={legalFormForm.handleSubmit(handleAddLegalForm)}>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="name" className={colors.textColor}>
                        Legal Form Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        placeholder="Enter legal form name"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...legalFormForm.register("name")}
                      />
                      {legalFormForm.formState.errors.name && (
                        <p className="text-sm text-red-500">
                          {legalFormForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="description" className={colors.textColor}>
                        Description
                      </Label>
                      <Input
                        id="description"
                        placeholder="Enter description"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...legalFormForm.register("description")}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddLegalFormDialog(false)}
                    className={`border-${colors.borderColor} hover:bg-${colors.hoverBgColor}`}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600"
                    disabled={isAddingNew}
                  >
                    {isAddingNew ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Legal Form"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        )}

        {/* Add Gender Dialog */}
        {showAddGenderDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card
              className={`w-full max-w-md border-${colors.borderColor} ${colors.cardBg}`}
            >
              <CardHeader>
                <CardTitle className={colors.textColor}>
                  Add New Gender
                </CardTitle>
                <CardDescription className={colors.textColorMuted}>
                  Enter the details of the new gender.
                </CardDescription>
              </CardHeader>
              <form onSubmit={genderForm.handleSubmit(handleAddGender)}>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="name" className={colors.textColor}>
                        Gender Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        placeholder="Enter gender name"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...genderForm.register("name")}
                      />
                      {genderForm.formState.errors.name && (
                        <p className="text-sm text-red-500">
                          {genderForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddGenderDialog(false)}
                    className={`border-${colors.borderColor} hover:bg-${colors.hoverBgColor}`}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600"
                    disabled={isAddingNew}
                  >
                    {isAddingNew ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Gender"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        )}

        {/* Add Client Type Dialog */}
        {showAddClientTypeDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card
              className={`w-full max-w-md border-${colors.borderColor} ${colors.cardBg}`}
            >
              <CardHeader>
                <CardTitle className={colors.textColor}>
                  Add New Client Type
                </CardTitle>
                <CardDescription className={colors.textColorMuted}>
                  Enter the details of the new client type.
                </CardDescription>
              </CardHeader>
              <form onSubmit={clientTypeForm.handleSubmit(handleAddClientType)}>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="name" className={colors.textColor}>
                        Client Type Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        placeholder="Enter client type name"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...clientTypeForm.register("name")}
                      />
                      {clientTypeForm.formState.errors.name && (
                        <p className="text-sm text-red-500">
                          {clientTypeForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="description" className={colors.textColor}>
                        Description
                      </Label>
                      <Input
                        id="description"
                        placeholder="Enter description"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...clientTypeForm.register("description")}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddClientTypeDialog(false)}
                    className={`border-${colors.borderColor} hover:bg-${colors.hoverBgColor}`}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600"
                    disabled={isAddingNew}
                  >
                    {isAddingNew ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Client Type"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        )}

        {/* Add Client Classification Dialog */}
        {showAddClientClassificationDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card
              className={`w-full max-w-md border-${colors.borderColor} ${colors.cardBg}`}
            >
              <CardHeader>
                <CardTitle className={colors.textColor}>
                  Add New Client Classification
                </CardTitle>
                <CardDescription className={colors.textColorMuted}>
                  Enter the details of the new client classification.
                </CardDescription>
              </CardHeader>
              <form
                onSubmit={clientClassificationForm.handleSubmit(
                  handleAddClientClassification
                )}
              >
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="name" className={colors.textColor}>
                        Classification Name{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        placeholder="Enter classification name"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...clientClassificationForm.register("name")}
                      />
                      {clientClassificationForm.formState.errors.name && (
                        <p className="text-sm text-red-500">
                          {
                            clientClassificationForm.formState.errors.name
                              .message
                          }
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="description" className={colors.textColor}>
                        Description
                      </Label>
                      <Input
                        id="description"
                        placeholder="Enter description"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...clientClassificationForm.register("description")}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddClientClassificationDialog(false)}
                    className={`border-${colors.borderColor} hover:bg-${colors.hoverBgColor}`}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600"
                    disabled={isAddingNew}
                  >
                    {isAddingNew ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Classification"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        )}

        {/* Add Savings Product Dialog */}
        {showAddSavingsProductDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card
              className={`w-full max-w-md border-${colors.borderColor} ${colors.cardBg}`}
            >
              <CardHeader>
                <CardTitle className={colors.textColor}>
                  Add New Savings Product
                </CardTitle>
                <CardDescription className={colors.textColorMuted}>
                  Enter the details of the new savings product.
                </CardDescription>
              </CardHeader>
              <form
                onSubmit={savingsProductForm.handleSubmit(
                  handleAddSavingsProduct
                )}
              >
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="name" className={colors.textColor}>
                        Product Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        placeholder="Enter product name"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...savingsProductForm.register("name")}
                      />
                      {savingsProductForm.formState.errors.name && (
                        <p className="text-sm text-red-500">
                          {savingsProductForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="code" className={colors.textColor}>
                        Product Code <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="code"
                        placeholder="Enter product code"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...savingsProductForm.register("code")}
                      />
                      {savingsProductForm.formState.errors.code && (
                        <p className="text-sm text-red-500">
                          {savingsProductForm.formState.errors.code.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label
                        htmlFor="interestRate"
                        className={colors.textColor}
                      >
                        Interest Rate (%){" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="interestRate"
                        placeholder="Enter interest rate"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...savingsProductForm.register("interestRate")}
                      />
                      {savingsProductForm.formState.errors.interestRate && (
                        <p className="text-sm text-red-500">
                          {
                            savingsProductForm.formState.errors.interestRate
                              .message
                          }
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="description" className={colors.textColor}>
                        Description
                      </Label>
                      <Input
                        id="description"
                        placeholder="Enter description"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...savingsProductForm.register("description")}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddSavingsProductDialog(false)}
                    className={`border-${colors.borderColor} hover:bg-${colors.hoverBgColor}`}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600"
                    disabled={isAddingNew}
                  >
                    {isAddingNew ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Savings Product"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        )}

        {/* Close Lead Dialog */}
        {showCloseDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card
              className={`w-full max-w-md border-${colors.borderColor} ${colors.cardBg}`}
            >
              <CardHeader>
                <CardTitle className={colors.textColor}>Close Lead</CardTitle>
                <CardDescription className={colors.textColorMuted}>
                  Please provide a reason for closing this lead.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="closeReason" className={colors.textColor}>
                      Reason <span className="text-red-500">*</span>
                    </Label>
                    <textarea
                      id="closeReason"
                      value={closeReason}
                      onChange={(e) => setCloseReason(e.target.value)}
                      className={`w-full p-2 border rounded-md ${colors.inputBg} ${colors.textColor} border-${colors.borderColor}`}
                      rows={4}
                      placeholder="Enter reason for closing this lead"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCloseDialog(false)}
                  className={`border-${colors.borderColor} hover:bg-${colors.hoverBgColor}`}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleCloseLead}
                  disabled={isClosing || !closeReason}
                  className="bg-red-500 hover:bg-red-600"
                >
                  {isClosing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Closing...
                    </>
                  ) : (
                    "Close Lead"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}

        {/* Add Family Member Dialog */}
        {showFamilyMemberDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card
              className={`w-full max-w-md border-${colors.borderColor} ${colors.cardBg}`}
            >
              <CardHeader>
                <CardTitle className={colors.textColor}>
                  Add Next of Kin
                </CardTitle>
                <CardDescription className={colors.textColorMuted}>
                  Enter the details of the client's next of kin.
                </CardDescription>
              </CardHeader>
              <div>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      {/* First Name */}
                      <div className="space-y-3">
                        <Label htmlFor="firstname" className={colors.textColor}>
                          First Name <span className="text-red-500">*</span>
                        </Label>
                        <p className={`text-xs ${colors.textColorMuted}`}>
                          First name of next of kin
                        </p>
                        <Input
                          id="firstname"
                          placeholder="Enter first name"
                          className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                          {...familyMemberForm.register("firstname")}
                        />
                        {familyMemberForm.formState.errors.firstname && (
                          <p className="text-sm text-red-500">
                            {
                              familyMemberForm.formState.errors.firstname
                                .message
                            }
                          </p>
                        )}
                      </div>

                      {/* Last Name */}
                      <div className="space-y-3">
                        <Label htmlFor="lastname" className={colors.textColor}>
                          Last Name <span className="text-red-500">*</span>
                        </Label>
                        <p className={`text-xs ${colors.textColorMuted}`}>
                          Last name of next of kin
                        </p>
                        <Input
                          id="lastname"
                          placeholder="Enter last name"
                          className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                          {...familyMemberForm.register("lastname")}
                        />
                        {familyMemberForm.formState.errors.lastname && (
                          <p className="text-sm text-red-500">
                            {familyMemberForm.formState.errors.lastname.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Middle Name */}
                    <div className="space-y-3">
                      <Label htmlFor="middlename" className={colors.textColor}>
                        Middle Name
                      </Label>
                      <p className={`text-xs ${colors.textColorMuted}`}>
                        Middle name of next of kin (if applicable)
                      </p>
                      <Input
                        id="middlename"
                        placeholder="Enter middle name"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...familyMemberForm.register("middlename")}
                      />
                    </div>

                    {/* Relationship */}
                    <div className="space-y-3">
                      <Label
                        htmlFor="relationship"
                        className={colors.textColor}
                      >
                        Relationship <span className="text-red-500">*</span>
                      </Label>
                      <p className={`text-xs ${colors.textColorMuted}`}>
                        Relationship to the client
                      </p>
                      <Controller
                        control={familyMemberForm.control}
                        name="relationship"
                        render={({ field }) => (
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger
                              className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                            >
                              <SelectValue placeholder="Select relationship" />
                            </SelectTrigger>
                            <SelectContent
                              className={`border-${colors.borderColor} ${colors.dropdownBg} ${colors.textColor}`}
                            >
                              <SelectItem value="Spouse">Spouse</SelectItem>
                              <SelectItem value="Child">Child</SelectItem>
                              <SelectItem value="Parent">Parent</SelectItem>
                              <SelectItem value="Sibling">Sibling</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {familyMemberForm.formState.errors.relationship && (
                        <p className="text-sm text-red-500">
                          {
                            familyMemberForm.formState.errors.relationship
                              .message
                          }
                        </p>
                      )}
                    </div>

                    {/* Date of Birth */}
                    <div className="space-y-3">
                      <Label htmlFor="dateOfBirth" className={colors.textColor}>
                        Date of Birth
                      </Label>
                      <p className={`text-xs ${colors.textColorMuted}`}>
                        Date of birth of next of kin
                      </p>
                      <Controller
                        control={familyMemberForm.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "h-10 w-full justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground",
                                  `border-${colors.borderColor} ${colors.inputBg}`
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date > new Date() ||
                                  date < new Date("1900-01-01")
                                }
                                captionLayout="dropdown"
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      />
                    </div>

                    {/* Mobile Number */}
                    <div className="space-y-3">
                      <Label htmlFor="mobileNo" className={colors.textColor}>
                        Mobile Number
                      </Label>
                      <p className={`text-xs ${colors.textColorMuted}`}>
                        Contact number for next of kin
                      </p>
                      <div className="flex space-x-2">
                        <Select defaultValue="+263">
                          <SelectTrigger
                            className={`h-10 w-24 sm:w-28 lg:w-32 border-${colors.borderColor} ${colors.inputBg} flex-shrink-0`}
                          >
                            <SelectValue placeholder="+263" />
                          </SelectTrigger>
                          <SelectContent
                            className={`border-${colors.borderColor} ${colors.dropdownBg} ${colors.textColor}`}
                          >
                            <SelectItem value="+263">🇿🇼 +263</SelectItem>
                            <SelectItem value="+27">🇿🇦 +27</SelectItem>
                            <SelectItem value="+260">🇿🇲 +260</SelectItem>
                            <SelectItem value="+258">🇲🇿 +258</SelectItem>
                            <SelectItem value="+265">🇲🇼 +265</SelectItem>
                            <SelectItem value="+266">🇱🇸 +266</SelectItem>
                            <SelectItem value="+267">🇧🇼 +267</SelectItem>
                            <SelectItem value="+268">🇸🇿 +268</SelectItem>
                            <SelectItem value="+236">🇨🇫 +236</SelectItem>
                            <SelectItem value="+257">🇧🇮 +257</SelectItem>
                            <SelectItem value="+253">🇩🇯 +253</SelectItem>
                            <SelectItem value="+291">🇪🇷 +291</SelectItem>
                            <SelectItem value="+251">🇪🇹 +251</SelectItem>
                            <SelectItem value="+254">🇰🇪 +254</SelectItem>
                            <SelectItem value="+250">🇷🇼 +250</SelectItem>
                            <SelectItem value="+248">🇸🇨 +248</SelectItem>
                            <SelectItem value="+255">🇹🇿 +255</SelectItem>
                            <SelectItem value="+256">🇺🇬 +256</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          id="mobileNo"
                          placeholder="Enter mobile number"
                          className={`h-10 flex-1 border-${colors.borderColor} ${colors.inputBg}`}
                          {...familyMemberForm.register("mobileNo")}
                        />
                      </div>
                    </div>

                    {/* Email Address */}
                    <div className="space-y-3">
                      <Label
                        htmlFor="emailAddress"
                        className={colors.textColor}
                      >
                        Email Address
                      </Label>
                      <p className={`text-xs ${colors.textColorMuted}`}>
                        Email address for next of kin
                      </p>
                      <Input
                        id="emailAddress"
                        type="email"
                        placeholder="Enter email address"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...familyMemberForm.register("emailAddress")}
                      />
                      {familyMemberForm.formState.errors.emailAddress && (
                        <p className="text-sm text-red-500">
                          {
                            familyMemberForm.formState.errors.emailAddress
                              .message
                          }
                        </p>
                      )}
                    </div>

                    {/* Is Dependent */}
                    <div className="space-y-3">
                      <Label htmlFor="isDependent" className={colors.textColor}>
                        Dependency Status
                      </Label>
                      <Card
                        className={`border-${colors.borderColor} ${colors.cardBg} flex flex-row items-center justify-between p-4`}
                      >
                        <div className="flex items-center space-x-2">
                          <Controller
                            control={familyMemberForm.control}
                            name="isDependent"
                            render={({ field }) => (
                              <Checkbox
                                id="isDependent"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            )}
                          />
                          <Label
                            htmlFor="isDependent"
                            className={colors.textColor}
                          >
                            Is dependent
                          </Label>
                        </div>
                        <p className={`text-xs ${colors.textColorMuted}`}>
                          Indicate if this person is financially dependent on
                          the client
                        </p>
                      </Card>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowFamilyMemberDialog(false)}
                    className={`border-${colors.borderColor} hover:bg-${colors.hoverBgColor}`}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={async () => {
                      const data = familyMemberForm.getValues();
                      const isValid = await familyMemberForm.trigger();
                      if (isValid) {
                        handleAddFamilyMember(data);
                      }
                    }}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    Add
                  </Button>
                </CardFooter>
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
