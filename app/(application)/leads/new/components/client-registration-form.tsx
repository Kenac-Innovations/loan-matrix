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
  submitLead,
  addFamilyMember,
  removeFamilyMember,
  getOffices,
  getLegalForms,
  getGenders,
  getClientTypes,
  getClientClassifications,
  getSavingsProducts,
  addOffice,
  addLegalForm,
  addGender,
  addClientType,
  addClientClassification,
  addSavingsProduct,
  getActivationDate,
} from "@/app/actions/client-actions";
import {
  autoSaveField,
  getLeadStageHistory,
  cancelProspect,
  getLeadById,
  markLeadAsConverted,
} from "@/app/actions/client-actions-with-autosave";
import { LeadLocalStorage } from "@/lib/lead-local-storage";
import { ProspectContinuationDialog } from "@/app/(application)/leads/new/components/prospect-continuation-dialog";
import { toast } from "@/components/ui/use-toast";
import { useThemeColors } from "@/lib/theme-utils";
import { Calendar } from "@/components/ui/calender";
import { SkeletonForm } from "./client-registration-form-skeleton";
import { AddOfficeDialog } from "./add-office-dialogue";

// Form validation schema
const clientFormSchema = z
  .object({
    // Step 1: General Information
    officeId: z.number({
      required_error: "Office is required",
    }),
    legalFormId: z.number({
      required_error: "Legal form is required",
    }),
    externalId: z.string().min(1, "National ID is required"),
    firstname: z.string().min(1, "First name is required"),
    middlename: z.string().optional(),
    lastname: z.string().min(1, "Last name is required"),
    dateOfBirth: z.date({
      required_error: "Date of birth is required",
    }),
    genderId: z.number({
      required_error: "Gender is required",
    }),
    isStaff: z.boolean().default(false),
    mobileNo: z.string().min(1, "Mobile number is required"),
    countryCode: z.string().default("+1"),
    emailAddress: z.string().email("Invalid email address"),
    clientTypeId: z.number({
      required_error: "Client type is required",
    }),
    clientClassificationId: z.number({
      required_error: "Client classification is required",
    }),
    submittedOnDate: z.date().default(() => new Date()),

    // Step 2: Account Settings
    active: z.boolean().default(true),
    activationDate: z.date().optional(),
    openSavingsAccount: z.boolean().default(false),
    savingsProductId: z.number().optional(),

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
}

export function ClientRegistrationForm({
  leadId,
  formData,
}: ClientRegistrationFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const colors = useThemeColors();

  // State for multi-step form
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const [clientIdLookup, setClientIdLookup] = useState("");
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [clientLookupStatus, setClientLookupStatus] = useState<
    "idle" | "not_found" | "found" | "error"
  >("idle");
  const [isFormDisabled, setIsFormDisabled] = useState(true);

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
    emailAddress?: string;
    mobileNo?: string;
    timestamp: number;
  } | null>(null);
  const [currentLeadId, setCurrentLeadId] = useState<string | undefined>(
    leadId
  );
  const [isSettingLeadIdFromAutoSave, setIsSettingLeadIdFromAutoSave] =
    useState(false);

  // Initialize form
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema) as any,
    defaultValues: {
      officeId: 1,
      legalFormId: 1,
      externalId: "",
      firstname: "",
      middlename: "",
      lastname: "",
      isStaff: false,
      mobileNo: "",
      countryCode: "+1",
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
            // Set form values
            form.reset({
              officeId: lead.officeId || 1,
              legalFormId: lead.legalFormId || 1,
              externalId: lead.externalId || "",
              firstname: lead.firstname || "",
              middlename: lead.middlename || "",
              lastname: lead.lastname || "",
              dateOfBirth: lead.dateOfBirth || undefined,
              genderId: lead.genderId || undefined,
              isStaff: lead.isStaff || false,
              mobileNo: lead.mobileNo || "",
              countryCode: lead.countryCode || "+1",
              emailAddress: lead.emailAddress || "",
              clientTypeId: lead.clientTypeId || undefined,
              clientClassificationId: lead.clientClassificationId || undefined,
              submittedOnDate: lead.submittedOnDate || new Date(),
              active: lead.active,
              activationDate: lead.activationDate || undefined,
              openSavingsAccount: lead.openSavingsAccount || false,
              savingsProductId: lead.savingsProductId || undefined,
              currentStep: lead.currentStep || 1,
            });

            // Set family members
            setFamilyMembers(lead.familyMembers || []);
          }
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast({
          title: "Error",
          description: "Failed to load form data. Please try again.",
          variant: "destructive",
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

      setShowProspectDialog(false);

      toast({
        title: "Prospect Restored",
        description: "Continuing with your existing prospect.",
        variant: "default",
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

          toast({
            title: "Prospect Canceled",
            description:
              "The previous prospect has been canceled. You can now start a new one.",
            variant: "default",
          });

          // Reset the form for a new prospect
          form.reset({
            officeId: 1,
            legalFormId: 1,
            externalId: "",
            firstname: "",
            middlename: "",
            lastname: "",
            isStaff: false,
            mobileNo: "",
            countryCode: "+1",
            emailAddress: "",
            submittedOnDate: new Date(),
            active: true,
            openSavingsAccount: false,
            currentStep: 1,
          });

          setFamilyMembers([]);
          setCurrentLeadId(undefined);
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to cancel prospect",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error canceling prospect:", error);
        toast({
          title: "Error",
          description:
            "An unexpected error occurred while canceling the prospect",
          variant: "destructive",
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

  // Handle client lookup by ID
  const handleClientLookup = async () => {
    if (!clientIdLookup.trim()) {
      toast({
        title: "Error",
        description: "Please enter a client ID number",
        variant: "destructive",
      });
      return;
    }

    setIsSearchingClient(true);
    setClientLookupStatus("idle");

    try {
      // Mock API call - replace with actual client lookup
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      // For demo purposes, we'll pretend ID "12345" exists and "99999" doesn't
      if (clientIdLookup === "12345") {
        // Mock client data - replace with actual API response
        const clientData = {
          id: "12345",
          officeId: 2,
          legalFormId: 1,
          externalId: "ID-12345",
          firstname: "John",
          middlename: "Michael",
          lastname: "Doe",
          dateOfBirth: new Date("1990-05-15"),
          genderId: 1,
          isStaff: true,
          mobileNo: "5551234567",
          countryCode: "+1",
          emailAddress: "john.doe@example.com",
          clientTypeId: 2,
          clientClassificationId: 1,
          active: true,
          activationDate: new Date(),
          familyMembers: [
            {
              id: "fam-1",
              firstname: "Jane",
              middlename: "",
              lastname: "Doe",
              relationship: "Spouse",
              mobileNo: "5559876543",
              emailAddress: "jane.doe@example.com",
              isDependent: false,
            },
          ],
        };

        // Pre-populate form with client data
        form.reset({
          officeId: clientData.officeId,
          legalFormId: clientData.legalFormId,
          externalId: clientData.externalId,
          firstname: clientData.firstname,
          middlename: clientData.middlename,
          lastname: clientData.lastname,
          dateOfBirth: clientData.dateOfBirth,
          genderId: clientData.genderId,
          isStaff: clientData.isStaff,
          mobileNo: clientData.mobileNo,
          countryCode: clientData.countryCode,
          emailAddress: clientData.emailAddress,
          clientTypeId: clientData.clientTypeId,
          clientClassificationId: clientData.clientClassificationId,
          submittedOnDate: new Date(),
          active: clientData.active,
          activationDate: clientData.activationDate,
          openSavingsAccount: false,
          currentStep: 1,
        });

        // Set family members
        setFamilyMembers(clientData.familyMembers);

        setClientLookupStatus("found");
        setIsFormDisabled(false);

        toast({
          title: "Client Found",
          description: "Form has been pre-populated with existing client data.",
          variant: "default",
        });
      } else {
        setClientLookupStatus("not_found");
        setIsFormDisabled(false);

        toast({
          title: "Client Not Found",
          description:
            "No client found with this ID. You can proceed with new client registration.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error looking up client:", error);
      setClientLookupStatus("error");

      toast({
        title: "Error",
        description: "Failed to look up client. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingClient(false);
    }
  };

  // Handle clearing client lookup
  const handleClearClientLookup = () => {
    setClientIdLookup("");
    setClientLookupStatus("idle");
    setIsFormDisabled(true);

    // Reset form to default values
    form.reset({
      officeId: 1,
      legalFormId: 1,
      externalId: "",
      firstname: "",
      middlename: "",
      lastname: "",
      isStaff: false,
      mobileNo: "",
      countryCode: "+1",
      emailAddress: "",
      submittedOnDate: new Date(),
      active: true,
      openSavingsAccount: false,
      currentStep: 1,
    });

    // Clear family members
    setFamilyMembers([]);
  };

  // Handle form submission
  const onSubmit = async (data: ClientFormValues) => {
    setIsSubmitting(true);

    try {
      // Save draft first
      const saveResult = await handleSaveDraft(data);

      if (!saveResult.success) {
        toast({
          title: "Error",
          description: saveResult.error || "Failed to save draft",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Submit to API
      const submitResult = await submitLead(saveResult.leadId!);

      if (!submitResult.success) {
        toast({
          title: "Error",
          description: submitResult.error || "Failed to submit lead",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Clear local storage on successful submission
      LeadLocalStorage.clear();

      toast({
        title: "Success",
        description: "Client registered successfully",
        variant: "default",
      });

      // Redirect to leads page
      router.push("/leads");
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle saving draft
  const handleSaveDraft = async (data: ClientFormValues) => {
    setIsSaving(true);

    try {
      const result = await saveDraft(
        {
          ...data,
        },
        leadId
      );

      if (result.success) {
        // If no leadId yet, update URL with the new leadId
        if (!leadId && result.leadId) {
          router.push(`/leads/new?id=${result.leadId}`);
        }

        toast({
          title: "Draft Saved",
          description: "Your progress has been saved",
          variant: "default",
        });

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
      toast({
        title: "Error",
        description: "Please provide a reason for closing",
        variant: "destructive",
      });
      return;
    }

    setIsClosing(true);

    try {
      if (!leadId) {
        toast({
          title: "Error",
          description: "No lead ID found",
          variant: "destructive",
        });
        return;
      }

      const result = await closeLead(leadId, closeReason);

      if (result.success) {
        toast({
          title: "Lead Closed",
          description: "The lead has been closed",
          variant: "default",
        });

        // Redirect to leads page
        router.push("/leads");
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to close lead",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error closing lead:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsClosing(false);
      setShowCloseDialog(false);
    }
  };
  // Handle adding family member
  const handleAddFamilyMember = async (data: FamilyMemberValues) => {
    if (!leadId) {
      // Save the form first to get a leadId
      const formData = form.getValues();
      const saveResult = await handleSaveDraft(formData);

      if (!saveResult.success) {
        toast({
          title: "Error",
          description: saveResult.error || "Failed to save draft",
          variant: "destructive",
        });
        return;
      }

      leadId = saveResult.leadId;
    }

    try {
      const result = await addFamilyMember(leadId!, data);

      if (result.success) {
        toast({
          title: "Success",
          description: "Family member added",
          variant: "default",
        });

        // Reset form and close dialog
        familyMemberForm.reset();
        setShowFamilyMemberDialog(false);

        // Refresh family members
        const lead = await getLead(leadId!);
        if (lead) {
          setFamilyMembers(lead.familyMembers || []);
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to add family member",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding family member:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  // Handle removing family member
  const handleRemoveFamilyMember = async (id: string) => {
    try {
      const result = await removeFamilyMember(id);

      if (result.success) {
        toast({
          title: "Success",
          description: "Family member removed",
          variant: "default",
        });

        // Refresh family members
        if (leadId) {
          const lead = await getLead(leadId);
          if (lead) {
            setFamilyMembers(lead.familyMembers || []);
          }
        }
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to remove family member",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error removing family member:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
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

      toast({
        title: "Success",
        description: "Legal form added successfully",
        variant: "default",
      });

      // Add the new legal form to the local state
      setLegalForms([...legalForms, mockResult]);

      // Select the new legal form
      form.setValue("legalFormId", mockResult.id);

      // Close dialog and reset form
      setShowAddLegalFormDialog(false);
      legalFormForm.reset();
    } catch (error) {
      console.error("Error adding legal form:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
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

      toast({
        title: "Success",
        description: "Gender added successfully",
        variant: "default",
      });

      // Add the new gender to the local state
      setGenders([...genders, mockResult]);

      // Select the new gender
      form.setValue("genderId", mockResult.id);

      // Close dialog and reset form
      setShowAddGenderDialog(false);
      genderForm.reset();
    } catch (error) {
      console.error("Error adding gender:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
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

      toast({
        title: "Success",
        description: "Client type added successfully",
        variant: "default",
      });

      // Add the new client type to the local state
      setClientTypes([...clientTypes, mockResult]);

      // Select the new client type
      form.setValue("clientTypeId", mockResult.id);

      // Close dialog and reset form
      setShowAddClientTypeDialog(false);
      clientTypeForm.reset();
    } catch (error) {
      console.error("Error adding client type:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
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

      toast({
        title: "Success",
        description: "Client classification added successfully",
        variant: "default",
      });

      // Add the new client classification to the local state
      setClientClassifications([...clientClassifications, mockResult]);

      // Select the new client classification
      form.setValue("clientClassificationId", mockResult.id);

      // Close dialog and reset form
      setShowAddClientClassificationDialog(false);
      clientClassificationForm.reset();
    } catch (error) {
      console.error("Error adding client classification:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
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

      toast({
        title: "Success",
        description: "Savings product added successfully",
        variant: "default",
      });

      // Add the new savings product to the local state
      setSavingsProducts([...savingsProducts, mockResult]);

      // Select the new savings product
      form.setValue("savingsProductId", mockResult.id);

      // Close dialog and reset form
      setShowAddSavingsProductDialog(false);
      savingsProductForm.reset();
    } catch (error) {
      console.error("Error adding savings product:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
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
                      htmlFor="clientIdLookup"
                      className={colors.textColor}
                    >
                      Client ID Number <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex space-x-2">
                      <Input
                        id="clientIdLookup"
                        placeholder="Enter client ID number"
                        value={clientIdLookup}
                        onChange={(e) => setClientIdLookup(e.target.value)}
                        className={`h-10 flex-1 border-${colors.borderColor} ${colors.inputBg}`}
                        disabled={isSearchingClient}
                      />
                      <Button
                        type="button"
                        onClick={handleClientLookup}
                        disabled={isSearchingClient || !clientIdLookup.trim()}
                        className="bg-blue-500 hover:bg-blue-600 min-w-[100px]"
                      >
                        {isSearchingClient ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Searching...
                          </>
                        ) : (
                          <>
                            <Search className="mr-2 h-4 w-4" />
                            Search
                          </>
                        )}
                      </Button>
                      {clientLookupStatus !== "idle" && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleClearClientLookup}
                          className={`border-${colors.borderColor} hover:bg-${colors.hoverBgColor}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className={`text-xs ${colors.textColorMuted}`}>
                      Enter the client's unique ID number to search for existing
                      records
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

            <form onSubmit={form.handleSubmit(onSubmit as any)}>
              <Card className={`border-${colors.borderColor} ${colors.cardBg}`}>
                <CardHeader>
                  <CardTitle className={colors.textColor}>
                    Client Information
                  </CardTitle>
                  <CardDescription className={colors.textColorMuted}>
                    {clientLookupStatus === "found"
                      ? "Review and update the client's information as needed."
                      : "Enter the client's information to register them."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* Administrative Information Section */}
                  <div className="space-y-6 mb-8">
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                      <h3 className={`text-lg font-medium ${colors.textColor}`}>
                        Administrative Information
                      </h3>
                      <p className={`text-sm ${colors.textColorMuted}`}>
                        Office and legal classification details
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Office */}
                      <div className="space-y-3">
                        <Label htmlFor="officeId" className={colors.textColor}>
                          Office <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Controller
                            control={form.control}
                            name="officeId"
                            render={({ field }) => (
                              <SearchableSelect
                                options={officeOptions}
                                value={field.value?.toString()}
                                onValueChange={(value) =>
                                  field.onChange(Number.parseInt(value))
                                }
                                placeholder="Select office"
                                className={`border-${colors.borderColor} ${colors.inputBg}`}
                                onAddNew={() => setShowAddOfficeDialog(true)}
                                addNewLabel="Add new office"
                                disabled={isFormDisabled}
                              />
                            )}
                          />
                        </div>
                        <p className={`text-xs ${colors.textColorMuted}`}>
                          Select the branch office managing this client
                        </p>
                        {form.formState.errors.officeId && (
                          <p className="text-sm text-red-500">
                            {form.formState.errors.officeId.message}
                          </p>
                        )}
                      </div>

                      {/* Legal Form */}
                      <div className="space-y-3">
                        <Label
                          htmlFor="legalFormId"
                          className={colors.textColor}
                        >
                          Legal Form <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Controller
                            control={form.control}
                            name="legalFormId"
                            render={({ field }) => (
                              <SearchableSelect
                                options={legalFormOptions}
                                value={field.value?.toString()}
                                onValueChange={(value) =>
                                  field.onChange(Number.parseInt(value))
                                }
                                placeholder="Select legal form"
                                className={`border-${colors.borderColor} ${colors.inputBg}`}
                                onAddNew={() => setShowAddLegalFormDialog(true)}
                                addNewLabel="Add new legal form"
                                disabled={isFormDisabled}
                              />
                            )}
                          />
                        </div>
                        <p className={`text-xs ${colors.textColorMuted}`}>
                          Legal classification of the client
                        </p>
                        {form.formState.errors.legalFormId && (
                          <p className="text-sm text-red-500">
                            {form.formState.errors.legalFormId.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Personal Information Section */}
                  <div className="space-y-6 mb-8">
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                      <h3 className={`text-lg font-medium ${colors.textColor}`}>
                        Personal Information
                      </h3>
                      <p className={`text-sm ${colors.textColorMuted}`}>
                        Client's personal identification details
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* First Name */}
                      <div className="space-y-3">
                        <Label htmlFor="firstname" className={colors.textColor}>
                          First Name <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="firstname"
                            placeholder="Enter first name"
                            className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                            {...form.register("firstname", {
                              onBlur: (e) =>
                                handleFieldBlur("firstname", e.target.value),
                            })}
                            disabled={isFormDisabled}
                          />
                          {lastSavedField === "firstname" && isAutoSaving && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                        <p className={`text-xs ${colors.textColorMuted}`}>
                          Client's legal first name
                        </p>
                        {form.formState.errors.firstname && (
                          <p className="text-sm text-red-500">
                            {form.formState.errors.firstname.message}
                          </p>
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
                            placeholder="Enter middle name"
                            className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                            {...form.register("middlename", {
                              onBlur: (e) =>
                                handleFieldBlur("middlename", e.target.value),
                            })}
                            disabled={isFormDisabled}
                          />
                          {lastSavedField === "middlename" && isAutoSaving && (
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
                        <Label htmlFor="lastname" className={colors.textColor}>
                          Last Name <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="lastname"
                            placeholder="Enter last name"
                            className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                            {...form.register("lastname", {
                              onBlur: (e) =>
                                handleFieldBlur("lastname", e.target.value),
                            })}
                            disabled={isFormDisabled}
                          />
                          {lastSavedField === "lastname" && isAutoSaving && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                        <p className={`text-xs ${colors.textColorMuted}`}>
                          Client's legal last name/surname
                        </p>
                        {form.formState.errors.lastname && (
                          <p className="text-sm text-red-500">
                            {form.formState.errors.lastname.message}
                          </p>
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
                          Date of Birth <span className="text-red-500">*</span>
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
                                    !field.value && "text-muted-foreground",
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
                                  disabled={(date) =>
                                    date > new Date() ||
                                    date < new Date("1900-01-01")
                                  }
                                  initialFocus
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
                        <Label htmlFor="genderId" className={colors.textColor}>
                          Gender <span className="text-red-500">*</span>
                        </Label>

                        <Controller
                          control={form.control}
                          name="genderId"
                          render={({ field }) => (
                            <SearchableSelect
                              options={genderOptions}
                              value={field.value?.toString()}
                              onValueChange={(value) =>
                                field.onChange(Number.parseInt(value))
                              }
                              placeholder="Select gender"
                              className={`border-${colors.borderColor} ${colors.inputBg}`}
                              onAddNew={() => setShowAddGenderDialog(true)}
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
                          National ID <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="externalId"
                            placeholder="Enter national ID"
                            className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                            {...form.register("externalId", {
                              onBlur: (e) =>
                                handleFieldBlur("externalId", e.target.value),
                            })}
                            disabled={isFormDisabled}
                          />
                          {lastSavedField === "externalId" && isAutoSaving && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                            </div>
                          )}
                        </div>
                        <p className={`text-xs ${colors.textColorMuted}`}>
                          Government-issued identification number
                        </p>
                        {form.formState.errors.externalId && (
                          <p className="text-sm text-red-500">
                            {form.formState.errors.externalId.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Information Section */}
                  <div className="space-y-6 mb-8">
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                      <h3 className={`text-lg font-medium ${colors.textColor}`}>
                        Contact Information
                      </h3>
                      <p className={`text-sm ${colors.textColorMuted}`}>
                        Client's contact details for communication
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Mobile Number */}
                      <div className="space-y-3">
                        <Label htmlFor="mobileNo" className={colors.textColor}>
                          Mobile Number <span className="text-red-500">*</span>
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
                                  className={`h-10 w-24 border-${colors.borderColor} ${colors.inputBg}`}
                                >
                                  <SelectValue placeholder="+1" />
                                </SelectTrigger>
                                <SelectContent
                                  className={`border-${colors.borderColor} ${colors.dropdownBg} ${colors.textColor}`}
                                >
                                  <SelectItem value="+1">🇺🇸 +1</SelectItem>
                                  <SelectItem value="+44">🇬🇧 +44</SelectItem>
                                  <SelectItem value="+33">🇫🇷 +33</SelectItem>
                                  <SelectItem value="+49">🇩🇪 +49</SelectItem>
                                  <SelectItem value="+81">🇯🇵 +81</SelectItem>
                                  <SelectItem value="+86">🇨🇳 +86</SelectItem>
                                  <SelectItem value="+91">🇮🇳 +91</SelectItem>
                                  <SelectItem value="+61">🇦🇺 +61</SelectItem>
                                  <SelectItem value="+55">🇧🇷 +55</SelectItem>
                                  <SelectItem value="+52">🇲🇽 +52</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <div className="relative">
                            <Input
                              id="mobileNo"
                              placeholder="Enter mobile number"
                              className={`h-10 flex-1 border-${colors.borderColor} ${colors.inputBg}`}
                              {...form.register("mobileNo", {
                                onBlur: (e) =>
                                  handleFieldBlur("mobileNo", e.target.value),
                              })}
                              disabled={isFormDisabled}
                            />
                            {lastSavedField === "mobileNo" && isAutoSaving && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                              </div>
                            )}
                          </div>
                        </div>
                        <p className={`text-xs ${colors.textColorMuted}`}>
                          Primary contact number for notifications
                        </p>
                        {form.formState.errors.mobileNo && (
                          <p className="text-sm text-red-500">
                            {form.formState.errors.mobileNo.message}
                          </p>
                        )}
                      </div>

                      {/* Email Address */}
                      <div className="space-y-3">
                        <Label
                          htmlFor="emailAddress"
                          className={colors.textColor}
                        >
                          Email Address <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="emailAddress"
                            type="email"
                            placeholder="Enter email address"
                            className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                            {...form.register("emailAddress", {
                              onBlur: (e) =>
                                handleFieldBlur("emailAddress", e.target.value),
                            })}
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
                        {form.formState.errors.emailAddress && (
                          <p className="text-sm text-red-500">
                            {form.formState.errors.emailAddress.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Classification Information Section */}
                  <div className="space-y-6 mb-8">
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                      <h3 className={`text-lg font-medium ${colors.textColor}`}>
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
                          Client Type <span className="text-red-500">*</span>
                        </Label>

                        <Controller
                          control={form.control}
                          name="clientTypeId"
                          render={({ field }) => (
                            <SearchableSelect
                              options={clientTypeOptions}
                              value={field.value?.toString()}
                              onValueChange={(value) =>
                                field.onChange(Number.parseInt(value))
                              }
                              placeholder="Select client type"
                              className={`border-${colors.borderColor} ${colors.inputBg}`}
                              onAddNew={() => setShowAddClientTypeDialog(true)}
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
                              onValueChange={(value) =>
                                field.onChange(Number.parseInt(value))
                              }
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
                      <h3 className={`text-lg font-medium ${colors.textColor}`}>
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
                          Submitted On <span className="text-red-500">*</span>
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
                                    !field.value && "text-muted-foreground",
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
                                  disabled={(date) =>
                                    date > new Date() ||
                                    date < new Date("1900-01-01")
                                  }
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
                            {form.formState.errors.submittedOnDate.message}
                          </p>
                        )}
                      </div>

                      {/* Is Staff */}
                      <div className="space-y-3">
                        <Label htmlFor="isStaff" className={colors.textColor}>
                          Staff Status
                        </Label>
                        <Card
                          className={`border-${colors.borderColor} ${colors.cardBg} flex flex-row items-center justify-between p-4`}
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
                          <p className={`text-xs ${colors.textColorMuted}`}>
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
                        No next of kin added yet. Click the button above to add
                        one.
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
                      <h3 className={`text-lg font-medium ${colors.textColor}`}>
                        Account Settings
                      </h3>
                      <p className={`text-sm ${colors.textColorMuted}`}>
                        Configure account activation settings
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Active */}
                      <div className="space-y-3">
                        <Label htmlFor="active" className={colors.textColor}>
                          Account Status
                        </Label>
                        <Card
                          className={`border-${colors.borderColor} ${colors.cardBg} flex flex-row items-center justify-between p-4`}
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
                          <p className={`text-xs ${colors.textColorMuted}`}>
                            Set whether the account is active upon creation
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
                          className={`border-${colors.borderColor} ${colors.cardBg} flex flex-row items-center justify-between p-4`}
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
                          <p className={`text-xs ${colors.textColorMuted}`}>
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
                                      !field.value && "text-muted-foreground",
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
                                    disabled={(date) =>
                                      date > new Date() ||
                                      date < new Date("1900-01-01")
                                    }
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            )}
                          />
                          <p className={`text-xs ${colors.textColorMuted}`}>
                            Date when the account becomes active
                          </p>
                          {form.formState.errors.activationDate && (
                            <p className="text-sm text-red-500">
                              {form.formState.errors.activationDate.message}
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
                                onValueChange={(value) =>
                                  field.onChange(Number.parseInt(value))
                                }
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
                          <p className={`text-xs ${colors.textColorMuted}`}>
                            Type of savings account to open
                          </p>
                          {form.formState.errors.savingsProductId && (
                            <p className="text-sm text-red-500">
                              {form.formState.errors.savingsProductId.message}
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
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600"
                    disabled={isSubmitting || isFormDisabled}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit"
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </form>
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
              className={`w-full max-w-md border-${colors.borderColor} ${colors.cardBg}`}
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
              <form
                onSubmit={familyMemberForm.handleSubmit(
                  handleAddFamilyMember as any
                )}
              >
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
                        <Select defaultValue="+1">
                          <SelectTrigger
                            className={`h-10 w-24 border-${colors.borderColor} ${colors.inputBg}`}
                          >
                            <SelectValue placeholder="+1" />
                          </SelectTrigger>
                          <SelectContent
                            className={`border-${colors.borderColor} ${colors.dropdownBg} ${colors.textColor}`}
                          >
                            <SelectItem value="+1">🇺🇸 +1</SelectItem>
                            <SelectItem value="+44">🇬🇧 +44</SelectItem>
                            <SelectItem value="+33">🇫🇷 +33</SelectItem>
                            <SelectItem value="+49">🇩🇪 +49</SelectItem>
                            <SelectItem value="+81">🇯🇵 +81</SelectItem>
                            <SelectItem value="+86">🇨🇳 +86</SelectItem>
                            <SelectItem value="+91">🇮🇳 +91</SelectItem>
                            <SelectItem value="+61">🇦🇺 +61</SelectItem>
                            <SelectItem value="+55">🇧🇷 +55</SelectItem>
                            <SelectItem value="+52">🇲🇽 +52</SelectItem>
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
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    Add
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
