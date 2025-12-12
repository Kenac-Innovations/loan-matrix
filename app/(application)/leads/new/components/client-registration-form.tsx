"use client";

import { useState, useEffect, useRef, ChangeEvent } from "react";
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
  CheckCircle2,
  MapPin,
  Database,
  Users,
  Building2,
  Edit2,
  Save,
  Check,
  FileText,
  Download,
  Eye,
  Trash2,
  Plus,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  saveDraft,
  getLead,
  closeLead,
  addFamilyMember,
  updateFamilyMember,
  removeFamilyMember,
  getOffices,
  getLegalForms,
  getGenders,
  getClientTypes,
  getClientClassifications,
  getSavingsProducts,
  getActivationDate,
  addClientType,
  addClientClassification,
  addGender,
  getDocumentTypes,
  addDocumentType,
  getClientTemplateData,
  addAddressType,
  addCountry,
  addStateProvince,
  getRelationships,
  addRelationship,
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
import { DynamicDatatableContent } from "@/app/(application)/clients/[id]/components/DynamicDatatableContent";
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

    // Affordability Information
    requestedAmount: z.number().optional(),
    loanTerm: z.number().optional(),
    incomeType: z.string().optional(),
    grossMonthlyIncome: z.number().optional(),
    netMonthlyIncome: z.number().optional(),
    monthlyExpenses: z.number().optional(),
    creditScore: z.number().optional(),
    employmentLengthMonths: z.number().optional(),
    nationality: z.string().optional(),
    idType: z.string().optional(),
    mobileInOwnName: z.boolean().default(false),
    hasProofOfIncome: z.boolean().default(false),
    hasValidNationalId: z.boolean().default(false),
    identityVerified: z.boolean().default(false),
    employmentVerified: z.boolean().default(false),
    incomeVerified: z.boolean().default(false),

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

// New document type schema
const documentTypeSchema = z.object({
  name: z.string().min(1, "Document type name is required"),
  description: z.string().optional(),
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

// New relationship schema
const relationshipSchema = z.object({
  name: z.string().min(1, "Relationship name is required"),
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

// Phone number parsing utility
const parsePhoneNumber = (
  phoneNumber: string
): { countryCode: string; number: string } => {
  if (!phoneNumber) return { countryCode: "+263", number: "" };

  // Remove all non-digit characters for parsing
  const digitsOnly = phoneNumber.replace(/\D/g, "");

  // Common country codes in the region (2-3 digits)
  const countryCodes = [
    { code: "260", prefix: "+260" }, // Zambia
    { code: "263", prefix: "+263" }, // Zimbabwe
    { code: "27", prefix: "+27" }, // South Africa
    { code: "258", prefix: "+258" }, // Mozambique
    { code: "265", prefix: "+265" }, // Malawi
    { code: "266", prefix: "+266" }, // Lesotho
    { code: "267", prefix: "+267" }, // Botswana
    { code: "268", prefix: "+268" }, // Eswatini
    { code: "236", prefix: "+236" }, // Central African Republic
    { code: "257", prefix: "+257" }, // Burundi
    { code: "253", prefix: "+253" }, // Djibouti
    { code: "291", prefix: "+291" }, // Eritrea
    { code: "251", prefix: "+251" }, // Ethiopia
    { code: "254", prefix: "+254" }, // Kenya
    { code: "250", prefix: "+250" }, // Rwanda
    { code: "248", prefix: "+248" }, // Seychelles
    { code: "255", prefix: "+255" }, // Tanzania
    { code: "256", prefix: "+256" }, // Uganda
  ];

  // Check if number starts with a country code
  for (const country of countryCodes) {
    if (digitsOnly.startsWith(country.code)) {
      const number = digitsOnly.substring(country.code.length);
      // Validate that we have a reasonable number length after country code
      if (number.length >= 7 && number.length <= 12) {
        return { countryCode: country.prefix, number };
      }
    }
  }

  // If no country code detected, return as is with default country code
  return { countryCode: "+263", number: digitsOnly };
};

// Format phone number for display (add spaces for readability)
const formatPhoneNumber = (number: string): string => {
  if (!number) return "";
  const digitsOnly = number.replace(/\D/g, "");
  // Format as XXX XXX XXXX for 9-10 digits, or keep as is for other lengths
  if (digitsOnly.length === 9) {
    return `${digitsOnly.slice(0, 3)} ${digitsOnly.slice(
      3,
      6
    )} ${digitsOnly.slice(6)}`;
  } else if (digitsOnly.length === 10) {
    return `${digitsOnly.slice(0, 3)} ${digitsOnly.slice(
      3,
      6
    )} ${digitsOnly.slice(6)}`;
  }
  return digitsOnly;
};
type FamilyMemberValues = z.infer<typeof familyMemberSchema>;
type LegalFormValues = z.infer<typeof legalFormSchema>;
type GenderFormValues = z.infer<typeof genderSchema>;
type DocumentTypeFormValues = z.infer<typeof documentTypeSchema>;
type ClientTypeValues = z.infer<typeof clientTypeSchema>;
type ClientClassificationValues = z.infer<typeof clientClassificationSchema>;
type RelationshipFormValues = z.infer<typeof relationshipSchema>;
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
  onAllSectionsComplete?: (isComplete: boolean) => void;
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
  onAllSectionsComplete,
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
  const [editingFamilyMemberIndex, setEditingFamilyMemberIndex] = useState<
    number | null
  >(null);
  const [isAddingFamilyMember, setIsAddingFamilyMember] = useState(false);
  const [editingFamilyMember, setEditingFamilyMember] = useState<any>({});
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
  const [activeClientTab, setActiveClientTab] = useState("general");

  // Update clientLookupStatus when clientCreatedInFineract changes
  useEffect(() => {
    if (clientCreatedInFineract) {
      setClientLookupStatus("found");
      setIsFormDisabled(false);

      // Mark all completed sections as saved when client is created/updated in Fineract
      setSectionCompletion((prevCompletion) => {
        setSectionSaved({
          administrative: prevCompletion.administrative,
          personal: prevCompletion.personal,
          contact: prevCompletion.contact,
          classification: prevCompletion.classification,
          additional: prevCompletion.additional,
          selfie: prevCompletion.selfie,
          identityDocuments: prevCompletion.identityDocuments,
          otherDocuments: prevCompletion.otherDocuments,
          datatables: prevCompletion.datatables,
        });
        return prevCompletion;
      });
    }
  }, [clientCreatedInFineract]);

  // Fetch additional details (address, data tables) when we have a Fineract client ID
  useEffect(() => {
    const fetchAdditionalDetails = async () => {
      const clientId = (window as any).fineractClientId;

      if (!clientId || !clientCreatedInFineract) {
        return;
      }

      setIsLoadingAdditionalDetails(true);
      const numericClientId = Number(clientId);
      setFineractClientId(numericClientId);

      try {
        // Fetch address field configuration
        const fieldConfigResponse = await fetch(
          `/api/fineract/fieldconfiguration/ADDRESS`
        );
        if (fieldConfigResponse.ok) {
          const fieldConfigData = await fieldConfigResponse.json();
          // Filter to only enabled fields and exclude system fields
          const enabledFields = (fieldConfigData || []).filter(
            (field: any) =>
              field.isEnabled &&
              !["createdBy", "createdOn", "updatedBy", "updatedOn"].includes(
                field.field
              )
          );
          setAddressFieldConfig(enabledFields);
        }

        // Fetch address template for dropdown options
        const templateResponse = await fetch(
          `/api/fineract/clients/addresses/template`
        );
        let templateData = null;
        if (templateResponse.ok) {
          templateData = await templateResponse.json();
          setAddressTemplate(templateData);
        }

        // Fetch identifiers template for document types
        try {
          console.log(
            "Fetching identifiers template for client:",
            numericClientId
          );
          const identifiersTemplateResponse = await fetch(
            `/api/fineract/clients/${numericClientId}/identifiers/template`
          );
          console.log(
            "Identifiers template response status:",
            identifiersTemplateResponse.status,
            identifiersTemplateResponse.statusText
          );

          if (identifiersTemplateResponse.ok) {
            const identifiersData = await identifiersTemplateResponse.json();
            console.log("Identifiers template raw data:", identifiersData);
            console.log(
              "Has documentTypeOptions:",
              !!identifiersData?.documentTypeOptions
            );
            console.log(
              "documentTypeOptions length:",
              identifiersData?.documentTypeOptions?.length
            );

            // Handle different response structures
            let templateToSet = null;

            if (identifiersData?.documentTypeOptions) {
              // Direct structure: { documentTypeOptions: [...] }
              templateToSet = identifiersData;
              console.log("Using direct documentTypeOptions structure");
            } else if (identifiersData?.data?.documentTypeOptions) {
              // Nested structure: { data: { documentTypeOptions: [...] } }
              templateToSet = identifiersData.data;
              console.log("Using nested data.documentTypeOptions structure");
            } else if (Array.isArray(identifiersData)) {
              // Array structure: [...]
              templateToSet = { documentTypeOptions: identifiersData };
              console.log(
                "Using array structure, wrapped in documentTypeOptions"
              );
            } else if (identifiersData && typeof identifiersData === "object") {
              // Check for other possible property names
              const keys = Object.keys(identifiersData);
              console.log("Template object keys:", keys);

              // Look for any array property that might be document types
              for (const key of keys) {
                if (
                  Array.isArray(identifiersData[key]) &&
                  identifiersData[key].length > 0
                ) {
                  const firstItem = identifiersData[key][0];
                  // Check if it looks like a document type option (has id and name/value)
                  if (
                    firstItem &&
                    firstItem.id !== undefined &&
                    (firstItem.name || firstItem.value)
                  ) {
                    templateToSet = {
                      documentTypeOptions: identifiersData[key],
                    };
                    console.log(`Using array from key: ${key}`);
                    break;
                  }
                }
              }

              // If still not found, use the data as-is
              if (!templateToSet) {
                templateToSet = identifiersData;
                console.log("Using data as-is (no documentTypeOptions found)");
              }
            } else {
              console.warn(
                "Unexpected identifiers template structure:",
                identifiersData
              );
              templateToSet = identifiersData;
            }

            console.log("Setting identifiers template:", templateToSet);
            setIdentifiersTemplate(templateToSet);
          } else {
            const errorData = await identifiersTemplateResponse
              .json()
              .catch(() => ({}));
            console.error(
              "Error fetching identifiers template:",
              identifiersTemplateResponse.status,
              errorData
            );
            // Set to empty object so UI shows "No document types available" instead of "Loading..."
            setIdentifiersTemplate({ documentTypeOptions: [] });
          }
        } catch (templateError) {
          console.error(
            "Exception fetching identifiers template:",
            templateError
          );
          // Set to empty object so UI shows "No document types available" instead of "Loading..."
          setIdentifiersTemplate({ documentTypeOptions: [] });
        }

        // Fetch existing identifiers
        setIsLoadingKYC(true);
        try {
          const identifiersResponse = await fetch(
            `/api/fineract/clients/${numericClientId}/identifiers`
          );
          console.log(
            "Identifiers response status:",
            identifiersResponse.status
          );

          if (identifiersResponse.ok) {
            const identifiersData = await identifiersResponse.json();
            console.log("Identifiers raw data:", identifiersData);

            // Handle both array and object with array property
            let identifiers = [];
            if (Array.isArray(identifiersData)) {
              identifiers = identifiersData;
            } else if (identifiersData?.pageItems) {
              identifiers = identifiersData.pageItems;
            } else if (identifiersData?.identifiers) {
              identifiers = identifiersData.identifiers;
            } else if (identifiersData?.data) {
              identifiers = Array.isArray(identifiersData.data)
                ? identifiersData.data
                : [];
            } else if (identifiersData && typeof identifiersData === "object") {
              // If it's an object but not an array, try to extract any array property
              const keys = Object.keys(identifiersData);
              for (const key of keys) {
                if (Array.isArray(identifiersData[key])) {
                  identifiers = identifiersData[key];
                  break;
                }
              }
            }

            console.log("Processed identifiers:", identifiers);
            setExistingIdentifiers(identifiers);

            // Fetch documents for each identifier
            const documentsMap = new Map<number, any[]>();

            // Safety check: ensure identifiers is an array
            if (Array.isArray(identifiers) && identifiers.length > 0) {
              const fetchPromises = identifiers.map(async (identifier: any) => {
                const identifierId = identifier.id;
                if (!identifierId) return;

                try {
                  const docsResponse = await fetch(
                    `/api/fineract/client_identifiers/${identifierId}/documents`
                  );
                  if (docsResponse.ok) {
                    const docsData = await docsResponse.json();
                    // Handle different response structures
                    let docs = [];
                    if (Array.isArray(docsData)) {
                      docs = docsData;
                    } else if (docsData?.pageItems) {
                      docs = docsData.pageItems;
                    } else if (docsData?.content) {
                      docs = docsData.content;
                    } else if (docsData?.documents) {
                      docs = docsData.documents;
                    }
                    documentsMap.set(identifierId, docs);
                  } else if (docsResponse.status !== 404) {
                    console.error(
                      `Error fetching documents for identifier ${identifierId}:`,
                      docsResponse.status
                    );
                    documentsMap.set(identifierId, []);
                  } else {
                    documentsMap.set(identifierId, []);
                  }
                } catch (error) {
                  console.error(
                    `Exception fetching documents for identifier ${identifierId}:`,
                    error
                  );
                  documentsMap.set(identifierId, []);
                }
              });

              try {
                await Promise.all(fetchPromises);
              } catch (promiseError) {
                console.error(
                  "Error in Promise.all for document fetching:",
                  promiseError
                );
              }
            }

            setIdentifierDocuments(documentsMap);
          } else if (identifiersResponse.status === 404) {
            console.log("No identifiers found (404)");
            setExistingIdentifiers([]);
            setIdentifierDocuments(new Map());
          } else {
            const errorData = await identifiersResponse
              .json()
              .catch(() => ({}));
            console.error(
              "Error fetching identifiers:",
              identifiersResponse.status,
              errorData
            );
            setExistingIdentifiers([]);
            setIdentifierDocuments(new Map());
          }
        } catch (error) {
          console.error("Exception fetching identifiers:", error);
          setExistingIdentifiers([]);
          setIdentifierDocuments(new Map());
        } finally {
          setIsLoadingKYC(false);
        }

        // Fetch client documents to link with identifiers
        try {
          const documentsResponse = await fetch(
            `/api/fineract/clients/${numericClientId}/documents`
          );
          console.log("Documents response status:", documentsResponse.status);

          if (documentsResponse.ok) {
            const documentsData = await documentsResponse.json();
            console.log("Documents raw data:", documentsData);

            // Handle different response structures
            let documents = [];
            if (Array.isArray(documentsData)) {
              documents = documentsData;
            } else if (documentsData?.pageItems) {
              documents = documentsData.pageItems;
            } else if (documentsData?.content) {
              documents = documentsData.content;
            } else if (documentsData?.documents) {
              documents = documentsData.documents;
            }

            console.log("Processed documents:", documents);
            setClientDocuments(documents);
          } else if (documentsResponse.status !== 404) {
            const errorData = await documentsResponse.json().catch(() => ({}));
            console.error(
              "Error fetching documents:",
              documentsResponse.status,
              errorData
            );
          }
        } catch (error) {
          console.error("Exception fetching documents:", error);
        }

        // Fetch existing client image with maxHeight parameter
        try {
          const imageResponse = await fetch(
            `/api/fineract/clients/${numericClientId}/images?maxHeight=150`
          );

          console.log("Image fetch response status:", imageResponse.status);

          if (imageResponse.ok) {
            const imageData = await imageResponse.json();

            console.log("Image data received:", {
              type: typeof imageData,
              isNull: imageData === null,
              isString: typeof imageData === "string",
              hasImageData: !!imageData?.imageData,
              hasBase64EncodedImage: !!imageData?.base64EncodedImage,
              isArray: Array.isArray(imageData),
              preview:
                typeof imageData === "string"
                  ? imageData.substring(0, 50) + "..."
                  : JSON.stringify(imageData).substring(0, 100),
            });

            // Handle null response (no image found)
            if (imageData === null || imageData === undefined) {
              console.log("No image found for client");
              setExistingClientImage(null);
              setSelfieImageLoading(false);
              return;
            }

            // Helper function to check if a string looks like base64
            const isBase64Like = (str: string): boolean => {
              // Base64 can contain A-Z, a-z, 0-9, +, /, and = for padding
              const base64Regex = /^[A-Za-z0-9+/=]+$/;
              return base64Regex.test(str) && str.length > 10;
            };

            // Fineract may return the image as base64 string or in a specific format
            // Handle different response formats and convert to data URI if needed
            let imageUri: string | null = null;

            if (imageData && typeof imageData === "string") {
              // Remove quotes if JSON-wrapped string
              let cleanData = imageData.trim();
              if (
                (cleanData.startsWith('"') && cleanData.endsWith('"')) ||
                (cleanData.startsWith("'") && cleanData.endsWith("'"))
              ) {
                cleanData = cleanData.slice(1, -1);
              }

              // Direct base64 string - check if it's already a data URI
              if (cleanData.startsWith("data:image/")) {
                imageUri = cleanData;
              } else if (isBase64Like(cleanData)) {
                // Plain base64 string, convert to data URI
                // Remove any whitespace or newlines
                const cleanBase64 = cleanData.replace(/\s/g, "");
                imageUri = `data:image/jpeg;base64,${cleanBase64}`;
              } else {
                console.warn(
                  "String doesn't look like base64:",
                  cleanData.substring(0, 50)
                );
              }
            } else if (imageData?.imageData) {
              // Object with imageData property
              const imgData = imageData.imageData;
              if (typeof imgData === "string") {
                const cleanData = imgData.trim().replace(/\s/g, "");
                imageUri = cleanData.startsWith("data:image/")
                  ? cleanData
                  : `data:image/jpeg;base64,${cleanData}`;
              }
            } else if (
              Array.isArray(imageData) &&
              imageData.length > 0 &&
              imageData[0]?.imageData
            ) {
              // Array of images, get the first one
              const imgData = imageData[0].imageData;
              if (typeof imgData === "string") {
                const cleanData = imgData.trim().replace(/\s/g, "");
                imageUri = cleanData.startsWith("data:image/")
                  ? cleanData
                  : `data:image/jpeg;base64,${cleanData}`;
              }
            } else if (imageData?.base64EncodedImage) {
              // Object with base64EncodedImage property
              const imgData = imageData.base64EncodedImage;
              if (typeof imgData === "string") {
                const cleanData = imgData.trim().replace(/\s/g, "");
                imageUri = cleanData.startsWith("data:image/")
                  ? cleanData
                  : `data:image/jpeg;base64,${cleanData}`;
              }
            }

            if (imageUri) {
              console.log(
                "Setting existing client image, URI length:",
                imageUri.length,
                "starts with:",
                imageUri.substring(0, 30)
              );
              setExistingClientImage(imageUri);
              setSelfieImageLoading(true);
            } else {
              console.warn(
                "Could not parse image data from response. Full data:",
                imageData
              );
              setExistingClientImage(null);
              setSelfieImageLoading(false);
            }
          } else {
            // Handle error responses
            if (imageResponse.status === 404) {
              console.log("No image found (404)");
              setExistingClientImage(null);
              setSelfieImageLoading(false);
            } else {
              const errorData = await imageResponse.json().catch(() => ({}));
              console.error(
                "Error fetching client image:",
                imageResponse.status,
                errorData
              );
            }
          }
        } catch (imageError) {
          console.error("Exception while fetching client image:", imageError);
        }

        // Fetch addresses for the client
        const addressesResponse = await fetch(
          `/api/fineract/clients/${clientId}/addresses`
        );
        if (addressesResponse.ok) {
          const addressesData = await addressesResponse.json();
          // Fineract returns an array of addresses, get the first one or null
          let address = Array.isArray(addressesData)
            ? addressesData[0] || null
            : addressesData || null;

          // Convert addressType string to ID if needed (Fineract returns addressType as string like "Home ")
          if (
            address &&
            address.addressType &&
            typeof address.addressType === "string" &&
            templateData
          ) {
            const addressTypeOptions = templateData?.addressTypeIdOptions || [];
            const matchingType = addressTypeOptions.find(
              (opt: any) => opt.name?.trim() === address.addressType?.trim()
            );
            if (matchingType && matchingType.id) {
              address = {
                ...address,
                addressType: matchingType.id, // Convert string to numeric ID
              };
              console.log(
                "Converted addressType from string to ID on load:",
                matchingType.id,
                "for:",
                matchingType.name
              );
            }
          }

          setClientAddress(address);
        }

        // Fetch available data tables for this client
        const datatablesResponse = await fetch(
          `/api/fineract/datatables?apptable=m_client`
        );
        if (datatablesResponse.ok) {
          const datatablesData = await datatablesResponse.json();
          console.log("Fetched data tables:", datatablesData);

          // Handle different response formats - could be array or object with array property
          const tablesList = Array.isArray(datatablesData)
            ? datatablesData
            : datatablesData?.data || datatablesData?.pageItems || [];

          console.log("Data tables list:", tablesList);

          // Filter to only get datatables that have data for this client
          const tablesWithData = await Promise.all(
            (tablesList || []).map(async (table: any) => {
              try {
                // Use registeredTableName as the table name (this is what Fineract uses in the API)
                const tableName = table.registeredTableName;
                if (!tableName) {
                  console.warn("Table missing registeredTableName:", table);
                  return { ...table, hasData: false };
                }

                const tableDataResponse = await fetch(
                  `/api/fineract/datatables/${encodeURIComponent(
                    tableName
                  )}/${clientId}?genericResultSet=true`
                );
                if (tableDataResponse.ok) {
                  const tableData = await tableDataResponse.json();
                  const hasData = tableData.data && tableData.data.length > 0;
                  console.log(`Table ${tableName} has data:`, hasData);
                  return {
                    ...table,
                    datatableName: tableName, // Store for use in DynamicDatatableContent
                    displayName: table.registeredTableName, // Display name
                    hasData: hasData,
                  };
                }
                return {
                  ...table,
                  datatableName: tableName,
                  displayName: table.registeredTableName,
                  hasData: false,
                };
              } catch (error) {
                console.error(
                  `Error checking table ${table.registeredTableName}:`,
                  error
                );
                return { ...table, hasData: false };
              }
            })
          );
          // Show all tables, not just those with data
          console.log("All available tables:", tablesWithData);
          setDataTables(tablesWithData);
        } else {
          console.error(
            "Failed to fetch data tables:",
            datatablesResponse.status,
            datatablesResponse.statusText
          );
        }
      } catch (error) {
        console.error("Error fetching additional details:", error);
        // Don't let this error break the page - set sensible defaults
        setExistingIdentifiers([]);
        setIdentifierDocuments(new Map());
        setClientDocuments([]);
        setDataTables([]);
      } finally {
        setIsLoadingAdditionalDetails(false);
      }
    };

    if (clientCreatedInFineract) {
      // Wrap in try-catch to prevent unhandled promise rejections
      fetchAdditionalDetails().catch((error) => {
        console.error("Unhandled error in fetchAdditionalDetails:", error);
        setIsLoadingAdditionalDetails(false);
      });
    }
  }, [clientCreatedInFineract]);

  // State for dropdown options
  const [offices, setOffices] = useState<any[]>([]);
  const [legalForms, setLegalForms] = useState<any[]>([]);
  const [genders, setGenders] = useState<any[]>([]);
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);
  const [clientTypes, setClientTypes] = useState<any[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [clientClassifications, setClientClassifications] = useState<any[]>([]);
  const [savingsProducts, setSavingsProducts] = useState<any[]>([]);
  const [relationships, setRelationships] = useState<any[]>([]);

  // State for additional details tab
  const [fineractClientId, setFineractClientId] = useState<number | null>(null);
  const [clientAddress, setClientAddress] = useState<any>(null);
  const [dataTables, setDataTables] = useState<any[]>([]);
  const [isLoadingAdditionalDetails, setIsLoadingAdditionalDetails] =
    useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editedAddress, setEditedAddress] = useState<any>({});
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressFieldConfig, setAddressFieldConfig] = useState<any[]>([]);
  const [addressTemplate, setAddressTemplate] = useState<any>(null);
  const [showAddAddressTypeDialog, setShowAddAddressTypeDialog] =
    useState(false);
  const [showAddStateProvinceDialog, setShowAddStateProvinceDialog] =
    useState(false);
  const [showAddCountryDialog, setShowAddCountryDialog] = useState(false);

  // State for KYC
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [existingClientImage, setExistingClientImage] = useState<string | null>(
    null
  );
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [selfieImageLoading, setSelfieImageLoading] = useState(true);
  const [identityDocuments, setIdentityDocuments] = useState<
    Array<{
      id?: string;
      name: string;
      file: File;
      preview: string;
      documentTypeId?: number;
      documentTypeName?: string;
    }>
  >([]);
  const [existingIdentifiers, setExistingIdentifiers] = useState<any[]>([]);
  const [clientDocuments, setClientDocuments] = useState<any[]>([]);
  const [isLoadingKYC, setIsLoadingKYC] = useState(false);
  // Map of identifierId -> documents array
  const [identifierDocuments, setIdentifierDocuments] = useState<
    Map<number, any[]>
  >(new Map());
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [identifiersTemplate, setIdentifiersTemplate] = useState<any>(null);
  const [showDocumentTypeDialog, setShowDocumentTypeDialog] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState<
    number | null
  >(null);
  const [showAddIdentifierDialog, setShowAddIdentifierDialog] = useState(false);
  const [addingIdentifier, setAddingIdentifier] = useState(false);

  // Section completion tracking
  const [sectionCompletion, setSectionCompletion] = useState({
    administrative: false,
    personal: false,
    contact: false,
    classification: false,
    additional: false,
    selfie: false,
    identityDocuments: false,
    otherDocuments: false,
    datatables: false,
  });

  // Track which sections have been saved (not just completed)
  const [sectionSaved, setSectionSaved] = useState({
    administrative: false,
    personal: false,
    contact: false,
    classification: false,
    additional: false,
    selfie: false,
    identityDocuments: false,
    otherDocuments: false,
    datatables: false,
  });

  const [newIdentifier, setNewIdentifier] = useState({
    documentTypeId: "",
    documentKey: "",
    description: "",
    status: "active" as "active" | "inactive",
    documentFile: null as File | null,
    documentFileName: "",
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Helper function to format field names
  const formatHeaderName = (name: string) => {
    // Convert camelCase or snake_case to Title Case
    return name
      .replace(/([A-Z])/g, " $1")
      .replace(/_/g, " ")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  // Section completion validation functions
  const checkAdministrativeSection = () => {
    const values = form.getValues();
    return !!(values.officeId && values.legalFormId && values.activationDate);
  };

  const checkPersonalSection = () => {
    const values = form.getValues();
    return !!(
      values.firstname &&
      values.lastname &&
      values.dateOfBirth &&
      values.genderId
    );
  };

  const checkContactSection = () => {
    const values = form.getValues();
    return !!(values.mobileNo && values.emailAddress);
  };

  const checkClassificationSection = () => {
    const values = form.getValues();
    // Only clientTypeId is required, clientClassificationId is optional
    return !!values.clientTypeId;
  };

  const checkAdditionalSection = () => {
    const values = form.getValues();
    return !!values.submittedOnDate;
  };

  const checkSelfieSection = () => {
    return !!(existingClientImage || selfieImage);
  };

  const checkIdentityDocumentsSection = () => {
    return existingIdentifiers.length > 0;
  };

  const checkOtherDocumentsSection = () => {
    // Optional section - always return true
    return true;
  };

  const checkDatatablesSection = () => {
    // Optional section - always return true for now
    return true;
  };

  // Helper function to get section status: 'incomplete', 'pending', or 'saved'
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

  // Check overall tab completion
  const checkGeneralTabCompletion = () => {
    return (
      sectionCompletion.administrative &&
      sectionCompletion.personal &&
      sectionCompletion.contact &&
      sectionCompletion.classification &&
      sectionCompletion.additional
    );
  };

  const checkKYCTabCompletion = () => {
    return sectionCompletion.selfie && sectionCompletion.identityDocuments;
  };

  const checkAdditionalDetailsTabCompletion = () => {
    return sectionCompletion.datatables;
  };

  const checkAllSectionsComplete = () => {
    const generalComplete = checkGeneralTabCompletion();
    const kycComplete = checkKYCTabCompletion();
    const additionalComplete = clientCreatedInFineract
      ? checkAdditionalDetailsTabCompletion()
      : true; // Skip if not yet created

    return generalComplete && kycComplete && additionalComplete;
  };

  // Notify parent when all sections are complete
  useEffect(() => {
    if (onAllSectionsComplete) {
      const isComplete = checkAllSectionsComplete();
      onAllSectionsComplete(isComplete);
    }
  }, [sectionCompletion, clientCreatedInFineract, onAllSectionsComplete]);

  // Helper function to extract identifier ID from document filename
  // NOTE: This is kept for backward compatibility with documents uploaded using the old method.
  // New documents uploaded via /client_identifiers/{id}/documents endpoint are properly linked
  // and should be fetched using the identifier's documents endpoint instead.
  // Format: IDENTIFIER_{identifierId}_{documentKey}_{timestamp}_{originalFilename}
  const extractIdentifierIdFromFilename = (filename: string): number | null => {
    const match = filename.match(/^IDENTIFIER_(\d+)_/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  };

  // Handle document download
  const handleDownloadDocument = async (
    documentId: string,
    fileName: string,
    identifierId?: number
  ) => {
    if (!fineractClientId) {
      error({
        title: "Error",
        description: "Client ID not available",
      });
      return;
    }

    try {
      // Use identifier documents endpoint if identifierId is provided
      const url = identifierId
        ? `/api/fineract/client_identifiers/${identifierId}/documents/${documentId}/attachment`
        : `/api/fineract/clients/${fineractClientId}/documents/${documentId}/attachment`;

      const response = await fetch(url);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName || `document_${documentId}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        success({
          title: "Success",
          description: "Document downloaded successfully!",
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = "Failed to download document";
        if (errorData?.error) {
          errorMessage = errorData.error;
        } else if (errorData?.defaultUserMessage) {
          errorMessage = errorData.defaultUserMessage;
        }
        error({
          title: "Download Failed",
          description: errorMessage,
        });
      }
    } catch (err: any) {
      console.error("Error downloading document:", err);
      error({
        title: "Download Failed",
        description: err?.message || "Failed to download document",
      });
    }
  };

  // State for inline document preview
  const [previewingDocumentId, setPreviewingDocumentId] = useState<
    string | null
  >(null);
  const [previewingIdentifierId, setPreviewingIdentifierId] = useState<
    number | null
  >(null);

  // Handle document view (toggles inline preview)
  const handleViewDocument = (
    documentId: string | number,
    identifierId?: number
  ) => {
    const docIdStr = String(documentId);
    if (
      previewingDocumentId === docIdStr &&
      previewingIdentifierId === (identifierId || null)
    ) {
      // If already previewing this document, close it
      setPreviewingDocumentId(null);
      setPreviewingIdentifierId(null);
    } else {
      // Open preview for this document
      setPreviewingDocumentId(docIdStr);
      setPreviewingIdentifierId(identifierId || null);
    }
  };

  // State for adding documents to existing identifiers
  const [addingDocumentToIdentifier, setAddingDocumentToIdentifier] = useState<
    number | null
  >(null);
  const [deletingIdentifierId, setDeletingIdentifierId] = useState<
    number | null
  >(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [identifierToDelete, setIdentifierToDelete] = useState<number | null>(
    null
  );

  // Handle opening delete confirmation dialog
  const handleDeleteIdentifierClick = (identifierId: number) => {
    setIdentifierToDelete(identifierId);
    setShowDeleteConfirmDialog(true);
  };

  // Handle confirming and deleting an identifier
  const handleConfirmDeleteIdentifier = async () => {
    if (!fineractClientId || !identifierToDelete) {
      error({
        title: "Error",
        description: "Client ID or identifier not available",
      });
      setShowDeleteConfirmDialog(false);
      setIdentifierToDelete(null);
      return;
    }

    const identifierId = identifierToDelete;
    setDeletingIdentifierId(identifierId);
    setShowDeleteConfirmDialog(false);
    try {
      const response = await fetch(
        `/api/fineract/clients/${fineractClientId}/identifiers/${identifierId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        success({
          title: "Success",
          description: "Identifier deleted successfully",
        });

        // Refresh identifiers and their documents
        const [identifiersResponse] = await Promise.all([
          fetch(`/api/fineract/clients/${fineractClientId}/identifiers`),
        ]);

        if (identifiersResponse.ok) {
          const identifiersData = await identifiersResponse.json();
          let identifiers = [];
          if (Array.isArray(identifiersData)) {
            identifiers = identifiersData;
          } else if (identifiersData?.pageItems) {
            identifiers = identifiersData.pageItems;
          } else if (identifiersData?.identifiers) {
            identifiers = identifiersData.identifiers;
          } else if (identifiersData?.data) {
            identifiers = Array.isArray(identifiersData.data)
              ? identifiersData.data
              : [];
          }

          const documentsMap = new Map<number, any[]>();
          const fetchPromises = identifiers.map(async (identifier: any) => {
            const id = identifier.id;
            if (!id) return;

            try {
              const docsResponse = await fetch(
                `/api/fineract/client_identifiers/${id}/documents`
              );
              if (docsResponse.ok) {
                const docsData = await docsResponse.json();
                let docs = [];
                if (Array.isArray(docsData)) {
                  docs = docsData;
                } else if (docsData?.pageItems) {
                  docs = docsData.pageItems;
                } else if (docsData?.content) {
                  docs = docsData.content;
                } else if (docsData?.documents) {
                  docs = docsData.documents;
                }
                documentsMap.set(id, docs);
              } else {
                documentsMap.set(id, []);
              }
            } catch (error) {
              console.error(
                `Exception fetching documents for identifier ${id}:`,
                error
              );
              documentsMap.set(id, []);
            }
          });

          await Promise.all(fetchPromises);
          setIdentifierDocuments(documentsMap);
          setExistingIdentifiers(identifiers);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        error({
          title: "Delete Failed",
          description:
            errorData.error ||
            errorData.defaultUserMessage ||
            "Failed to delete identifier",
        });
      }
    } catch (err: any) {
      console.error("Error deleting identifier:", err);
      error({
        title: "Delete Failed",
        description: err?.message || "Failed to delete identifier",
      });
    } finally {
      setDeletingIdentifierId(null);
      setIdentifierToDelete(null);
    }
  };

  // Handle adding document to existing identifier
  const handleAddDocumentToIdentifier = async (
    identifierId: number,
    file: File,
    documentName?: string
  ) => {
    if (!fineractClientId) {
      error({
        title: "Error",
        description: "Client ID not available",
      });
      return;
    }

    setAddingDocumentToIdentifier(identifierId);
    try {
      const formData = new FormData();
      formData.append("name", documentName || file.name);
      formData.append("file", file);

      const response = await fetch(
        `/api/fineract/client_identifiers/${identifierId}/documents`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (response.ok) {
        success({
          title: "Success",
          description: "Document added to identifier successfully",
        });

        // Refresh documents for this identifier
        const docsResponse = await fetch(
          `/api/fineract/client_identifiers/${identifierId}/documents`
        );
        if (docsResponse.ok) {
          const docsData = await docsResponse.json();
          let docs = [];
          if (Array.isArray(docsData)) {
            docs = docsData;
          } else if (docsData?.pageItems) {
            docs = docsData.pageItems;
          } else if (docsData?.content) {
            docs = docsData.content;
          } else if (docsData?.documents) {
            docs = docsData.documents;
          }
          setIdentifierDocuments((prev) => {
            const newMap = new Map(prev);
            newMap.set(identifierId, docs);
            return newMap;
          });
        }

        // Mark identity documents section as saved if it's complete
        setSectionCompletion((prevCompletion) => {
          if (prevCompletion.identityDocuments) {
            setSectionSaved((prevSaved) => ({
              ...prevSaved,
              identityDocuments: true,
            }));
          }
          return prevCompletion;
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        error({
          title: "Upload Failed",
          description:
            errorData.error ||
            errorData.defaultUserMessage ||
            "Failed to upload document",
        });
      }
    } catch (err: any) {
      console.error("Error adding document to identifier:", err);
      error({
        title: "Upload Failed",
        description: err?.message || "Failed to upload document",
      });
    } finally {
      setAddingDocumentToIdentifier(null);
    }
  };

  // State for add new dialogs
  const [showAddOfficeDialog, setShowAddOfficeDialog] = useState(false);
  const [showAddLegalFormDialog, setShowAddLegalFormDialog] = useState(false);
  const [showAddGenderDialog, setShowAddGenderDialog] = useState(false);
  const [showAddDocumentTypeDialog, setShowAddDocumentTypeDialog] =
    useState(false);
  const [showAddClientTypeDialog, setShowAddClientTypeDialog] = useState(false);
  const [
    showAddClientClassificationDialog,
    setShowAddClientClassificationDialog,
  ] = useState(false);
  const [showAddSavingsProductDialog, setShowAddSavingsProductDialog] =
    useState(false);
  const [showAddRelationshipDialog, setShowAddRelationshipDialog] =
    useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Local storage and prospect continuation state
  const [showProspectDialog, setShowProspectDialog] = useState(false);
  const [hasSeenProspectDialog, setHasSeenProspectDialog] = useState(false);
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

  // Use ref to track if we've already checked for prospect dialog (only check once)
  const hasCheckedProspectDialog = useRef(false);

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

  // Document type form
  const documentTypeForm = useForm<DocumentTypeFormValues>({
    resolver: zodResolver(documentTypeSchema) as any,
    defaultValues: {
      name: "",
      description: "",
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

  // Relationship form
  const relationshipForm = useForm<RelationshipFormValues>({
    resolver: zodResolver(relationshipSchema) as any,
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Address type form
  const addressTypeForm = useForm<{ name: string; description?: string }>({
    resolver: zodResolver(
      z.object({
        name: z.string().min(1, "Name is required"),
        description: z.string().optional(),
      })
    ) as any,
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Country form
  const countryForm = useForm<{ name: string; description?: string }>({
    resolver: zodResolver(
      z.object({
        name: z.string().min(1, "Name is required"),
        description: z.string().optional(),
      })
    ) as any,
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // State/Province form
  const stateProvinceForm = useForm<{ name: string; description?: string }>({
    resolver: zodResolver(
      z.object({
        name: z.string().min(1, "Name is required"),
        description: z.string().optional(),
      })
    ) as any,
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

  // Merge document types from module codes and template
  const templateDocumentTypes = identifiersTemplate?.documentTypeOptions || [];
  const allDocumentTypes = [
    ...documentTypes,
    ...templateDocumentTypes.filter(
      (templateType: any) =>
        !documentTypes.some((docType) => docType.id === templateType.id)
    ),
  ];

  // Get document type IDs that are already used by existing identifiers
  const usedDocumentTypeIds = new Set(
    existingIdentifiers
      .map(
        (identifier: any) =>
          identifier.documentType?.id || identifier.documentTypeId
      )
      .filter((id: any) => id != null)
      .map((id: any) => id.toString())
  );

  const documentTypeOptions = allDocumentTypes.map((docType: any) => {
    const docTypeId = docType.id.toString();
    const isUsed = usedDocumentTypeIds.has(docTypeId);
    return {
      value: docTypeId,
      label: docType.name || docType.value || `Type ${docType.id}`,
      disabled: isUsed,
    };
  });

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

  const relationshipOptions = relationships.map((relationship) => ({
    value: relationship.name,
    label: relationship.name,
  }));

  const savingsProductOptions = savingsProducts.map((product) => ({
    value: product.id.toString(),
    label: product.name,
  }));

  // Check for existing prospects on mount - ONLY ONCE
  useEffect(() => {
    // Only run this check once on initial mount
    if (hasCheckedProspectDialog.current) {
      console.log("Already checked for prospect dialog, skipping");
      return;
    }

    hasCheckedProspectDialog.current = true;

    const checkExistingProspect = async () => {
      console.log("Checking for existing prospect on initial mount...", {
        leadId,
        currentLeadId,
        localStorageExists: LeadLocalStorage.exists(),
        isExpired: LeadLocalStorage.isExpired(),
      });

      // Only show dialog if:
      // 1. No leadId in URL (new form)
      // 2. There's a draft in localStorage
      // 3. The localStorage draft is NOT the current lead being worked on
      if (
        !leadId &&
        !hasSeenProspectDialog &&
        LeadLocalStorage.exists() &&
        !LeadLocalStorage.isExpired()
      ) {
        const existingData = LeadLocalStorage.load();
        console.log("Found existing data in localStorage:", existingData);

        if (existingData) {
          // Check if this is the SAME lead we're already working on
          if (existingData.leadId === currentLeadId) {
            console.log(
              "Same lead in localStorage - already working on it, skipping dialog"
            );
            return;
          }

          // Different lead - show the dialog
          try {
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
              setHasSeenProspectDialog(true);
              console.log("Showing prospect continuation dialog");
            } else {
              console.log("Lead not found on server, clearing localStorage");
              LeadLocalStorage.clear();
            }
          } catch (error) {
            console.error("Error fetching existing prospect:", error);
            LeadLocalStorage.clear();
          }
        }
      } else {
        console.log("No existing prospect check needed:", {
          hasLeadId: !!leadId,
          hasSeenDialog: hasSeenProspectDialog,
          localStorageExists: LeadLocalStorage.exists(),
          isExpired: LeadLocalStorage.isExpired(),
        });
      }
    };

    checkExistingProspect();
  }, []); // Empty dependency array - only run once on mount

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
          const documentTypesData = await getDocumentTypes();
          const clientTypesData = await getClientTypes();
          const clientClassificationsData = await getClientClassifications();
          const savingsProductsData = await getSavingsProducts();
          const relationshipsData = await getRelationships();

          // Set state with fetched data
          setOffices(officesData as any[]);
          setLegalForms(legalFormsData as any[]);
          setGenders(gendersData as any[]);
          setDocumentTypes(documentTypesData as any[]);
          setClientTypes(clientTypesData as any[]);
          setClientClassifications(clientClassificationsData as any[]);
          setSavingsProducts(savingsProductsData as any[]);
          setRelationships(relationshipsData as any[]);

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

        setIsLoadingOptions(false);

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

            // Mark sections as saved if they are complete (data is coming from server)
            // Wait a bit for form state to update, then check completion
            setTimeout(() => {
              const adminComplete = checkAdministrativeSection();
              const personalComplete = checkPersonalSection();
              const contactComplete = checkContactSection();
              const classificationComplete = checkClassificationSection();
              const additionalComplete = checkAdditionalSection();

              setSectionCompletion((prevCompletion) => {
                const newCompletion = {
                  ...prevCompletion,
                  administrative: adminComplete,
                  personal: personalComplete,
                  contact: contactComplete,
                  classification: classificationComplete,
                  additional: additionalComplete,
                };

                // Mark sections as saved if they are complete
                setSectionSaved((prevSaved) => ({
                  ...prevSaved,
                  administrative: adminComplete,
                  personal: personalComplete,
                  contact: contactComplete,
                  classification: classificationComplete,
                  additional: additionalComplete,
                }));

                return newCompletion;
              });
            }, 100);

            // Trigger actual lookup if externalId exists
            if (lead.externalId) {
              console.log(
                "==========> Resuming prospect with externalId:",
                lead.externalId
              );
              console.log(
                "==========> Triggering lookup to determine client state..."
              );

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
                    `/api/fineract/clients/external-id`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ externalId: lead.externalId }),
                    }
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
                    const searchResponse = await fetch(
                      "/api/fineract/clients/search",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          text: lead.externalId,
                          page: 0,
                          size: 50,
                        }),
                      }
                    );

                    if (searchResponse.ok) {
                      const searchData = await searchResponse.json();
                      if (
                        searchData.pageItems &&
                        searchData.pageItems.length > 0
                      ) {
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
                    `/api/leads/search-by-external-id?externalId=${encodeURIComponent(
                      lead.externalId
                    )}`
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
                  console.log(
                    "==========> Lookup successful - client found in Fineract or local DB"
                  );

                  // Helper function to check if a value is meaningful
                  const hasValue = (value: any): boolean => {
                    return (
                      value !== null && value !== undefined && value !== ""
                    );
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
                    console.log(
                      "==========> Setting clientCreatedInFineract to true"
                    );

                    setClientLookupStatus("found");
                    setIsFormDisabled(false);

                    // Update parent component's state
                    if (setFormCompletionStatus) {
                      setFormCompletionStatus((prev) => ({
                        ...prev,
                        client: true,
                      }));
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
                    console.log(
                      "==========> Client exists in local DB but not in Fineract"
                    );
                    setClientLookupStatus("not_found");
                    setIsFormDisabled(false);
                  } else {
                    // No data found
                    console.log("==========> No client data found");
                    setClientLookupStatus("not_found");
                    setIsFormDisabled(false);
                  }
                } else {
                  console.log(
                    "==========> No client found in Fineract or local DB"
                  );
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
    setHasSeenProspectDialog(true);
  };

  // Handle field blur for auto-save
  // Helper function to determine which section a field belongs to
  const getSectionForField = (
    fieldName: string
  ): keyof typeof sectionSaved | null => {
    const administrativeFields = ["officeId", "legalFormId", "activationDate"];
    const personalFields = [
      "firstname",
      "lastname",
      "middlename",
      "dateOfBirth",
      "genderId",
    ];
    const contactFields = ["mobileNo", "emailAddress", "countryCode"];
    const classificationFields = ["clientTypeId", "clientClassificationId"];
    const additionalFields = [
      "submittedOnDate",
      "isStaff",
      "openSavingsAccount",
      "savingsProductId",
    ];

    if (administrativeFields.includes(fieldName)) return "administrative";
    if (personalFields.includes(fieldName)) return "personal";
    if (contactFields.includes(fieldName)) return "contact";
    if (classificationFields.includes(fieldName)) return "classification";
    if (additionalFields.includes(fieldName)) return "additional";
    return null;
  };

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

        // Mark the relevant section as saved if it's complete
        const section = getSectionForField(fieldName);
        if (section) {
          setSectionCompletion((prevCompletion) => {
            if (prevCompletion[section]) {
              setSectionSaved((prevSaved) => ({
                ...prevSaved,
                [section]: true,
              }));
            }
            return prevCompletion;
          });
        }
      }
    } catch (error) {
      console.error("Error auto-saving field:", error);
    } finally {
      setTimeout(() => {
        setIsAutoSaving(false);
      }, 1000); // Show saving indicator for at least 1 second
    }
  };

  // Handle phone number changes with automatic country code detection
  const handlePhoneNumberChange = (value: string) => {
    // Parse the phone number to detect country code
    const parsed = parsePhoneNumber(value);

    // Update country code if detected (and different from current)
    if (parsed.countryCode) {
      const currentCountryCode = externalForm
        ? externalForm.getValues("countryCode")
        : form.getValues("countryCode");

      if (parsed.countryCode !== currentCountryCode) {
        if (externalForm) {
          externalForm.setValue("countryCode", parsed.countryCode);
        } else {
          form.setValue("countryCode", parsed.countryCode);
        }
      }
    }

    // Format and set the phone number (without country code)
    const formattedNumber = formatPhoneNumber(parsed.number);
    if (externalForm) {
      externalForm.setValue("mobileNo", formattedNumber, {
        shouldValidate: false,
      });
    } else {
      form.setValue("mobileNo", formattedNumber, { shouldValidate: false });
    }
  };

  // Handle client lookup by National ID
  const handleClientLookup = async () => {
    if (!nationalIdLookup.trim()) {
      validationError("Please enter a national ID number");
      return;
    }

    // Clear all internal storage when ID number search is initiated
    setFamilyMembers([]);
    setExistingClientImage(null);
    setSelfieImage(null);
    setExistingIdentifiers([]);
    setClientDocuments([]);
    setIdentifierDocuments(new Map());
    setSectionSaved({
      administrative: false,
      personal: false,
      contact: false,
      classification: false,
      additional: false,
      selfie: false,
      identityDocuments: false,
      otherDocuments: false,
      datatables: false,
    });
    setSectionCompletion({
      administrative: false,
      personal: false,
      contact: false,
      classification: false,
      additional: false,
      selfie: false,
      identityDocuments: false,
      otherDocuments: false,
      datatables: false,
    });

    setIsSearchingClient(true);
    setClientLookupStatus("idle");

    try {
      let fineractData: any = null;
      let localData: any = null;

      // Step 1: Try to get client details from Fineract (PRIMARY SOURCE)
      console.log("==========> Trying to get client details from Fineract");
      try {
        console.log(
          "==========> Trying to get client details from Fineract by external ID"
        );
        console.log(
          "==========> [CLIENT] Making POST request to /api/fineract/clients/external-id"
        );
        console.log("==========> [CLIENT] Request body:", {
          externalId: nationalIdLookup,
        });
        console.log(
          "==========> [CLIENT] Full URL:",
          `${window.location.origin}/api/fineract/clients/external-id`
        );

        const externalIdResponse = await fetch(
          `/api/fineract/clients/external-id`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ externalId: nationalIdLookup }),
          }
        );

        console.log(
          "==========> [CLIENT] Response status:",
          externalIdResponse.status
        );
        console.log("==========> [CLIENT] Response ok:", externalIdResponse.ok);

        if (externalIdResponse.ok) {
          // Client found by external ID - this gives us the email address
          const clientData = await externalIdResponse.json();

          console.log(
            "==========> Client data found by external ID from Fineract:",
            clientData
          );

          // Now we need to get the FULL client details using the client ID
          // This will give us gender, client type, classification, etc.
          const fullClientResponse = await fetch(
            `/api/fineract/clients/${clientData.id}`
          );

          console.log("==========> Full client response:", fullClientResponse);

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
          `/api/leads/search-by-external-id?externalId=${encodeURIComponent(
            nationalIdLookup
          )}`
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
          // Phone number from Fineract - parse if it includes country code
          ...(() => {
            const phoneNumber = getBestValue(
              fineractData?.mobileNo,
              localData?.mobileNo
            );
            const existingCountryCode = getBestValue(
              fineractData?.countryCode,
              localData?.countryCode,
              "+263"
            );

            // If we have a phone number, try to parse it
            if (phoneNumber) {
              const parsed = parsePhoneNumber(phoneNumber);
              // If parsing detected a country code, use it; otherwise use existing
              const finalCountryCode =
                parsed.countryCode !== "+263" || !existingCountryCode
                  ? parsed.countryCode
                  : existingCountryCode;

              return {
                mobileNo: formatPhoneNumber(parsed.number),
                countryCode: finalCountryCode,
              };
            }

            return {
              mobileNo: phoneNumber || "",
              countryCode: existingCountryCode,
            };
          })(),
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
          submittedOnDate: fineractData?.timeline?.submittedOnDate
            ? Array.isArray(fineractData.timeline.submittedOnDate)
              ? (() => {
                  const [year, month, day] =
                    fineractData.timeline.submittedOnDate;
                  // Create date at midnight to avoid timezone issues
                  return new Date(Date.UTC(year, month - 1, day));
                })()
              : new Date(fineractData.timeline.submittedOnDate)
            : fineractData?.submittedOnDate
            ? Array.isArray(fineractData.submittedOnDate)
              ? (() => {
                  const [year, month, day] = fineractData.submittedOnDate;
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
            : fineractData?.timeline?.activatedOnDate
            ? Array.isArray(fineractData.timeline.activatedOnDate)
              ? (() => {
                  const [year, month, day] =
                    fineractData.timeline.activatedOnDate;
                  return new Date(Date.UTC(year, month - 1, day));
                })()
              : new Date(fineractData.timeline.activatedOnDate)
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

        // Mark sections as saved if they are complete (data is coming from server)
        // Wait a bit for form state to update, then check completion
        setTimeout(() => {
          const adminComplete = checkAdministrativeSection();
          const personalComplete = checkPersonalSection();
          const contactComplete = checkContactSection();
          const classificationComplete = checkClassificationSection();
          const additionalComplete = checkAdditionalSection();

          setSectionCompletion((prevCompletion) => {
            const newCompletion = {
              ...prevCompletion,
              administrative: adminComplete,
              personal: personalComplete,
              contact: contactComplete,
              classification: classificationComplete,
              additional: additionalComplete,
            };

            // Mark sections as saved if they are complete
            setSectionSaved((prevSaved) => ({
              ...prevSaved,
              administrative: adminComplete,
              personal: personalComplete,
              contact: contactComplete,
              classification: classificationComplete,
              additional: additionalComplete,
            }));

            return newCompletion;
          });
        }, 100);

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
  // Handle adding/updating family member
  const handleAddFamilyMember = async (
    data: FamilyMemberValues,
    memberId?: string
  ) => {
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
      let result;
      if (memberId) {
        // Update existing member
        result = await updateFamilyMember(memberId, data);
      } else {
        // Add new member
        result = await addFamilyMember(effectiveLeadId!, data);
      }

      if (result.success) {
        success({
          title: "Success",
          description: memberId
            ? "Family member updated"
            : "Family member added",
        });

        // Reset form
        familyMemberForm.reset();

        // Refresh family members
        const lead = await getLead(effectiveLeadId!);
        if (lead) {
          setFamilyMembers(lead.familyMembers || []);
        }
      } else {
        error({
          title: "Error",
          description:
            result.error ||
            (memberId
              ? "Failed to update family member"
              : "Failed to add family member"),
        });
      }
    } catch (err) {
      console.error("Error saving family member:", err);
      error({
        title: "Error",
        description: "An unexpected error occurred",
      });
    }
  };

  // KYC Handlers
  // Check section completion whenever form values or related state changes
  // Watch specific fields individually to avoid infinite loops
  const officeId = form.watch("officeId");
  const legalFormId = form.watch("legalFormId");
  const activationDate = form.watch("activationDate");
  const firstname = form.watch("firstname");
  const lastname = form.watch("lastname");
  const dateOfBirth = form.watch("dateOfBirth");
  const genderId = form.watch("genderId");
  const mobileNo = form.watch("mobileNo");
  const emailAddress = form.watch("emailAddress");
  const clientTypeId = form.watch("clientTypeId");
  const submittedOnDate = form.watch("submittedOnDate");

  useEffect(() => {
    const checkSections = () => {
      const newCompletion = {
        administrative: checkAdministrativeSection(),
        personal: checkPersonalSection(),
        contact: checkContactSection(),
        classification: checkClassificationSection(),
        additional: checkAdditionalSection(),
        selfie: checkSelfieSection(),
        identityDocuments: checkIdentityDocumentsSection(),
        otherDocuments: checkOtherDocumentsSection(),
        datatables: checkDatatablesSection(),
      };

      // Reset saved status for sections whose completion status changed
      setSectionCompletion((prevCompletion) => {
        setSectionSaved((prevSaved) => {
          const newSaved = { ...prevSaved };
          // If a section's completion status changed, mark it as not saved
          Object.keys(newCompletion).forEach((key) => {
            const sectionKey = key as keyof typeof newCompletion;
            if (newCompletion[sectionKey] !== prevCompletion[sectionKey]) {
              // Completion status changed, reset saved status
              newSaved[sectionKey] = false;
            }
          });
          return newSaved;
        });
        return newCompletion;
      });

      // Update parent form completion status
      // Calculate completion using newCompletion directly instead of reading from state
      if (setFormCompletionStatus) {
        const generalComplete =
          newCompletion.administrative &&
          newCompletion.personal &&
          newCompletion.contact &&
          newCompletion.classification &&
          newCompletion.additional;

        const kycComplete =
          newCompletion.selfie && newCompletion.identityDocuments;

        const additionalComplete = clientCreatedInFineract
          ? newCompletion.datatables
          : true;

        const allComplete =
          generalComplete && kycComplete && additionalComplete;

        setFormCompletionStatus((prev: any) => ({
          ...prev,
          client: allComplete,
        }));
      }
    };

    checkSections();
  }, [
    officeId,
    legalFormId,
    activationDate,
    firstname,
    lastname,
    dateOfBirth,
    genderId,
    mobileNo,
    emailAddress,
    clientTypeId,
    submittedOnDate,
    existingClientImage,
    selfieImage,
    existingIdentifiers,
    clientCreatedInFineract,
  ]);

  const handleSelfieFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelfieImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCaptureSelfie = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/png");
    setCapturedImage(dataUrl);

    // Stop camera
    const stream = video.srcObject as MediaStream;
    stream.getTracks().forEach((track) => track.stop());
  };

  const handleStartCamera = async () => {
    setShowCameraModal(true);
    setCapturedImage(null);

    // Wait for modal to open before accessing camera
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        error({
          title: "Camera Error",
          description: "Could not access camera. Please check permissions.",
        });
        setShowCameraModal(false);
      }
    }, 100);
  };

  const handleStopCamera = () => {
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream?.getTracks().forEach((track) => track.stop());
    }
    setShowCameraModal(false);
    setCapturedImage(null);
  };

  const handleConfirmCapture = () => {
    if (capturedImage) {
      setSelfieImage(capturedImage);
      setShowCameraModal(false);
      setCapturedImage(null);
    }
  };

  const handleRetakePhoto = async () => {
    setCapturedImage(null);
    // Restart camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      error({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
      });
    }
  };

  const handleUploadSelfie = async () => {
    if (!selfieImage || !fineractClientId) {
      error({
        title: "Error",
        description: "Please capture or select a selfie first",
      });
      return;
    }

    setUploadingSelfie(true);
    try {
      const response = await fetch(
        `/api/fineract/clients/${fineractClientId}/images`,
        {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
          },
          body: selfieImage,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to upload selfie");
      }

      success({
        title: "Success",
        description: "Selfie uploaded successfully",
      });

      // Update existing image state after successful upload
      setExistingClientImage(selfieImage);
      setSelfieImageLoading(true);
      setSelfieImage(null);

      // Mark selfie section as saved if it's complete
      setSectionCompletion((prevCompletion) => {
        if (prevCompletion.selfie) {
          setSectionSaved((prevSaved) => ({
            ...prevSaved,
            selfie: true,
          }));
        }
        return prevCompletion;
      });
    } catch (err: any) {
      console.error("Error uploading selfie:", err);
      error({
        title: "Error",
        description: err.message || "Failed to upload selfie",
      });
    } finally {
      setUploadingSelfie(false);
    }
  };

  const handleAddIdentityDocument = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || !fineractClientId) {
      if (!fineractClientId) {
        error({
          title: "Error",
          description:
            "Client ID not available. Please create the client first.",
        });
      }
      e.target.value = "";
      return;
    }

    const validFiles = Array.from(files).filter(
      (file) =>
        file.type.startsWith("image/") || file.type === "application/pdf"
    );

    if (validFiles.length === 0) {
      error({
        title: "Invalid File",
        description: "Please select image or PDF files only.",
      });
      e.target.value = "";
      return;
    }

    setUploadingDocuments(true);
    try {
      // Upload each file directly to client documents endpoint
      const uploadPromises = validFiles.map(async (file) => {
        const formData = new FormData();
        formData.append("name", file.name);
        formData.append("file", file);

        const response = await fetch(
          `/api/fineract/clients/${fineractClientId}/documents`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error ||
              errorData.defaultUserMessage ||
              `Failed to upload ${file.name}`
          );
        }

        return response.json();
      });

      await Promise.all(uploadPromises);

      success({
        title: "Success",
        description: `${validFiles.length} document(s) uploaded successfully`,
      });

      // Refresh client documents
      try {
        const documentsResponse = await fetch(
          `/api/fineract/clients/${fineractClientId}/documents`
        );
        if (documentsResponse.ok) {
          const documentsData = await documentsResponse.json();
          let documents = [];
          if (Array.isArray(documentsData)) {
            documents = documentsData;
          } else if (documentsData?.pageItems) {
            documents = documentsData.pageItems;
          } else if (documentsData?.content) {
            documents = documentsData.content;
          } else if (documentsData?.documents) {
            documents = documentsData.documents;
          }
          setClientDocuments(documents);
        }
      } catch (refreshError) {
        console.error("Error refreshing documents:", refreshError);
      }
    } catch (uploadError: any) {
      console.error("Error uploading documents:", uploadError);
      error({
        title: "Upload Failed",
        description: uploadError?.message || "Failed to upload documents",
      });
    } finally {
      setUploadingDocuments(false);
      e.target.value = "";
    }
  };

  const handleConfirmDocumentType = () => {
    if (!selectedDocumentType || pendingFiles.length === 0) return;

    // Find the document type name
    const documentType = identifiersTemplate?.documentTypeOptions?.find(
      (opt: any) => opt.id === selectedDocumentType
    );

    // Add all pending files with the selected document type
    pendingFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdentityDocuments((prev) => [
          ...prev,
          {
            name: file.name,
            file,
            preview: reader.result as string,
            documentTypeId: selectedDocumentType,
            documentTypeName: documentType?.name || "Unknown",
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    // Reset state
    setPendingFiles([]);
    setSelectedDocumentType(null);
    setShowDocumentTypeDialog(false);
  };

  const handleRemoveIdentityDocument = (index: number) => {
    setIdentityDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle adding a new identifier
  const handleAddIdentifier = async () => {
    if (
      !fineractClientId ||
      !newIdentifier.documentTypeId ||
      !newIdentifier.documentKey.trim()
    ) {
      error({
        title: "Validation Error",
        description: "Document type and document key are required",
      });
      return;
    }

    setAddingIdentifier(true);
    try {
      const payload = {
        documentTypeId: Number(newIdentifier.documentTypeId),
        documentKey: newIdentifier.documentKey.trim(),
        description: newIdentifier.description.trim() || undefined,
        status: newIdentifier.status === "active" ? "Active" : "Inactive",
      };

      const response = await fetch(
        `/api/fineract/clients/${fineractClientId}/identifiers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        const identifierData = await response.json();
        const identifierId = identifierData?.resourceId || identifierData?.id;

        // If a document file was provided, upload it to the identifier
        if (newIdentifier.documentFile) {
          try {
            const documentFormData = new FormData();

            // Use the document name from the form, or fallback to the file name
            const documentName =
              newIdentifier.documentFileName.trim() ||
              newIdentifier.documentFile.name;
            documentFormData.append("name", documentName);
            documentFormData.append("file", newIdentifier.documentFile);

            const documentResponse = await fetch(
              `/api/fineract/client_identifiers/${identifierId}/documents`,
              {
                method: "POST",
                body: documentFormData,
              }
            );

            if (documentResponse.ok) {
              success({
                title: "Success",
                description: "Identifier and document added successfully",
              });
            } else {
              // Identifier was created but document upload failed
              const docErrorData = await documentResponse
                .json()
                .catch(() => ({}));

              // Extract specific error message
              let docErrorMessage = "Unknown error";
              if (docErrorData?.error) {
                docErrorMessage = docErrorData.error;
              } else if (
                docErrorData?.details?.errors &&
                Array.isArray(docErrorData.details.errors) &&
                docErrorData.details.errors.length > 0
              ) {
                docErrorMessage =
                  docErrorData.details.errors[0].defaultUserMessage ||
                  docErrorData.details.errors[0].developerMessage ||
                  docErrorMessage;
              } else if (docErrorData?.details?.defaultUserMessage) {
                docErrorMessage = docErrorData.details.defaultUserMessage;
              } else if (docErrorData?.defaultUserMessage) {
                docErrorMessage = docErrorData.defaultUserMessage;
              }

              error({
                title: "Partial Success",
                description: `Identifier added but document upload failed: ${docErrorMessage}`,
              });
            }
          } catch (docError: any) {
            console.error("Error uploading document:", docError);

            // Extract error message from exception
            let docErrorMessage = "Unknown error";
            if (docError?.message) {
              docErrorMessage = docError.message;
            } else if (
              docError?.errorData?.errors &&
              Array.isArray(docError.errorData.errors) &&
              docError.errorData.errors.length > 0
            ) {
              docErrorMessage =
                docError.errorData.errors[0].defaultUserMessage ||
                docError.errorData.errors[0].developerMessage ||
                docErrorMessage;
            } else if (docError?.errorData?.defaultUserMessage) {
              docErrorMessage = docError.errorData.defaultUserMessage;
            }

            error({
              title: "Partial Success",
              description: `Identifier added but document upload failed: ${docErrorMessage}`,
            });
          }
        } else {
          success({
            title: "Success",
            description: "Identifier added successfully",
          });
        }

        // Mark identity documents section as saved if it's complete
        setSectionCompletion((prevCompletion) => {
          if (prevCompletion.identityDocuments) {
            setSectionSaved((prevSaved) => ({
              ...prevSaved,
              identityDocuments: true,
            }));
          }
          return prevCompletion;
        });

        // Reset form
        setNewIdentifier({
          documentTypeId: "",
          documentKey: "",
          description: "",
          status: "active",
          documentFile: null,
          documentFileName: "",
        });
        setShowAddIdentifierDialog(false);

        // Refresh existing identifiers and documents
        const [identifiersResponse, documentsResponse] = await Promise.all([
          fetch(`/api/fineract/clients/${fineractClientId}/identifiers`),
          fetch(`/api/fineract/clients/${fineractClientId}/documents`),
        ]);

        // Fetch documents for all identifiers (including the newly added one)
        if (identifiersResponse.ok) {
          const identifiersData = await identifiersResponse.json();
          let identifiers = [];
          if (Array.isArray(identifiersData)) {
            identifiers = identifiersData;
          } else if (identifiersData?.pageItems) {
            identifiers = identifiersData.pageItems;
          } else if (identifiersData?.identifiers) {
            identifiers = identifiersData.identifiers;
          } else if (identifiersData?.data) {
            identifiers = Array.isArray(identifiersData.data)
              ? identifiersData.data
              : [];
          }

          const documentsMap = new Map<number, any[]>();
          const fetchPromises = identifiers.map(async (identifier: any) => {
            const identifierId = identifier.id;
            if (!identifierId) return;

            try {
              const docsResponse = await fetch(
                `/api/fineract/client_identifiers/${identifierId}/documents`
              );
              if (docsResponse.ok) {
                const docsData = await docsResponse.json();
                let docs = [];
                if (Array.isArray(docsData)) {
                  docs = docsData;
                } else if (docsData?.pageItems) {
                  docs = docsData.pageItems;
                } else if (docsData?.content) {
                  docs = docsData.content;
                } else if (docsData?.documents) {
                  docs = docsData.documents;
                }
                documentsMap.set(identifierId, docs);
              } else {
                documentsMap.set(identifierId, []);
              }
            } catch (error) {
              console.error(
                `Exception fetching documents for identifier ${identifierId}:`,
                error
              );
              documentsMap.set(identifierId, []);
            }
          });

          await Promise.all(fetchPromises);
          setIdentifierDocuments(documentsMap);
          setExistingIdentifiers(identifiers);
        }

        if (documentsResponse.ok) {
          const documentsData = await documentsResponse.json();
          let documents = [];
          if (Array.isArray(documentsData)) {
            documents = documentsData;
          } else if (documentsData?.pageItems) {
            documents = documentsData.pageItems;
          } else if (documentsData?.content) {
            documents = documentsData.content;
          } else if (documentsData?.documents) {
            documents = documentsData.documents;
          }
          setClientDocuments(documents);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));

        // Extract specific error message
        let errorMessage = "Failed to add identifier";

        if (errorData?.error) {
          errorMessage = errorData.error;
        } else if (
          errorData?.details?.errors &&
          Array.isArray(errorData.details.errors) &&
          errorData.details.errors.length > 0
        ) {
          // Extract from errors array
          errorMessage =
            errorData.details.errors[0].defaultUserMessage ||
            errorData.details.errors[0].developerMessage ||
            errorMessage;
        } else if (errorData?.details?.defaultUserMessage) {
          errorMessage = errorData.details.defaultUserMessage;
        } else if (errorData?.defaultUserMessage) {
          errorMessage = errorData.defaultUserMessage;
        }

        error({
          title: "Error Adding Identifier",
          description: errorMessage,
        });
      }
    } catch (err: any) {
      console.error("Error adding identifier:", err);

      // Extract error message from exception
      let errorMessage = "Failed to add identifier";
      if (err?.message) {
        errorMessage = err.message;
      } else if (
        err?.errorData?.errors &&
        Array.isArray(err.errorData.errors) &&
        err.errorData.errors.length > 0
      ) {
        errorMessage =
          err.errorData.errors[0].defaultUserMessage ||
          err.errorData.errors[0].developerMessage ||
          errorMessage;
      } else if (err?.errorData?.defaultUserMessage) {
        errorMessage = err.errorData.defaultUserMessage;
      }

      error({
        title: "Error Adding Identifier",
        description: errorMessage,
      });
    } finally {
      setAddingIdentifier(false);
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
      // Create the gender in Fineract module codes
      const result = await addGender({
        id: 0, // Will be set by Fineract
        name: data.name,
        description: null,
      });

      success({
        title: "Success",
        description: "Gender added successfully to Fineract",
      });

      // Refetch the full template to get the updated genders from Fineract
      const templateData = await getClientTemplateData();
      let refreshedGenders: any[] = [];

      if (templateData.success && templateData.data) {
        refreshedGenders = templateData.data.genders as any[];
        setGenders(refreshedGenders);
      } else {
        // Fallback to just refreshing genders
        refreshedGenders = await getGenders();
        setGenders(refreshedGenders);
      }

      // Find the newly created gender in the refreshed list by name or ID
      const newlyCreatedGender = refreshedGenders.find(
        (gender: any) =>
          gender.id === result.id ||
          gender.id === (result as any).resourceId ||
          gender.name?.toLowerCase() === data.name.toLowerCase()
      );

      // Select the newly created gender
      if (newlyCreatedGender) {
        form.setValue("genderId", newlyCreatedGender.id.toString(), {
          shouldValidate: true,
        });
        console.log(
          "Selected gender:",
          newlyCreatedGender.id,
          newlyCreatedGender.name
        );
      } else {
        // Fallback to using the result ID
        form.setValue("genderId", result.id.toString(), {
          shouldValidate: true,
        });
        console.log("Selected gender using result ID:", result.id);
      }

      // Close dialog and reset form
      setShowAddGenderDialog(false);
      genderForm.reset();
    } catch (err: any) {
      console.error("Error adding gender:", err);
      error({
        title: "Error",
        description: err.message || "Failed to add gender to Fineract",
      });
    } finally {
      setIsAddingNew(false);
    }
  };

  // Handle adding new document type
  const handleAddDocumentType = async (data: DocumentTypeFormValues) => {
    setIsAddingNew(true);
    try {
      // Create the document type in Fineract module codes
      const result = await addDocumentType({
        id: 0, // Will be set by Fineract
        name: data.name,
        description: data.description || null,
      });

      success({
        title: "Success",
        description: "Document type added successfully to Fineract",
      });

      // Refetch document types
      const refreshedDocumentTypes = await getDocumentTypes();
      setDocumentTypes(refreshedDocumentTypes);

      // Find the newly created document type in the refreshed list
      const newlyCreatedDocType = refreshedDocumentTypes.find(
        (docType: any) =>
          docType.id === result.id ||
          docType.id === (result as any).resourceId ||
          docType.name?.toLowerCase() === data.name.toLowerCase()
      );

      // Select the newly created document type
      if (newlyCreatedDocType) {
        setNewIdentifier((prev) => ({
          ...prev,
          documentTypeId: newlyCreatedDocType.id.toString(),
        }));
        console.log(
          "Selected document type:",
          newlyCreatedDocType.id,
          newlyCreatedDocType.name
        );
      } else {
        // Fallback to using the result ID
        setNewIdentifier((prev) => ({
          ...prev,
          documentTypeId: result.id.toString(),
        }));
        console.log("Selected document type using result ID:", result.id);
      }

      // Close dialog and reset form
      setShowAddDocumentTypeDialog(false);
      documentTypeForm.reset();

      // Reopen the Add Identifier dialog so user can continue
      setShowAddIdentifierDialog(true);
    } catch (err: any) {
      console.error("Error adding document type:", err);
      error({
        title: "Error",
        description: err.message || "Failed to add document type to Fineract",
      });
    } finally {
      setIsAddingNew(false);
    }
  };

  // Handle adding new client type
  const handleAddClientType = async (data: ClientTypeValues) => {
    setIsAddingNew(true);
    try {
      // Create the client type in Fineract module codes
      const result = await addClientType({
        id: 0, // Will be set by Fineract
        name: data.name,
        description: data.description || null,
      });

      success({
        title: "Success",
        description: "Client type added successfully to Fineract",
      });

      // Refetch the full template to get the updated client types from Fineract
      const templateData = await getClientTemplateData();
      let refreshedClientTypes: any[] = [];

      if (templateData.success && templateData.data) {
        refreshedClientTypes = templateData.data.clientTypes as any[];
        setClientTypes(refreshedClientTypes);
      } else {
        // Fallback to just refreshing client types
        refreshedClientTypes = await getClientTypes();
        setClientTypes(refreshedClientTypes);
      }

      // Find the newly created client type in the refreshed list by name or ID
      const newlyCreatedClientType = refreshedClientTypes.find(
        (type: any) =>
          type.id === result.id ||
          type.id === (result as any).resourceId ||
          type.name?.toLowerCase() === data.name.toLowerCase()
      );

      // Select the newly created client type
      if (newlyCreatedClientType) {
        form.setValue("clientTypeId", newlyCreatedClientType.id.toString(), {
          shouldValidate: true,
        });
        console.log(
          "Selected client type:",
          newlyCreatedClientType.id,
          newlyCreatedClientType.name
        );
      } else {
        // Fallback to using the result ID
        form.setValue("clientTypeId", result.id.toString(), {
          shouldValidate: true,
        });
        console.log("Selected client type using result ID:", result.id);
      }

      // Close dialog and reset form
      setShowAddClientTypeDialog(false);
      clientTypeForm.reset();
    } catch (err: any) {
      console.error("Error adding client type:", err);
      error({
        title: "Error",
        description: err.message || "Failed to add client type to Fineract",
      });
    } finally {
      setIsAddingNew(false);
    }
  };

  // Handle adding new relationship
  const handleAddRelationship = async (data: RelationshipFormValues) => {
    setIsAddingNew(true);
    try {
      // Create the relationship in Fineract module codes
      const result = await addRelationship({
        id: 0, // Will be set by Fineract
        name: data.name,
        description: data.description || null,
      });

      if (!result.success) {
        error({
          title: "Error",
          description: result.error || "Failed to add relationship",
        });
        setIsAddingNew(false);
        return;
      }

      success({
        title: "Success",
        description: "Relationship added successfully to Fineract",
      });

      // Refetch relationships
      const refreshedRelationships = await getRelationships();
      setRelationships(refreshedRelationships);

      // Find the newly created relationship in the refreshed list by name or ID
      const newlyCreatedRelationship = refreshedRelationships.find(
        (relationship: any) =>
          relationship.id === (result.data as any)?.id ||
          relationship.id === (result.data as any)?.resourceId ||
          relationship.name?.toLowerCase() === data.name.toLowerCase()
      );

      // Auto-select the newly created relationship in the editing form
      if (newlyCreatedRelationship && editingFamilyMember) {
        setEditingFamilyMember({
          ...editingFamilyMember,
          relationship: newlyCreatedRelationship.name,
        });
        console.log("Selected relationship:", newlyCreatedRelationship.name);
      }

      // Close dialog and reset form
      setShowAddRelationshipDialog(false);
      relationshipForm.reset();
    } catch (err: any) {
      console.error("Error adding relationship:", err);
      error({
        title: "Error",
        description: err.message || "Failed to add relationship",
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
      // Create the client classification in Fineract module codes
      const result = await addClientClassification({
        id: 0, // Will be set by Fineract
        name: data.name,
        description: data.description || null,
      });

      success({
        title: "Success",
        description: "Client classification added successfully to Fineract",
      });

      // Refetch the full template to get the updated client classifications from Fineract
      const templateData = await getClientTemplateData();
      let refreshedClientClassifications: any[] = [];

      if (templateData.success && templateData.data) {
        refreshedClientClassifications = templateData.data
          .clientClassifications as any[];
        setClientClassifications(refreshedClientClassifications);
      } else {
        // Fallback to just refreshing client classifications
        refreshedClientClassifications = await getClientClassifications();
        setClientClassifications(refreshedClientClassifications);
      }

      // Find the newly created client classification in the refreshed list by name or ID
      const newlyCreatedClientClassification =
        refreshedClientClassifications.find(
          (classification: any) =>
            classification.id === result.id ||
            classification.id === (result as any).resourceId ||
            classification.name?.toLowerCase() === data.name.toLowerCase()
        );

      // Select the newly created client classification
      if (newlyCreatedClientClassification) {
        form.setValue(
          "clientClassificationId",
          newlyCreatedClientClassification.id.toString(),
          {
            shouldValidate: true,
          }
        );
        console.log(
          "Selected client classification:",
          newlyCreatedClientClassification.id,
          newlyCreatedClientClassification.name
        );
      } else {
        // Fallback to using the result ID
        form.setValue("clientClassificationId", result.id.toString(), {
          shouldValidate: true,
        });
        console.log(
          "Selected client classification using result ID:",
          result.id
        );
      }

      // Close dialog and reset form
      setShowAddClientClassificationDialog(false);
      clientClassificationForm.reset();
    } catch (err: any) {
      console.error("Error adding client classification:", err);
      error({
        title: "Error",
        description:
          err.message || "Failed to add client classification to Fineract",
      });
    } finally {
      setIsAddingNew(false);
    }
  };

  // Handle adding new address type
  const handleAddAddressType = async (data: {
    name: string;
    description?: string;
  }) => {
    setIsAddingNew(true);
    try {
      const result = await addAddressType({
        id: 0,
        name: data.name,
        description: data.description || null,
      });

      success({
        title: "Success",
        description: "Address type added successfully to Fineract",
      });

      // Refetch address template to get updated options with correct IDs
      const templateResponse = await fetch(
        `/api/fineract/clients/addresses/template`
      );
      if (templateResponse.ok) {
        const templateData = await templateResponse.json();
        setAddressTemplate(templateData);

        // Find the newly created address type in the refreshed template
        const addressTypeOptions = templateData?.addressTypeIdOptions || [];
        const newlyCreated = addressTypeOptions.find(
          (opt: any) =>
            opt.id === result.id ||
            opt.id === (result as any).resourceId ||
            opt.name?.toLowerCase() === data.name.toLowerCase()
        );

        // Update editedAddress with the correct ID from the template
        if (newlyCreated && newlyCreated.id) {
          setEditedAddress({
            ...editedAddress,
            addressType: newlyCreated.id, // Use the ID from the template
          });
          console.log(
            "Set addressType to:",
            newlyCreated.id,
            "for:",
            newlyCreated.name
          );
        } else if (result.id) {
          // Fallback to result ID if not found in template
          setEditedAddress({
            ...editedAddress,
            addressType: result.id,
          });
          console.log("Set addressType to result ID:", result.id);
        }
      }

      setShowAddAddressTypeDialog(false);
      addressTypeForm.reset();
    } catch (err: any) {
      console.error("Error adding address type:", err);
      error({
        title: "Error",
        description: err.message || "Failed to add address type to Fineract",
      });
    } finally {
      setIsAddingNew(false);
    }
  };

  // Handle adding new country
  const handleAddCountry = async (data: {
    name: string;
    description?: string;
  }) => {
    setIsAddingNew(true);
    try {
      const result = await addCountry({
        id: 0,
        name: data.name,
        description: data.description || null,
      });

      success({
        title: "Success",
        description: "Country added successfully to Fineract",
      });

      // Refetch address template to get updated options with correct IDs
      const templateResponse = await fetch(
        `/api/fineract/clients/addresses/template`
      );
      if (templateResponse.ok) {
        const templateData = await templateResponse.json();
        setAddressTemplate(templateData);

        // Find the newly created country in the refreshed template
        const countryOptions = templateData?.countryIdOptions || [];
        const newlyCreated = countryOptions.find(
          (opt: any) =>
            opt.id === result.id ||
            opt.id === (result as any).resourceId ||
            opt.name?.toLowerCase() === data.name.toLowerCase()
        );

        // Update editedAddress with the correct ID from the template
        if (newlyCreated && newlyCreated.id) {
          setEditedAddress({
            ...editedAddress,
            countryId: newlyCreated.id, // Use the ID from the template
          });
          console.log(
            "Set countryId to:",
            newlyCreated.id,
            "for:",
            newlyCreated.name
          );
        } else if (result.id) {
          // Fallback to result ID if not found in template
          setEditedAddress({
            ...editedAddress,
            countryId: result.id,
          });
          console.log("Set countryId to result ID:", result.id);
        }
      }

      setShowAddCountryDialog(false);
      countryForm.reset();
    } catch (err: any) {
      console.error("Error adding country:", err);
      error({
        title: "Error",
        description: err.message || "Failed to add country to Fineract",
      });
    } finally {
      setIsAddingNew(false);
    }
  };

  // Handle adding new state/province
  const handleAddStateProvince = async (data: {
    name: string;
    description?: string;
  }) => {
    setIsAddingNew(true);
    try {
      const result = await addStateProvince({
        id: 0,
        name: data.name,
        description: data.description || null,
      });

      success({
        title: "Success",
        description: "State/Province added successfully to Fineract",
      });

      // Refetch address template to get updated options with correct IDs
      const templateResponse = await fetch(
        `/api/fineract/clients/addresses/template`
      );
      if (templateResponse.ok) {
        const templateData = await templateResponse.json();
        setAddressTemplate(templateData);

        // Find the newly created state/province in the refreshed template
        const stateProvinceOptions = templateData?.stateProvinceIdOptions || [];
        const newlyCreated = stateProvinceOptions.find(
          (opt: any) =>
            opt.id === result.id ||
            opt.id === (result as any).resourceId ||
            opt.name?.toLowerCase() === data.name.toLowerCase()
        );

        // Update editedAddress with the correct ID from the template
        if (newlyCreated && newlyCreated.id) {
          setEditedAddress({
            ...editedAddress,
            stateProvinceId: newlyCreated.id, // Use the ID from the template
          });
          console.log(
            "Set stateProvinceId to:",
            newlyCreated.id,
            "for:",
            newlyCreated.name
          );
        } else if (result.id) {
          // Fallback to result ID if not found in template
          setEditedAddress({
            ...editedAddress,
            stateProvinceId: result.id,
          });
          console.log("Set stateProvinceId to result ID:", result.id);
        }
      }

      setShowAddStateProvinceDialog(false);
      stateProvinceForm.reset();
    } catch (err: any) {
      console.error("Error adding state/province:", err);
      error({
        title: "Error",
        description: err.message || "Failed to add state/province to Fineract",
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
                    <Tabs
                      value={activeClientTab}
                      onValueChange={async (newTab) => {
                        // Prevent navigation if there are form errors
                        if (newTab !== activeClientTab) {
                          // If moving forward (general -> account -> additional), validate
                          const tabOrder = ["general", "account", "additional"];
                          const currentIndex =
                            tabOrder.indexOf(activeClientTab);
                          const newIndex = tabOrder.indexOf(newTab);

                          if (newIndex > currentIndex) {
                            // Moving forward - validate
                            if (activeClientTab === "general") {
                              // Validate general tab form
                              const formToValidate = externalForm || form;
                              const isValid = await formToValidate.trigger();

                              if (!isValid) {
                                const formErrors =
                                  formToValidate.formState.errors;
                                console.error(
                                  "Form validation errors:",
                                  formErrors
                                );
                                console.error(
                                  "Form values:",
                                  formToValidate.getValues()
                                );

                                // Log each error field
                                Object.keys(formErrors).forEach((fieldName) => {
                                  const fieldError =
                                    formErrors[
                                      fieldName as keyof typeof formErrors
                                    ];
                                  console.error(
                                    `Field "${fieldName}" error:`,
                                    fieldError
                                  );
                                });

                                error({
                                  title: "Validation Error",
                                  description:
                                    "Please fix all errors in the form before proceeding to the next step. Check the console for details.",
                                });
                                return;
                              }
                            } else if (activeClientTab === "account") {
                              // Validate KYC sections
                              const selfieComplete = checkSelfieSection();
                              const identityComplete =
                                checkIdentityDocumentsSection();

                              if (!selfieComplete || !identityComplete) {
                                error({
                                  title: "Incomplete KYC",
                                  description:
                                    "Please complete the selfie and identity documents sections before proceeding.",
                                });
                                return;
                              }
                            }
                          }
                        }

                        setActiveClientTab(newTab);
                      }}
                      className="w-full"
                    >
                      <TabsList
                        className={`grid${
                          clientCreatedInFineract
                            ? "grid-cols-3"
                            : "grid-cols-2"
                        }`}
                      >
                        <TabsTrigger value="general" className="relative">
                          General Information
                          {checkGeneralTabCompletion() && (
                            <CheckCircle2 className="ml-2 h-4 w-4 text-green-600" />
                          )}
                        </TabsTrigger>
                        <TabsTrigger value="account" className="relative">
                          KYC
                          {checkKYCTabCompletion() && (
                            <CheckCircle2 className="ml-2 h-4 w-4 text-green-600" />
                          )}
                        </TabsTrigger>
                        {clientCreatedInFineract && (
                          <TabsTrigger value="additional" className="relative">
                            Additional Details
                            {checkAdditionalDetailsTabCompletion() && (
                              <CheckCircle2 className="ml-2 h-4 w-4 text-green-600" />
                            )}
                          </TabsTrigger>
                        )}
                      </TabsList>

                      <TabsContent value="general" className="mt-4">
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
                                  Client successfully recognized! Form is ready
                                  for next step.
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
                            <div
                              className={getSectionClasses("administrative")}
                            >
                              <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                  {getSectionStatus("administrative") ===
                                  "saved" ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  ) : getSectionStatus("administrative") ===
                                    "pending" ? (
                                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                  ) : (
                                    <Building2 className="h-5 w-5 text-red-500" />
                                  )}
                                  <h3
                                    className={`text-lg font-semibold ${colors.textColor}`}
                                  >
                                    Administrative Information
                                  </h3>
                                  {getSectionStatus("administrative") ===
                                    "saved" && (
                                    <Badge className="ml-2 bg-green-500 text-white">
                                      Complete
                                    </Badge>
                                  )}
                                  {getSectionStatus("administrative") ===
                                    "pending" && (
                                    <Badge className="ml-2 bg-amber-500 text-white">
                                      Pending Save
                                    </Badge>
                                  )}
                                </div>
                                <p
                                  className={`text-sm ${colors.textColorMuted} ml-7`}
                                >
                                  Office and legal classification details
                                </p>
                              </div>

                              {isLoadingOptions ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-3">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-3 w-48" />
                                  </div>
                                  <div className="space-y-3">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-3 w-48" />
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* Office */}
                                  <div className="space-y-3">
                                    <Label
                                      htmlFor="officeId"
                                      className={colors.textColor}
                                    >
                                      Office{" "}
                                      <span className="text-red-500">*</span>
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
                                              handleFieldBlur(
                                                "officeId",
                                                value
                                              );
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
                                    <p
                                      className={`text-xs ${colors.textColorMuted}`}
                                    >
                                      Select the branch office managing this
                                      client
                                    </p>
                                    {(externalForm
                                      ? externalForm.formState.errors.officeId
                                      : form.formState.errors.officeId) && (
                                      <p className="text-sm text-red-500">
                                        {
                                          (externalForm
                                            ? externalForm.formState.errors
                                                .officeId
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
                                              handleFieldBlur(
                                                "legalFormId",
                                                value
                                              );
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
                                    <p
                                      className={`text-xs ${colors.textColorMuted}`}
                                    >
                                      Legal classification of the client
                                    </p>
                                    {(externalForm
                                      ? externalForm.formState.errors
                                          .legalFormId
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

                                  {/* Activation Date */}
                                  <div className="space-y-3">
                                    <Label
                                      htmlFor="activationDate"
                                      className={colors.textColor}
                                    >
                                      Activation Date{" "}
                                      <span className="text-red-500">*</span>
                                    </Label>
                                    <Controller
                                      control={
                                        externalForm
                                          ? externalForm.control
                                          : form.control
                                      }
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
                                                getInputErrorStyling(
                                                  hasFieldError(
                                                    form,
                                                    "activationDate",
                                                    externalForm
                                                  ),
                                                  `border-${colors.borderColor} ${colors.inputBg}`
                                                )
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
                                              onSelect={(date) => {
                                                field.onChange(date);
                                                if (date) {
                                                  handleFieldBlur(
                                                    "activationDate",
                                                    date
                                                  );
                                                }
                                              }}
                                              disabled={(date) =>
                                                date < new Date("1900-01-01")
                                              }
                                              initialFocus
                                            />
                                          </PopoverContent>
                                        </Popover>
                                      )}
                                    />
                                    {lastSavedField === "activationDate" &&
                                      isAutoSaving && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                          <span>Saving...</span>
                                        </div>
                                      )}
                                    <p
                                      className={`text-xs ${colors.textColorMuted}`}
                                    >
                                      Date when the client account will be
                                      activated
                                    </p>
                                    {(externalForm
                                      ? externalForm.formState.errors
                                          .activationDate
                                      : form.formState.errors
                                          .activationDate) && (
                                      <p className="text-sm text-red-500">
                                        {
                                          (externalForm
                                            ? externalForm.formState.errors
                                                .activationDate
                                            : form.formState.errors
                                                .activationDate
                                          )?.message
                                        }
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Divider */}
                            <div className="my-8 border-t border-gray-300 dark:border-gray-700"></div>

                            {/* Personal Information Section */}
                            <div className={getSectionClasses("personal")}>
                              <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                  {getSectionStatus("personal") === "saved" ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  ) : getSectionStatus("personal") ===
                                    "pending" ? (
                                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                  ) : (
                                    <UserCheck className="h-5 w-5 text-red-500" />
                                  )}
                                  <h3
                                    className={`text-lg font-medium ${colors.textColor}`}
                                  >
                                    Personal Information
                                  </h3>
                                  {getSectionStatus("personal") === "saved" && (
                                    <Badge className="ml-2 bg-green-500 text-white">
                                      Complete
                                    </Badge>
                                  )}
                                  {getSectionStatus("personal") ===
                                    "pending" && (
                                    <Badge className="ml-2 bg-amber-500 text-white">
                                      Pending Save
                                    </Badge>
                                  )}
                                </div>
                                <p
                                  className={`text-sm ${colors.textColorMuted}`}
                                >
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
                                  <p
                                    className={`text-xs ${colors.textColorMuted}`}
                                  >
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
                                  <p
                                    className={`text-xs ${colors.textColorMuted}`}
                                  >
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
                                  <p
                                    className={`text-xs ${colors.textColorMuted}`}
                                  >
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
                                  <p
                                    className={`text-xs ${colors.textColorMuted}`}
                                  >
                                    Client's date of birth for verification
                                  </p>
                                  {form.formState.errors.dateOfBirth && (
                                    <p className="text-sm text-red-500">
                                      {
                                        form.formState.errors.dateOfBirth
                                          .message
                                      }
                                    </p>
                                  )}
                                </div>

                                {/* Gender */}
                                <div className="space-y-3">
                                  <Label
                                    htmlFor="genderId"
                                    className={colors.textColor}
                                  >
                                    Gender{" "}
                                    <span className="text-red-500">*</span>
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
                                  <p
                                    className={`text-xs ${colors.textColorMuted}`}
                                  >
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
                                      disabled={true}
                                    />
                                    {lastSavedField === "externalId" &&
                                      isAutoSaving && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                          <div className="w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                                        </div>
                                      )}
                                  </div>
                                  <p
                                    className={`text-xs ${colors.textColorMuted}`}
                                  >
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

                            {/* Divider */}
                            <div className="my-8 border-t border-gray-300 dark:border-gray-700"></div>

                            {/* Contact Information Section */}
                            <div className={getSectionClasses("contact")}>
                              <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                  {getSectionStatus("contact") === "saved" ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  ) : getSectionStatus("contact") ===
                                    "pending" ? (
                                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                  ) : (
                                    <MapPin className="h-5 w-5 text-red-500" />
                                  )}
                                  <h3
                                    className={`text-lg font-medium ${colors.textColor}`}
                                  >
                                    Contact Information
                                  </h3>
                                  {getSectionStatus("contact") === "saved" && (
                                    <Badge className="ml-2 bg-green-500 text-white">
                                      Complete
                                    </Badge>
                                  )}
                                  {getSectionStatus("contact") ===
                                    "pending" && (
                                    <Badge className="ml-2 bg-amber-500 text-white">
                                      Pending Save
                                    </Badge>
                                  )}
                                </div>
                                <p
                                  className={`text-sm ${colors.textColorMuted}`}
                                >
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
                                              onChange: (
                                                e: ChangeEvent<HTMLInputElement>
                                              ) => {
                                                handlePhoneNumberChange(
                                                  e.target.value
                                                );
                                              },
                                              onBlur: (e: {
                                                target: { value: any };
                                              }) =>
                                                handleFieldBlur(
                                                  "mobileNo",
                                                  e.target.value
                                                ),
                                            })
                                          : form.register("mobileNo", {
                                              onChange: (
                                                e: ChangeEvent<HTMLInputElement>
                                              ) => {
                                                handlePhoneNumberChange(
                                                  e.target.value
                                                );
                                              },
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
                                  <p
                                    className={`text-xs ${colors.textColorMuted}`}
                                  >
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
                                        ? externalForm.register(
                                            "emailAddress",
                                            {
                                              onBlur: (e: {
                                                target: { value: any };
                                              }) =>
                                                handleFieldBlur(
                                                  "emailAddress",
                                                  e.target.value
                                                ),
                                            }
                                          )
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
                                  <p
                                    className={`text-xs ${colors.textColorMuted}`}
                                  >
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

                            {/* Divider */}
                            <div className="my-8 border-t border-gray-300 dark:border-gray-700"></div>

                            {/* Classification Information Section */}
                            <div
                              className={getSectionClasses("classification")}
                            >
                              <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                  {getSectionStatus("classification") ===
                                  "saved" ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  ) : getSectionStatus("classification") ===
                                    "pending" ? (
                                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                  ) : (
                                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                  )}
                                  <h3
                                    className={`text-lg font-medium ${colors.textColor}`}
                                  >
                                    Client Classification
                                  </h3>
                                  {getSectionStatus("classification") ===
                                    "saved" && (
                                    <Badge className="ml-2 bg-green-500 text-white">
                                      Complete
                                    </Badge>
                                  )}
                                  {getSectionStatus("classification") ===
                                    "pending" && (
                                    <Badge className="ml-2 bg-amber-500 text-white">
                                      Pending Save
                                    </Badge>
                                  )}
                                </div>
                                <p
                                  className={`text-sm ${colors.textColorMuted}`}
                                >
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
                                          handleFieldBlur(
                                            "clientTypeId",
                                            value
                                          );
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
                                  <p
                                    className={`text-xs ${colors.textColorMuted}`}
                                  >
                                    Type of client for service eligibility
                                  </p>
                                  {form.formState.errors.clientTypeId && (
                                    <p className="text-sm text-red-500">
                                      {
                                        form.formState.errors.clientTypeId
                                          .message
                                      }
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
                                          setShowAddClientClassificationDialog(
                                            true
                                          )
                                        }
                                        addNewLabel="Add new classification"
                                        disabled={isFormDisabled}
                                      />
                                    )}
                                  />
                                  <p
                                    className={`text-xs ${colors.textColorMuted}`}
                                  >
                                    Classification for risk assessment
                                  </p>
                                  {form.formState.errors
                                    .clientClassificationId && (
                                    <p className="text-sm text-red-500">
                                      {
                                        form.formState.errors
                                          .clientClassificationId.message
                                      }
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Divider */}
                            <div className="my-8 border-t border-gray-300 dark:border-gray-700"></div>

                            {/* Additional Information Section */}
                            <div className={getSectionClasses("additional")}>
                              <div className="border-b border-gray-200 dark:border-gray-700 pb-3 mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                  {getSectionStatus("additional") ===
                                  "saved" ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                  ) : getSectionStatus("additional") ===
                                    "pending" ? (
                                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                  ) : (
                                    <FileText className="h-5 w-5 text-blue-500" />
                                  )}
                                  <h3
                                    className={`text-lg font-medium ${colors.textColor}`}
                                  >
                                    Additional Information
                                  </h3>
                                  {getSectionStatus("additional") ===
                                    "saved" && (
                                    <Badge className="ml-2 bg-green-500 text-white">
                                      Complete
                                    </Badge>
                                  )}
                                  {getSectionStatus("additional") ===
                                    "pending" && (
                                    <Badge className="ml-2 bg-amber-500 text-white">
                                      Pending Save
                                    </Badge>
                                  )}
                                </div>
                                <p
                                  className={`text-sm ${colors.textColorMuted}`}
                                >
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
                                            disabled={(date) =>
                                              date < new Date()
                                            }
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
                              type="button"
                              className={`transition-all duration-300 ease-in-out ${
                                isSubmitting
                                  ? "bg-blue-600 cursor-not-allowed opacity-75"
                                  : clientLookupStatus === "found"
                                  ? "bg-green-600 hover:bg-green-700"
                                  : "bg-blue-500 hover:bg-blue-600"
                              }`}
                              disabled={
                                isSubmitting || isFormDisabled || isSaving
                              }
                              onClick={async (e) => {
                                e.preventDefault();

                                // Capture form element BEFORE any async operations
                                // (React synthetic events are recycled after await, making e.currentTarget null)
                                const formElement =
                                  e.currentTarget?.closest("form");

                                // Validate form before proceeding
                                const formToValidate = externalForm || form;
                                const isValid = await formToValidate.trigger();

                                if (!isValid) {
                                  const formErrors =
                                    formToValidate.formState.errors;
                                  console.error(
                                    "Form validation errors:",
                                    formErrors
                                  );
                                  console.error(
                                    "Form values:",
                                    formToValidate.getValues()
                                  );

                                  // Log each error field
                                  Object.keys(formErrors).forEach(
                                    (fieldName) => {
                                      const fieldError =
                                        formErrors[
                                          fieldName as keyof typeof formErrors
                                        ];
                                      console.error(
                                        `Field "${fieldName}" error:`,
                                        fieldError
                                      );
                                    }
                                  );

                                  error({
                                    title: "Validation Error",
                                    description:
                                      "Please fix all errors in the form before proceeding to the next step. Check the console for details.",
                                  });
                                  return;
                                }

                                try {
                                  const formValues = form.getValues();

                                  // Always save any pending changes first
                                  if (
                                    clientLookupStatus === "found" &&
                                    currentLeadId
                                  ) {
                                    // Client exists, save as draft using autoSaveField
                                    setIsSaving(true);
                                    try {
                                      const saveResult = await autoSaveField(
                                        {
                                          ...formValues,
                                          fieldName: "all", // Indicate saving all fields
                                        },
                                        currentLeadId
                                      );

                                      if (saveResult.success) {
                                        // Mark all completed sections as saved after successful save
                                        setSectionCompletion(
                                          (prevCompletion) => {
                                            setSectionSaved({
                                              administrative:
                                                prevCompletion.administrative,
                                              personal: prevCompletion.personal,
                                              contact: prevCompletion.contact,
                                              classification:
                                                prevCompletion.classification,
                                              additional:
                                                prevCompletion.additional,
                                              selfie: prevCompletion.selfie,
                                              identityDocuments:
                                                prevCompletion.identityDocuments,
                                              otherDocuments:
                                                prevCompletion.otherDocuments,
                                              datatables:
                                                prevCompletion.datatables,
                                            });
                                            return prevCompletion;
                                          }
                                        );
                                      }
                                    } catch (saveError) {
                                      console.error(
                                        "Error saving changes:",
                                        saveError
                                      );
                                      error({
                                        title: "Save Error",
                                        description:
                                          "Failed to save changes. Please try again.",
                                      });
                                      return; // Don't navigate if save fails
                                    } finally {
                                      setIsSaving(false);
                                    }
                                  } else if (externalForm && onFormSubmit) {
                                    // Client doesn't exist yet, submit the form to create it
                                    await onFormSubmit(formValues);
                                    // Mark all completed sections as saved after successful submission
                                    setSectionCompletion((prevCompletion) => {
                                      setSectionSaved({
                                        administrative:
                                          prevCompletion.administrative,
                                        personal: prevCompletion.personal,
                                        contact: prevCompletion.contact,
                                        classification:
                                          prevCompletion.classification,
                                        additional: prevCompletion.additional,
                                        selfie: prevCompletion.selfie,
                                        identityDocuments:
                                          prevCompletion.identityDocuments,
                                        otherDocuments:
                                          prevCompletion.otherDocuments,
                                        datatables: prevCompletion.datatables,
                                      });
                                      return prevCompletion;
                                    });
                                  } else if (
                                    clientLookupStatus === "not_found" ||
                                    (clientLookupStatus !== "found" &&
                                      !clientCreatedInFineract &&
                                      !(window as any).fineractClientId)
                                  ) {
                                    // Client not found in Fineract OR resumed from local DB without Fineract client
                                    // Create client directly via API
                                    setIsSaving(true);
                                    try {
                                      // Prepare API data with proper type conversions
                                      const apiData = {
                                        ...formValues,
                                        officeId: formValues.officeId
                                          ? Number(formValues.officeId)
                                          : undefined,
                                        legalFormId: formValues.legalFormId
                                          ? Number(formValues.legalFormId)
                                          : undefined,
                                        clientTypeId: formValues.clientTypeId
                                          ? Number(formValues.clientTypeId)
                                          : undefined,
                                        clientClassificationId:
                                          formValues.clientClassificationId
                                            ? Number(
                                                formValues.clientClassificationId
                                              )
                                            : undefined,
                                        genderId: formValues.genderId
                                          ? Number(formValues.genderId)
                                          : undefined,
                                        dateOfBirth: formValues.dateOfBirth
                                          ? new Date(formValues.dateOfBirth)
                                          : undefined,
                                        submittedOnDate:
                                          formValues.submittedOnDate
                                            ? new Date(
                                                formValues.submittedOnDate
                                              )
                                            : new Date(),
                                        activationDate:
                                          formValues.activationDate
                                            ? new Date(
                                                formValues.activationDate
                                              )
                                            : undefined,
                                        savingsProductId:
                                          formValues.savingsProductId
                                            ? Number(
                                                formValues.savingsProductId
                                              )
                                            : undefined,
                                      };

                                      // Call API to create lead with client in Fineract
                                      const response = await fetch(
                                        "/api/leads/operations",
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            operation: "createLeadWithClient",
                                            data: apiData,
                                          }),
                                        }
                                      );

                                      if (!response.ok) {
                                        let errorData;
                                        try {
                                          errorData = await response.json();
                                        } catch {
                                          errorData = {
                                            error: `HTTP ${response.status}: ${response.statusText}`,
                                          };
                                        }
                                        throw new Error(
                                          errorData.error ||
                                            "Failed to create client in Fineract"
                                        );
                                      }

                                      const result = await response.json();
                                      console.log(
                                        "Client created successfully in Fineract:",
                                        result
                                      );

                                      // Update state to reflect successful client creation
                                      setClientLookupStatus("found");
                                      if (setClientCreatedInFineract) {
                                        setClientCreatedInFineract(true);
                                      }
                                      if (onClientCreated) {
                                        onClientCreated();
                                      }

                                      // Store the Fineract client ID for future operations
                                      if (result.fineractClientId) {
                                        (window as any).fineractClientId =
                                          result.fineractClientId;
                                      }

                                      // Update lead ID if returned
                                      if (result.leadId) {
                                        setCurrentLeadId(result.leadId);
                                      }

                                      // Mark all completed sections as saved
                                      setSectionCompletion((prevCompletion) => {
                                        setSectionSaved({
                                          administrative:
                                            prevCompletion.administrative,
                                          personal: prevCompletion.personal,
                                          contact: prevCompletion.contact,
                                          classification:
                                            prevCompletion.classification,
                                          additional: prevCompletion.additional,
                                          selfie: prevCompletion.selfie,
                                          identityDocuments:
                                            prevCompletion.identityDocuments,
                                          otherDocuments:
                                            prevCompletion.otherDocuments,
                                          datatables: prevCompletion.datatables,
                                        });
                                        return prevCompletion;
                                      });

                                      success({
                                        title: "Success",
                                        description: `Client created successfully in Fineract! Account: ${
                                          result.fineractAccountNo || "N/A"
                                        }`,
                                      });
                                    } catch (createError: any) {
                                      console.error(
                                        "Error creating client in Fineract:",
                                        createError
                                      );
                                      error({
                                        title: "Fineract Error",
                                        description:
                                          createError.message ||
                                          "Failed to create client in Fineract. Please try again.",
                                      });
                                      return; // Don't navigate if creation fails
                                    } finally {
                                      setIsSaving(false);
                                    }
                                  } else {
                                    // For non-external form with existing client, trigger form submission
                                    // Use the formElement captured at the start of the handler
                                    if (formElement) {
                                      formElement.requestSubmit();
                                      // Mark all completed sections as saved
                                      setSectionCompletion((prevCompletion) => {
                                        setSectionSaved({
                                          administrative:
                                            prevCompletion.administrative,
                                          personal: prevCompletion.personal,
                                          contact: prevCompletion.contact,
                                          classification:
                                            prevCompletion.classification,
                                          additional: prevCompletion.additional,
                                          selfie: prevCompletion.selfie,
                                          identityDocuments:
                                            prevCompletion.identityDocuments,
                                          otherDocuments:
                                            prevCompletion.otherDocuments,
                                          datatables: prevCompletion.datatables,
                                        });
                                        return prevCompletion;
                                      });
                                      // Wait a bit for submission to process
                                      await new Promise((resolve) =>
                                        setTimeout(resolve, 500)
                                      );
                                    }
                                  }

                                  // Navigate to KYC tab after saving
                                  setActiveClientTab("account");
                                } catch (err) {
                                  // If save/submission fails, don't navigate
                                  console.error(
                                    "Error saving or submitting form:",
                                    err
                                  );
                                  error({
                                    title: "Error",
                                    description:
                                      "Failed to save changes. Please try again.",
                                  });
                                }
                              }}
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
                                          Next
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
                      </TabsContent>

                      {/* KYC Tab */}
                      <TabsContent value="account" className="mt-4">
                        <Card
                          className={`border-${colors.borderColor} ${colors.cardBg}`}
                        >
                          <CardHeader>
                            <CardTitle className={colors.textColor}>
                              KYC (Know Your Customer)
                            </CardTitle>
                            <CardDescription className={colors.textColorMuted}>
                              Capture client selfie and identity documents
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-8">
                            {isLoadingKYC ? (
                              <>
                                {/* Selfie Section Skeleton */}
                                <div className="space-y-4">
                                  <Skeleton className="h-5 w-32" />
                                  <div className="space-y-4">
                                    <Skeleton className="h-48 w-full max-w-md rounded-lg" />
                                    <div className="flex gap-4">
                                      <Skeleton className="h-10 w-40" />
                                      <Skeleton className="h-10 w-40" />
                                    </div>
                                  </div>
                                </div>

                                {/* Divider Skeleton */}
                                <div className="my-8 border-t border-gray-300 dark:border-gray-700" />

                                {/* Identity Documents Section Skeleton */}
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Skeleton className="h-5 w-48" />
                                    <Skeleton className="h-4 w-64" />
                                  </div>
                                  <div className="flex gap-2">
                                    <Skeleton className="h-10 w-32" />
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[1, 2].map((i) => (
                                      <Card
                                        key={i}
                                        className={`border-${colors.borderColor} ${colors.cardBg}`}
                                      >
                                        <CardContent className="p-4">
                                          <div className="space-y-3">
                                            <div className="flex items-start justify-between">
                                              <div className="space-y-2 flex-1">
                                                <Skeleton className="h-5 w-20" />
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-3 w-24" />
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Skeleton className="h-8 w-24" />
                                                <Skeleton className="h-8 w-8" />
                                              </div>
                                            </div>
                                            <div className="pt-2 border-t space-y-2">
                                              <Skeleton className="h-3 w-28" />
                                              <Skeleton className="h-4 w-full" />
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                </div>

                                {/* Divider Skeleton */}
                                <div className="my-8 border-t border-gray-300 dark:border-gray-700" />

                                {/* Other Documents Section Skeleton */}
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Skeleton className="h-5 w-40" />
                                    <Skeleton className="h-4 w-64" />
                                  </div>
                                  <div className="flex gap-2">
                                    <Skeleton className="h-10 w-36" />
                                  </div>
                                  <div className="space-y-2">
                                    {[1, 2].map((i) => (
                                      <div
                                        key={i}
                                        className="flex items-center justify-between p-3 border rounded-lg"
                                      >
                                        <Skeleton className="h-4 w-48" />
                                        <div className="flex gap-2">
                                          <Skeleton className="h-8 w-8" />
                                          <Skeleton className="h-8 w-8" />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <>
                                {/* Selfie Section */}
                                <div className={getSectionClasses("selfie")}>
                                  <div className="flex items-center gap-2 mb-2">
                                    {getSectionStatus("selfie") === "saved" ? (
                                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    ) : getSectionStatus("selfie") ===
                                      "pending" ? (
                                      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                    ) : (
                                      <UserCheck className="h-5 w-5 text-red-500" />
                                    )}
                                    <Label className={colors.textColor}>
                                      Client Selfie{" "}
                                      <span className="text-red-500">*</span>
                                    </Label>
                                    {getSectionStatus("selfie") === "saved" && (
                                      <Badge className="ml-2 bg-green-500 text-white">
                                        Complete
                                      </Badge>
                                    )}
                                    {getSectionStatus("selfie") ===
                                      "pending" && (
                                      <Badge className="ml-2 bg-amber-500 text-white">
                                        Pending Save
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="space-y-4">
                                    {/* Show existing image if available and no new image selected */}
                                    {existingClientImage && !selfieImage && (
                                      <div className="space-y-4">
                                        <div className="relative w-full max-w-md">
                                          {selfieImageLoading && (
                                            <Skeleton className="h-48 w-full max-w-md rounded-lg absolute inset-0" />
                                          )}
                                          <img
                                            src={existingClientImage}
                                            alt="Existing client image"
                                            className={`w-full rounded-lg border ${
                                              selfieImageLoading
                                                ? "opacity-0"
                                                : "opacity-100"
                                            } transition-opacity duration-300`}
                                            onError={(e) => {
                                              console.error(
                                                "Image failed to load:",
                                                existingClientImage.substring(
                                                  0,
                                                  100
                                                )
                                              );
                                              console.error(
                                                "Image error event:",
                                                e
                                              );
                                              // Try to reload or show error
                                              const target =
                                                e.target as HTMLImageElement;
                                              target.style.display = "none";
                                              setSelfieImageLoading(false);
                                            }}
                                            onLoad={() => {
                                              console.log(
                                                "Image loaded successfully"
                                              );
                                              setSelfieImageLoading(false);
                                            }}
                                          />
                                          {!selfieImageLoading && (
                                            <Badge
                                              variant="secondary"
                                              className="absolute top-2 left-2"
                                            >
                                              Current Image
                                            </Badge>
                                          )}
                                        </div>
                                        <p
                                          className={`text-sm ${colors.textColorMuted}`}
                                        >
                                          This is the current client image. You
                                          can replace it by capturing a new
                                          photo or uploading a new file.
                                        </p>
                                        <div className="flex gap-4">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleStartCamera}
                                            disabled={!fineractClientId}
                                            className="flex items-center gap-2"
                                          >
                                            <UserCheck className="h-4 w-4" />
                                            Capture New Photo
                                          </Button>
                                          <label>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              asChild
                                              disabled={!fineractClientId}
                                              className="flex items-center gap-2 cursor-pointer"
                                            >
                                              <span>
                                                <UserPlus className="h-4 w-4" />
                                                Upload New Photo
                                              </span>
                                            </Button>
                                            <input
                                              type="file"
                                              accept="image/*"
                                              onChange={handleSelfieFileSelect}
                                              className="hidden"
                                            />
                                          </label>
                                        </div>
                                      </div>
                                    )}

                                    {/* Show upload options if no existing image and no new image */}
                                    {!existingClientImage && !selfieImage && (
                                      <div className="flex gap-4">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={handleStartCamera}
                                          disabled={!fineractClientId}
                                          className="flex items-center gap-2"
                                        >
                                          <UserCheck className="h-4 w-4" />
                                          Capture from Camera
                                        </Button>
                                        <label>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            asChild
                                            disabled={!fineractClientId}
                                            className="flex items-center gap-2 cursor-pointer"
                                          >
                                            <span>
                                              <UserPlus className="h-4 w-4" />
                                              Upload from File
                                            </span>
                                          </Button>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleSelfieFileSelect}
                                            className="hidden"
                                          />
                                        </label>
                                      </div>
                                    )}

                                    {selfieImage && (
                                      <div className="space-y-4">
                                        <div className="relative w-full max-w-md">
                                          <img
                                            src={selfieImage}
                                            alt="Selfie preview"
                                            className="w-full rounded-lg border"
                                          />
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelfieImage(null)}
                                            className="absolute top-2 right-2"
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        <div className="flex gap-4">
                                          <Button
                                            type="button"
                                            onClick={handleUploadSelfie}
                                            disabled={
                                              uploadingSelfie ||
                                              !fineractClientId
                                            }
                                            className="bg-blue-500 hover:bg-blue-600"
                                          >
                                            {uploadingSelfie ? (
                                              <>
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                Uploading...
                                              </>
                                            ) : (
                                              <>
                                                <Save className="h-4 w-4 mr-2" />
                                                Upload Selfie
                                              </>
                                            )}
                                          </Button>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setSelfieImage(null)}
                                          >
                                            Remove
                                          </Button>
                                        </div>
                                      </div>
                                    )}

                                    <canvas
                                      ref={canvasRef}
                                      className="hidden"
                                    />
                                  </div>
                                </div>

                                {/* Camera Modal */}
                                <Dialog
                                  open={showCameraModal}
                                  onOpenChange={(open) => {
                                    setShowCameraModal(open);
                                    if (!open) {
                                      // Stop camera when modal closes
                                      if (videoRef.current) {
                                        const stream = videoRef.current
                                          .srcObject as MediaStream;
                                        stream
                                          ?.getTracks()
                                          .forEach((track) => track.stop());
                                      }
                                      setCapturedImage(null);
                                    }
                                  }}
                                >
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle className={colors.textColor}>
                                        Capture Selfie
                                      </DialogTitle>
                                      <DialogDescription
                                        className={colors.textColorMuted}
                                      >
                                        {capturedImage
                                          ? "Review your photo. You can retake or confirm."
                                          : "Position your face in the frame and click capture."}
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      {!capturedImage ? (
                                        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                                          <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      ) : (
                                        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                                          <img
                                            src={capturedImage}
                                            alt="Captured selfie"
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      )}
                                    </div>
                                    <DialogFooter>
                                      {!capturedImage ? (
                                        <>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleStopCamera}
                                          >
                                            Cancel
                                          </Button>
                                          <Button
                                            type="button"
                                            onClick={handleCaptureSelfie}
                                            className="bg-blue-500 hover:bg-blue-600"
                                          >
                                            Capture Photo
                                          </Button>
                                        </>
                                      ) : (
                                        <>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleRetakePhoto}
                                          >
                                            Retake
                                          </Button>
                                          <Button
                                            type="button"
                                            onClick={handleConfirmCapture}
                                            className="bg-blue-500 hover:bg-blue-600"
                                          >
                                            Use This Photo
                                          </Button>
                                        </>
                                      )}
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>

                                {/* Document Type Selection Dialog */}
                                <Dialog
                                  open={showDocumentTypeDialog}
                                  onOpenChange={(open) => {
                                    setShowDocumentTypeDialog(open);
                                    if (!open) {
                                      setPendingFiles([]);
                                      setSelectedDocumentType(null);
                                    }
                                  }}
                                >
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle className={colors.textColor}>
                                        Select Document Type
                                      </DialogTitle>
                                      <DialogDescription
                                        className={colors.textColorMuted}
                                      >
                                        Choose the type of identity document
                                        you're uploading
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <Label className={colors.textColor}>
                                          Document Type{" "}
                                          <span className="text-red-500">
                                            *
                                          </span>
                                        </Label>
                                        <Select
                                          value={
                                            selectedDocumentType?.toString() ||
                                            ""
                                          }
                                          onValueChange={(value) =>
                                            setSelectedDocumentType(
                                              Number(value)
                                            )
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Select document type" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {identifiersTemplate
                                              ?.documentTypeOptions?.length >
                                            0 ? (
                                              identifiersTemplate.documentTypeOptions.map(
                                                (option: any) => (
                                                  <SelectItem
                                                    key={option.id}
                                                    value={option.id.toString()}
                                                  >
                                                    {option.name ||
                                                      option.value ||
                                                      `Type ${option.id}`}
                                                  </SelectItem>
                                                )
                                              )
                                            ) : (
                                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                                {identifiersTemplate === null
                                                  ? "Loading document types..."
                                                  : "No document types available"}
                                              </div>
                                            )}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      {pendingFiles.length > 0 && (
                                        <div className="space-y-2">
                                          <Label className={colors.textColor}>
                                            Files to upload (
                                            {pendingFiles.length})
                                          </Label>
                                          <div className="space-y-1">
                                            {pendingFiles.map((file, index) => (
                                              <p
                                                key={index}
                                                className={`text-sm ${colors.textColorMuted}`}
                                              >
                                                • {file.name}
                                              </p>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <DialogFooter>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                          setShowDocumentTypeDialog(false);
                                          setPendingFiles([]);
                                          setSelectedDocumentType(null);
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        type="button"
                                        onClick={handleConfirmDocumentType}
                                        disabled={!selectedDocumentType}
                                        className="bg-blue-500 hover:bg-blue-600"
                                      >
                                        Confirm
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>

                                {/* Add Identifier Dialog */}
                                <Dialog
                                  open={showAddIdentifierDialog}
                                  onOpenChange={(open) => {
                                    setShowAddIdentifierDialog(open);
                                    if (!open) {
                                      setNewIdentifier({
                                        documentTypeId: "",
                                        documentKey: "",
                                        description: "",
                                        status: "active",
                                        documentFile: null,
                                        documentFileName: "",
                                      });
                                    }
                                  }}
                                >
                                  <DialogContent className="max-w-md">
                                    <DialogHeader>
                                      <DialogTitle className={colors.textColor}>
                                        Add Identifier
                                      </DialogTitle>
                                      <DialogDescription
                                        className={colors.textColorMuted}
                                      >
                                        Add a new identifier (e.g., National ID,
                                        Passport Number, etc.)
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <Label className={colors.textColor}>
                                          Document Type{" "}
                                          <span className="text-red-500">
                                            *
                                          </span>
                                        </Label>
                                        <SearchableSelect
                                          options={documentTypeOptions}
                                          value={newIdentifier.documentTypeId}
                                          onValueChange={(value) =>
                                            setNewIdentifier((prev) => ({
                                              ...prev,
                                              documentTypeId: value,
                                            }))
                                          }
                                          placeholder="Select document type"
                                          className={`border-${colors.borderColor} ${colors.inputBg}`}
                                          onAddNew={() => {
                                            documentTypeForm.reset();
                                            setShowAddIdentifierDialog(false);
                                            setShowAddDocumentTypeDialog(true);
                                          }}
                                          addNewLabel="Add new document type"
                                          emptyMessage={
                                            allDocumentTypes.length === 0
                                              ? "No document types available"
                                              : "No results found."
                                          }
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <Label className={colors.textColor}>
                                          Document Key/Number{" "}
                                          <span className="text-red-500">
                                            *
                                          </span>
                                        </Label>
                                        <Input
                                          value={newIdentifier.documentKey}
                                          onChange={(e) =>
                                            setNewIdentifier((prev) => ({
                                              ...prev,
                                              documentKey: e.target.value,
                                            }))
                                          }
                                          placeholder="e.g., 123456789"
                                          className={colors.textColor}
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <Label className={colors.textColor}>
                                          Description (Optional)
                                        </Label>
                                        <Input
                                          value={newIdentifier.description}
                                          onChange={(e) =>
                                            setNewIdentifier((prev) => ({
                                              ...prev,
                                              description: e.target.value,
                                            }))
                                          }
                                          placeholder="Additional notes or description"
                                          className={colors.textColor}
                                        />
                                      </div>

                                      <div className="space-y-2">
                                        <Label className={colors.textColor}>
                                          Status
                                        </Label>
                                        <Select
                                          value={newIdentifier.status}
                                          onValueChange={(
                                            value: "active" | "inactive"
                                          ) =>
                                            setNewIdentifier((prev) => ({
                                              ...prev,
                                              status: value,
                                            }))
                                          }
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="active">
                                              Active
                                            </SelectItem>
                                            <SelectItem value="inactive">
                                              Inactive
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div className="space-y-2">
                                        <Label className={colors.textColor}>
                                          Upload Document (Optional)
                                        </Label>
                                        <div className="space-y-2">
                                          <Input
                                            type="text"
                                            value={
                                              newIdentifier.documentFileName
                                            }
                                            onChange={(e) =>
                                              setNewIdentifier((prev) => ({
                                                ...prev,
                                                documentFileName:
                                                  e.target.value,
                                              }))
                                            }
                                            placeholder="Document name (optional)"
                                            className={colors.textColor}
                                          />
                                          <label>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              asChild
                                              className="w-full flex items-center gap-2 cursor-pointer"
                                            >
                                              <span>
                                                <UserPlus className="h-4 w-4" />
                                                {newIdentifier.documentFile
                                                  ? newIdentifier.documentFile
                                                      .name
                                                  : "Select File"}
                                              </span>
                                            </Button>
                                            <input
                                              type="file"
                                              accept="image/*,application/pdf"
                                              onChange={(e) => {
                                                const file =
                                                  e.target.files?.[0];
                                                if (file) {
                                                  setNewIdentifier((prev) => ({
                                                    ...prev,
                                                    documentFile: file,
                                                    documentFileName:
                                                      prev.documentFileName ||
                                                      file.name,
                                                  }));
                                                }
                                              }}
                                              className="hidden"
                                            />
                                          </label>
                                          {newIdentifier.documentFile && (
                                            <div className="flex items-center gap-2">
                                              <p
                                                className={`text-sm ${colors.textColorMuted} flex-1`}
                                              >
                                                {
                                                  newIdentifier.documentFile
                                                    .name
                                                }{" "}
                                                (
                                                {(
                                                  newIdentifier.documentFile
                                                    .size / 1024
                                                ).toFixed(2)}{" "}
                                                KB)
                                              </p>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                  setNewIdentifier((prev) => ({
                                                    ...prev,
                                                    documentFile: null,
                                                    documentFileName: "",
                                                  }))
                                                }
                                              >
                                                <X className="h-4 w-4" />
                                              </Button>
                                            </div>
                                          )}
                                        </div>
                                        <p
                                          className={`text-xs ${colors.textColorMuted} italic`}
                                        >
                                          Upload a document file to link with
                                          this identifier
                                        </p>
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                          setShowAddIdentifierDialog(false);
                                          setNewIdentifier({
                                            documentTypeId: "",
                                            documentKey: "",
                                            description: "",
                                            status: "active",
                                            documentFile: null,
                                            documentFileName: "",
                                          });
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        type="button"
                                        onClick={handleAddIdentifier}
                                        disabled={
                                          addingIdentifier ||
                                          !newIdentifier.documentTypeId ||
                                          !newIdentifier.documentKey.trim()
                                        }
                                        className="bg-blue-500 hover:bg-blue-600"
                                      >
                                        {addingIdentifier ? (
                                          <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Adding...
                                          </>
                                        ) : (
                                          "Add Identifier"
                                        )}
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>

                                {/* Divider */}
                                <div className="my-8 border-t border-gray-300 dark:border-gray-700"></div>

                                {/* Identity Documents Section */}
                                <Card
                                  className={
                                    getSectionStatus("identityDocuments") ===
                                    "saved"
                                      ? "border-2 border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950"
                                      : getSectionStatus(
                                          "identityDocuments"
                                        ) === "pending"
                                      ? "border-2 border-amber-500 dark:border-amber-600 bg-amber-50 dark:bg-amber-950"
                                      : "border-2 border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-950"
                                  }
                                >
                                  <CardContent className="pt-6">
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Label className={colors.textColor}>
                                            Identity Documents
                                          </Label>
                                          {getSectionStatus(
                                            "identityDocuments"
                                          ) === "saved" && (
                                            <Badge className="bg-green-500 text-white">
                                              Complete
                                            </Badge>
                                          )}
                                          {getSectionStatus(
                                            "identityDocuments"
                                          ) === "pending" && (
                                            <Badge className="bg-amber-500 text-white">
                                              Pending Save
                                            </Badge>
                                          )}
                                        </div>
                                        {identifiersTemplate
                                          ?.documentTypeOptions?.length > 0 ? (
                                          <div className="flex flex-wrap gap-2 items-center">
                                            <span
                                              className={`text-xs ${colors.textColorMuted}`}
                                            >
                                              Available document types:
                                            </span>
                                            {identifiersTemplate.documentTypeOptions.map(
                                              (option: any) => {
                                                // Check if this document type has an active identifier
                                                const hasIdentifier =
                                                  existingIdentifiers.some(
                                                    (identifier: any) =>
                                                      (identifier.documentType
                                                        ?.id === option.id ||
                                                        identifier.documentTypeId ===
                                                          option.id) &&
                                                      identifier.status
                                                        ?.active !== false &&
                                                      identifier.status !==
                                                        "Inactive"
                                                  );
                                                return (
                                                  <Badge
                                                    key={option.id}
                                                    variant={
                                                      hasIdentifier
                                                        ? "default"
                                                        : "outline"
                                                    }
                                                    className={`text-xs ${
                                                      hasIdentifier
                                                        ? "bg-green-500 hover:bg-green-600 text-white border-0"
                                                        : ""
                                                    }`}
                                                  >
                                                    {hasIdentifier && (
                                                      <Check className="h-3 w-3 mr-1" />
                                                    )}
                                                    {option.name}
                                                  </Badge>
                                                );
                                              }
                                            )}
                                          </div>
                                        ) : (
                                          <p
                                            className={`text-xs ${colors.textColorMuted} italic`}
                                          >
                                            Loading document types...
                                          </p>
                                        )}
                                      </div>
                                      <div className="space-y-4">
                                        {/* Existing Identifiers from Fineract */}
                                        <div className="space-y-2">
                                          <Label
                                            className={`text-sm font-medium ${colors.textColor}`}
                                          >
                                            Existing Identifiers
                                            {existingIdentifiers.length > 0 && (
                                              <span className="ml-2 text-xs font-normal">
                                                ({existingIdentifiers.length})
                                              </span>
                                            )}
                                          </Label>

                                          {existingIdentifiers.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                              {existingIdentifiers.map(
                                                (
                                                  identifier: any,
                                                  index: number
                                                ) => {
                                                  const documentType =
                                                    identifiersTemplate?.documentTypeOptions?.find(
                                                      (opt: any) =>
                                                        opt.id ===
                                                          identifier
                                                            .documentType?.id ||
                                                        opt.id ===
                                                          identifier.documentTypeId
                                                    );

                                                  // Get linked documents for this identifier
                                                  const identifierId =
                                                    identifier.id;
                                                  // First try to get documents from the identifier documents map (new method)
                                                  let linkedDocuments =
                                                    identifierDocuments.get(
                                                      identifierId
                                                    ) || [];

                                                  // Fallback: if no documents found via API, try filtering clientDocuments (backward compatibility)
                                                  if (
                                                    linkedDocuments.length === 0
                                                  ) {
                                                    linkedDocuments =
                                                      clientDocuments.filter(
                                                        (doc: any) => {
                                                          if (!doc.name)
                                                            return false;
                                                          // Check if document name starts with IDENTIFIER_{identifierId}_
                                                          const extractedId =
                                                            extractIdentifierIdFromFilename(
                                                              doc.name
                                                            );
                                                          return (
                                                            extractedId ===
                                                            identifierId
                                                          );
                                                        }
                                                      );
                                                  }

                                                  return (
                                                    <Card
                                                      key={
                                                        identifier.id || index
                                                      }
                                                      className={`border-${colors.borderColor} ${colors.cardBg}`}
                                                    >
                                                      <CardContent className="p-4">
                                                        <div className="space-y-3">
                                                          <div className="flex items-start justify-between">
                                                            <div className="space-y-2 flex-1">
                                                              {documentType && (
                                                                <Badge
                                                                  variant="secondary"
                                                                  className="text-xs"
                                                                >
                                                                  {
                                                                    documentType.name
                                                                  }
                                                                </Badge>
                                                              )}
                                                              {identifier
                                                                .documentType
                                                                ?.name &&
                                                                !documentType && (
                                                                  <Badge
                                                                    variant="secondary"
                                                                    className="text-xs"
                                                                  >
                                                                    {
                                                                      identifier
                                                                        .documentType
                                                                        .name
                                                                    }
                                                                  </Badge>
                                                                )}
                                                              <p
                                                                className={`text-sm font-medium ${colors.textColor}`}
                                                              >
                                                                {identifier.documentKey ||
                                                                  identifier.description ||
                                                                  identifier.documentNumber ||
                                                                  `Identifier ${
                                                                    index + 1
                                                                  }`}
                                                              </p>
                                                              {identifier
                                                                .documentType
                                                                ?.name && (
                                                                <p
                                                                  className={`text-xs ${colors.textColorMuted}`}
                                                                >
                                                                  Type:{" "}
                                                                  {
                                                                    identifier
                                                                      .documentType
                                                                      .name
                                                                  }
                                                                </p>
                                                              )}
                                                              {identifier.status && (
                                                                <Badge
                                                                  variant={
                                                                    identifier
                                                                      .status
                                                                      .active
                                                                      ? "default"
                                                                      : "secondary"
                                                                  }
                                                                  className="text-xs"
                                                                >
                                                                  {identifier
                                                                    .status
                                                                    .active
                                                                    ? "Active"
                                                                    : "Inactive"}
                                                                </Badge>
                                                              )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                              <label>
                                                                <Button
                                                                  type="button"
                                                                  variant="outline"
                                                                  size="sm"
                                                                  asChild
                                                                  disabled={
                                                                    !fineractClientId ||
                                                                    addingDocumentToIdentifier ===
                                                                      identifierId
                                                                  }
                                                                  className="flex items-center gap-1 cursor-pointer"
                                                                >
                                                                  <span>
                                                                    <Plus className="h-3 w-3" />
                                                                    {addingDocumentToIdentifier ===
                                                                    identifierId
                                                                      ? "Adding..."
                                                                      : "Add Document"}
                                                                  </span>
                                                                </Button>
                                                                <input
                                                                  type="file"
                                                                  accept="image/*,application/pdf"
                                                                  className="hidden"
                                                                  disabled={
                                                                    addingDocumentToIdentifier ===
                                                                    identifierId
                                                                  }
                                                                  onChange={(
                                                                    e
                                                                  ) => {
                                                                    const file =
                                                                      e.target
                                                                        .files?.[0];
                                                                    if (file) {
                                                                      handleAddDocumentToIdentifier(
                                                                        identifierId,
                                                                        file
                                                                      );
                                                                      e.target.value =
                                                                        ""; // Reset input
                                                                    }
                                                                  }}
                                                                />
                                                              </label>
                                                              <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                disabled={
                                                                  !fineractClientId ||
                                                                  deletingIdentifierId ===
                                                                    identifierId
                                                                }
                                                                onClick={() =>
                                                                  handleDeleteIdentifierClick(
                                                                    identifierId
                                                                  )
                                                                }
                                                                className="flex items-center gap-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                title="Delete identifier"
                                                              >
                                                                {deletingIdentifierId ===
                                                                identifierId ? (
                                                                  <Loader2 className="h-3 w-3 animate-spin" />
                                                                ) : (
                                                                  <Trash2 className="h-3 w-3" />
                                                                )}
                                                              </Button>
                                                            </div>
                                                          </div>

                                                          {/* Linked Documents */}
                                                          {linkedDocuments.length >
                                                            0 && (
                                                            <div className="space-y-2 pt-2 border-t">
                                                              <p
                                                                className={`text-xs font-medium ${colors.textColor}`}
                                                              >
                                                                Linked
                                                                Documents:
                                                              </p>
                                                              <div className="space-y-1">
                                                                {linkedDocuments.map(
                                                                  (
                                                                    doc: any,
                                                                    docIndex: number
                                                                  ) => {
                                                                    const isPreviewing =
                                                                      previewingDocumentId ===
                                                                        String(
                                                                          doc.id
                                                                        ) &&
                                                                      previewingIdentifierId ===
                                                                        identifierId;
                                                                    const isImage =
                                                                      doc.type?.includes(
                                                                        "image"
                                                                      ) ||
                                                                      doc.name?.match(
                                                                        /\.(jpg|jpeg|png|gif|webp|bmp)$/i
                                                                      ) ||
                                                                      doc.fileName?.match(
                                                                        /\.(jpg|jpeg|png|gif|webp|bmp)$/i
                                                                      );
                                                                    const isPdf =
                                                                      doc.type?.includes(
                                                                        "pdf"
                                                                      ) ||
                                                                      doc.name?.match(
                                                                        /\.pdf$/i
                                                                      ) ||
                                                                      doc.fileName?.match(
                                                                        /\.pdf$/i
                                                                      );
                                                                    // Use identifier documents endpoint for documents linked to identifiers
                                                                    const previewUrl =
                                                                      fineractClientId &&
                                                                      identifierId
                                                                        ? `/api/fineract/client_identifiers/${identifierId}/documents/${doc.id}/attachment`
                                                                        : fineractClientId
                                                                        ? `/api/fineract/clients/${fineractClientId}/documents/${doc.id}/attachment`
                                                                        : null;

                                                                    return (
                                                                      <div
                                                                        key={
                                                                          doc.id ||
                                                                          docIndex
                                                                        }
                                                                        className="space-y-2"
                                                                      >
                                                                        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
                                                                          <FileText className="h-3 w-3 text-blue-500 flex-shrink-0" />
                                                                          <span
                                                                            className={`flex-1 ${colors.textColor} truncate cursor-pointer`}
                                                                            onClick={() =>
                                                                              handleViewDocument(
                                                                                doc.id,
                                                                                identifierId
                                                                              )
                                                                            }
                                                                            title={
                                                                              doc.name ||
                                                                              doc.fileName ||
                                                                              `Document ${
                                                                                docIndex +
                                                                                1
                                                                              }`
                                                                            }
                                                                          >
                                                                            {doc.name ||
                                                                              doc.fileName ||
                                                                              `Document ${
                                                                                docIndex +
                                                                                1
                                                                              }`}
                                                                          </span>
                                                                          {doc.size && (
                                                                            <span
                                                                              className={`${colors.textColorMuted} flex-shrink-0`}
                                                                            >
                                                                              {(
                                                                                doc.size /
                                                                                1024
                                                                              ).toFixed(
                                                                                1
                                                                              )}{" "}
                                                                              KB
                                                                            </span>
                                                                          )}
                                                                          <div className="flex items-center gap-1 flex-shrink-0">
                                                                            <Button
                                                                              type="button"
                                                                              variant="ghost"
                                                                              size="sm"
                                                                              className={`h-6 w-6 p-0 ${
                                                                                isPreviewing
                                                                                  ? "bg-blue-100 dark:bg-blue-900"
                                                                                  : ""
                                                                              }`}
                                                                              onClick={() =>
                                                                                handleViewDocument(
                                                                                  doc.id,
                                                                                  identifierId
                                                                                )
                                                                              }
                                                                              title={
                                                                                isPreviewing
                                                                                  ? "Hide preview"
                                                                                  : "View document"
                                                                              }
                                                                            >
                                                                              <Eye className="h-3 w-3" />
                                                                            </Button>
                                                                            <Button
                                                                              type="button"
                                                                              variant="ghost"
                                                                              size="sm"
                                                                              className="h-6 w-6 p-0"
                                                                              onClick={() =>
                                                                                handleDownloadDocument(
                                                                                  doc.id,
                                                                                  doc.name ||
                                                                                    doc.fileName ||
                                                                                    `document_${doc.id}`,
                                                                                  identifierId
                                                                                )
                                                                              }
                                                                              title="Download document"
                                                                            >
                                                                              <Download className="h-3 w-3" />
                                                                            </Button>
                                                                          </div>
                                                                        </div>

                                                                        {/* Inline Preview */}
                                                                        {isPreviewing &&
                                                                          previewUrl && (
                                                                            <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                                                                              {isImage ? (
                                                                                <div className="flex items-center justify-center">
                                                                                  <img
                                                                                    src={
                                                                                      previewUrl
                                                                                    }
                                                                                    alt={
                                                                                      doc.name ||
                                                                                      doc.fileName ||
                                                                                      "Document preview"
                                                                                    }
                                                                                    className="max-w-full max-h-96 object-contain rounded-lg shadow-sm"
                                                                                    onError={(
                                                                                      e
                                                                                    ) => {
                                                                                      console.error(
                                                                                        "Error loading image"
                                                                                      );
                                                                                      e.currentTarget.style.display =
                                                                                        "none";
                                                                                      const errorDiv =
                                                                                        document.createElement(
                                                                                          "div"
                                                                                        );
                                                                                      errorDiv.className =
                                                                                        "text-center text-gray-500 p-4 text-sm";
                                                                                      errorDiv.textContent =
                                                                                        "Failed to load image. Please try downloading the document.";
                                                                                      e.currentTarget.parentElement?.appendChild(
                                                                                        errorDiv
                                                                                      );
                                                                                    }}
                                                                                  />
                                                                                </div>
                                                                              ) : isPdf ? (
                                                                                <div className="w-full h-96">
                                                                                  <iframe
                                                                                    src={
                                                                                      previewUrl
                                                                                    }
                                                                                    className="w-full h-full border-0 rounded-lg"
                                                                                    title={
                                                                                      doc.name ||
                                                                                      doc.fileName ||
                                                                                      "Document preview"
                                                                                    }
                                                                                  />
                                                                                </div>
                                                                              ) : (
                                                                                <div className="flex flex-col items-center justify-center h-32 space-y-2">
                                                                                  <FileText className="h-8 w-8 text-gray-400" />
                                                                                  <p className="text-gray-500 text-sm text-center">
                                                                                    Preview
                                                                                    not
                                                                                    available
                                                                                    for
                                                                                    this
                                                                                    file
                                                                                    type.
                                                                                  </p>
                                                                                  <Button
                                                                                    size="sm"
                                                                                    variant="outline"
                                                                                    onClick={() =>
                                                                                      handleDownloadDocument(
                                                                                        doc.id,
                                                                                        doc.name ||
                                                                                          doc.fileName ||
                                                                                          `document_${doc.id}`
                                                                                      )
                                                                                    }
                                                                                  >
                                                                                    <Download className="h-3 w-3 mr-2" />
                                                                                    Download
                                                                                    to
                                                                                    View
                                                                                  </Button>
                                                                                </div>
                                                                              )}
                                                                            </div>
                                                                          )}
                                                                      </div>
                                                                    );
                                                                  }
                                                                )}
                                                              </div>
                                                            </div>
                                                          )}
                                                        </div>
                                                      </CardContent>
                                                    </Card>
                                                  );
                                                }
                                              )}
                                            </div>
                                          ) : (
                                            <p
                                              className={`text-sm ${colors.textColorMuted} italic`}
                                            >
                                              No existing identifiers found. Add
                                              new identity documents below.
                                            </p>
                                          )}
                                        </div>

                                        {/* Add New Identifier or Document */}
                                        <div className="space-y-2">
                                          <Label
                                            className={`text-sm font-medium ${colors.textColor}`}
                                          >
                                            Add Identifier
                                          </Label>
                                          <div className="flex gap-2 flex-wrap">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              onClick={() =>
                                                setShowAddIdentifierDialog(true)
                                              }
                                              disabled={!fineractClientId}
                                              className="flex items-center gap-2"
                                            >
                                              <Database className="h-4 w-4" />
                                              Add Identifier
                                            </Button>
                                          </div>
                                          <p
                                            className={`text-xs ${colors.textColorMuted} italic`}
                                          >
                                            Add identifiers for IDs, passport
                                            numbers, etc.
                                          </p>
                                        </div>

                                        {/* Pending Documents to Upload - Removed since documents now upload directly */}
                                        {identityDocuments.length > 0 && (
                                          <div className="space-y-2">
                                            <Label
                                              className={`text-sm font-medium ${colors.textColor}`}
                                            >
                                              Documents to Upload (
                                              {identityDocuments.length})
                                            </Label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                              {identityDocuments.map(
                                                (doc, index) => (
                                                  <Card
                                                    key={index}
                                                    className={`border-${colors.borderColor} ${colors.cardBg}`}
                                                  >
                                                    <CardContent className="p-4">
                                                      <div className="space-y-2">
                                                        {doc.documentTypeName && (
                                                          <Badge
                                                            variant="secondary"
                                                            className="text-xs"
                                                          >
                                                            {
                                                              doc.documentTypeName
                                                            }
                                                          </Badge>
                                                        )}
                                                        <p
                                                          className={`text-sm font-medium ${colors.textColor}`}
                                                        >
                                                          {doc.name}
                                                        </p>
                                                        {doc.file?.type?.startsWith(
                                                          "image/"
                                                        ) && (
                                                          <img
                                                            src={doc.preview}
                                                            alt={doc.name}
                                                            className="w-full h-32 object-cover rounded"
                                                          />
                                                        )}
                                                        {doc.file?.type ===
                                                          "application/pdf" && (
                                                          <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                                                            <p className="text-sm text-gray-500">
                                                              PDF Document
                                                            </p>
                                                          </div>
                                                        )}
                                                        <Button
                                                          type="button"
                                                          variant="ghost"
                                                          size="sm"
                                                          onClick={() =>
                                                            handleRemoveIdentityDocument(
                                                              index
                                                            )
                                                          }
                                                          className="w-full text-red-500 hover:text-red-700"
                                                        >
                                                          <X className="h-4 w-4 mr-2" />
                                                          Remove
                                                        </Button>
                                                      </div>
                                                    </CardContent>
                                                  </Card>
                                                )
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {existingIdentifiers.length === 0 &&
                                          identityDocuments.length === 0 && (
                                            <p
                                              className={`text-sm ${colors.textColorMuted} italic`}
                                            >
                                              No identity documents added yet.
                                              Use the template above to see
                                              available document types.
                                            </p>
                                          )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>

                                {/* Divider */}
                                <div className="my-8 border-t border-gray-300 dark:border-gray-700"></div>

                                {/* Other Documents Section */}
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <Label
                                      className={`text-sm font-medium ${colors.textColor}`}
                                    >
                                      Other Documents
                                      {(() => {
                                        // Filter documents that are not linked to any identifier
                                        const otherDocuments =
                                          clientDocuments.filter((doc: any) => {
                                            if (!doc.name) return false;
                                            const extractedId =
                                              extractIdentifierIdFromFilename(
                                                doc.name
                                              );
                                            // If document name doesn't start with IDENTIFIER_ or doesn't match any identifier ID, it's an "other" document
                                            return !extractedId;
                                          });
                                        return otherDocuments.length > 0 ? (
                                          <span className="ml-2 text-xs font-normal">
                                            ({otherDocuments.length})
                                          </span>
                                        ) : null;
                                      })()}
                                    </Label>
                                    <p
                                      className={`text-xs ${colors.textColorMuted}`}
                                    >
                                      Documents that are not linked to any
                                      identifier
                                    </p>
                                  </div>

                                  {/* Upload Document Button */}
                                  <div className="flex items-center gap-2">
                                    <label>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        asChild
                                        disabled={
                                          !fineractClientId ||
                                          uploadingDocuments
                                        }
                                        className="flex items-center gap-2 cursor-pointer"
                                      >
                                        <span>
                                          <UserPlus className="h-4 w-4" />
                                          {uploadingDocuments
                                            ? "Uploading..."
                                            : "Upload Document"}
                                        </span>
                                      </Button>
                                      <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        multiple
                                        onChange={handleAddIdentityDocument}
                                        className="hidden"
                                        disabled={uploadingDocuments}
                                      />
                                    </label>
                                    {uploadingDocuments && (
                                      <div className="flex items-center gap-2 text-xs text-blue-500">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Uploading documents...
                                      </div>
                                    )}
                                  </div>

                                  {(() => {
                                    // Filter documents that are not linked to any identifier
                                    const otherDocuments =
                                      clientDocuments.filter((doc: any) => {
                                        if (!doc.name) return false;
                                        const extractedId =
                                          extractIdentifierIdFromFilename(
                                            doc.name
                                          );
                                        // If document name doesn't start with IDENTIFIER_ or doesn't match any identifier ID, it's an "other" document
                                        return !extractedId;
                                      });

                                    return otherDocuments.length > 0 ? (
                                      <div className="space-y-2">
                                        {otherDocuments.map(
                                          (doc: any, docIndex: number) => {
                                            const isPreviewing =
                                              previewingDocumentId ===
                                                String(doc.id) &&
                                              previewingIdentifierId === null;
                                            const isImage =
                                              doc.type?.includes("image") ||
                                              doc.name?.match(
                                                /\.(jpg|jpeg|png|gif|webp|bmp)$/i
                                              ) ||
                                              doc.fileName?.match(
                                                /\.(jpg|jpeg|png|gif|webp|bmp)$/i
                                              );
                                            const isPdf =
                                              doc.type?.includes("pdf") ||
                                              doc.name?.match(/\.pdf$/i) ||
                                              doc.fileName?.match(/\.pdf$/i);
                                            const previewUrl = fineractClientId
                                              ? `/api/fineract/clients/${fineractClientId}/documents/${doc.id}/attachment`
                                              : null;

                                            return (
                                              <div
                                                key={doc.id || docIndex}
                                                className="space-y-2"
                                              >
                                                <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
                                                  <FileText className="h-3 w-3 text-blue-500 flex-shrink-0" />
                                                  <span
                                                    className={`flex-1 ${colors.textColor} truncate cursor-pointer`}
                                                    onClick={() =>
                                                      handleViewDocument(doc.id)
                                                    }
                                                    title={
                                                      doc.name ||
                                                      doc.fileName ||
                                                      `Document ${docIndex + 1}`
                                                    }
                                                  >
                                                    {doc.name ||
                                                      doc.fileName ||
                                                      `Document ${
                                                        docIndex + 1
                                                      }`}
                                                  </span>
                                                  {doc.size && (
                                                    <span
                                                      className={`${colors.textColorMuted} flex-shrink-0`}
                                                    >
                                                      {(
                                                        doc.size / 1024
                                                      ).toFixed(1)}{" "}
                                                      KB
                                                    </span>
                                                  )}
                                                  <div className="flex items-center gap-1 flex-shrink-0">
                                                    <Button
                                                      type="button"
                                                      variant="ghost"
                                                      size="sm"
                                                      className={`h-6 w-6 p-0 ${
                                                        isPreviewing
                                                          ? "bg-blue-100 dark:bg-blue-900"
                                                          : ""
                                                      }`}
                                                      onClick={() =>
                                                        handleViewDocument(
                                                          doc.id
                                                        )
                                                      }
                                                      title={
                                                        isPreviewing
                                                          ? "Hide preview"
                                                          : "View document"
                                                      }
                                                    >
                                                      <Eye className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                      type="button"
                                                      variant="ghost"
                                                      size="sm"
                                                      className="h-6 w-6 p-0"
                                                      onClick={() =>
                                                        handleDownloadDocument(
                                                          doc.id,
                                                          doc.name ||
                                                            doc.fileName ||
                                                            `document_${doc.id}`
                                                        )
                                                      }
                                                      title="Download document"
                                                    >
                                                      <Download className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                </div>

                                                {/* Inline Preview */}
                                                {isPreviewing && previewUrl && (
                                                  <div className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                                                    {isImage ? (
                                                      <div className="flex items-center justify-center">
                                                        <img
                                                          src={previewUrl}
                                                          alt={
                                                            doc.name ||
                                                            doc.fileName ||
                                                            "Document preview"
                                                          }
                                                          className="max-w-full max-h-96 object-contain rounded-lg shadow-sm"
                                                          onError={(e) => {
                                                            console.error(
                                                              "Error loading image"
                                                            );
                                                            e.currentTarget.style.display =
                                                              "none";
                                                            const errorDiv =
                                                              document.createElement(
                                                                "div"
                                                              );
                                                            errorDiv.className =
                                                              "text-center text-gray-500 p-4 text-sm";
                                                            errorDiv.textContent =
                                                              "Failed to load image. Please try downloading the document.";
                                                            e.currentTarget.parentElement?.appendChild(
                                                              errorDiv
                                                            );
                                                          }}
                                                        />
                                                      </div>
                                                    ) : isPdf ? (
                                                      <div className="w-full h-96">
                                                        <iframe
                                                          src={previewUrl}
                                                          className="w-full h-full border-0 rounded-lg"
                                                          title={
                                                            doc.name ||
                                                            doc.fileName ||
                                                            "Document preview"
                                                          }
                                                        />
                                                      </div>
                                                    ) : (
                                                      <div className="flex flex-col items-center justify-center h-32 space-y-2">
                                                        <FileText className="h-8 w-8 text-gray-400" />
                                                        <p className="text-gray-500 text-sm text-center">
                                                          Preview not available
                                                          for this file type.
                                                        </p>
                                                        <Button
                                                          size="sm"
                                                          variant="outline"
                                                          onClick={() =>
                                                            handleDownloadDocument(
                                                              doc.id,
                                                              doc.name ||
                                                                doc.fileName ||
                                                                `document_${doc.id}`
                                                            )
                                                          }
                                                        >
                                                          <Download className="h-3 w-3 mr-2" />
                                                          Download to View
                                                        </Button>
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          }
                                        )}
                                      </div>
                                    ) : (
                                      <p
                                        className={`text-sm ${colors.textColorMuted} italic`}
                                      >
                                        No other documents found.
                                      </p>
                                    );
                                  })()}
                                </div>
                              </>
                            )}
                          </CardContent>
                          {clientCreatedInFineract && (
                            <CardFooter className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-4">
                              <Button
                                type="button"
                                variant="outline"
                                className={`border-${colors.borderColor} hover:bg-${colors.hoverBgColor}`}
                                onClick={() => setActiveClientTab("general")}
                              >
                                Previous
                              </Button>
                              <Button
                                type="button"
                                className="bg-blue-500 hover:bg-blue-600"
                                onClick={async () => {
                                  // Validate KYC sections before proceeding
                                  // Check if selfie and identity documents are complete
                                  const selfieComplete = checkSelfieSection();
                                  const identityComplete =
                                    checkIdentityDocumentsSection();

                                  if (!selfieComplete || !identityComplete) {
                                    error({
                                      title: "Incomplete KYC",
                                      description:
                                        "Please complete the selfie and identity documents sections before proceeding.",
                                    });
                                    return;
                                  }

                                  setActiveClientTab("additional");
                                }}
                              >
                                <span className="transition-all duration-300">
                                  Next: Additional Details
                                </span>
                              </Button>
                            </CardFooter>
                          )}
                        </Card>
                      </TabsContent>

                      {/* Additional Details Tab */}
                      {clientCreatedInFineract && fineractClientId && (
                        <TabsContent value="additional" className="mt-4">
                          <Card
                            className={`border-${colors.borderColor} ${colors.cardBg}`}
                          >
                            <CardHeader>
                              <CardTitle className={colors.textColor}>
                                Additional Details
                              </CardTitle>
                              <CardDescription
                                className={colors.textColorMuted}
                              >
                                Address, data tables, and family members/next of
                                kin information
                              </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-8">
                              {isLoadingAdditionalDetails ? (
                                <div className="space-y-8">
                                  {/* Address Details Skeleton */}
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                                      <div className="flex items-center gap-2">
                                        <Skeleton className="h-5 w-5" />
                                        <Skeleton className="h-6 w-32" />
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <Skeleton className="h-20 w-full" />
                                      <Skeleton className="h-20 w-full" />
                                      <Skeleton className="h-20 w-full" />
                                      <Skeleton className="h-20 w-full" />
                                    </div>
                                  </div>

                                  {/* Data Tables Skeleton */}
                                  <div className="space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                                      <Skeleton className="h-5 w-5" />
                                      <Skeleton className="h-6 w-48" />
                                    </div>
                                    <div className="space-y-4">
                                      <Skeleton className="h-32 w-full" />
                                      <Skeleton className="h-32 w-full" />
                                    </div>
                                  </div>

                                  {/* Family Members Skeleton */}
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                                      <div className="flex items-center gap-2">
                                        <Skeleton className="h-5 w-5" />
                                        <Skeleton className="h-6 w-40" />
                                      </div>
                                      <Skeleton className="h-9 w-32" />
                                    </div>
                                    <div className="space-y-4">
                                      <Skeleton className="h-24 w-full" />
                                      <Skeleton className="h-24 w-full" />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {/* Address Details */}
                                  <Card className="border-green-500 bg-green-50 dark:bg-green-950">
                                    <CardContent className="pt-6">
                                      <div className="space-y-4">
                                        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                                          <div className="flex items-center gap-2">
                                            <MapPin className="h-5 w-5 text-blue-500" />
                                            <h3
                                              className={`text-lg font-semibold ${colors.textColor}`}
                                            >
                                              Address Details
                                            </h3>
                                          </div>
                                          {!isEditingAddress &&
                                            fineractClientId && (
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  // Convert addressType string to ID if needed when initializing edit
                                                  let addressToEdit =
                                                    clientAddress || {};
                                                  if (
                                                    addressToEdit.addressType &&
                                                    typeof addressToEdit.addressType ===
                                                      "string" &&
                                                    addressTemplate
                                                  ) {
                                                    const addressTypeOptions =
                                                      addressTemplate?.addressTypeIdOptions ||
                                                      [];
                                                    const matchingType =
                                                      addressTypeOptions.find(
                                                        (opt: any) =>
                                                          opt.name?.trim() ===
                                                          addressToEdit.addressType?.trim()
                                                      );
                                                    if (
                                                      matchingType &&
                                                      matchingType.id
                                                    ) {
                                                      addressToEdit = {
                                                        ...addressToEdit,
                                                        addressType:
                                                          matchingType.id, // Convert string to numeric ID
                                                      };
                                                      console.log(
                                                        "Converted addressType to ID when editing:",
                                                        matchingType.id,
                                                        "for:",
                                                        matchingType.name
                                                      );
                                                    }
                                                  }
                                                  setEditedAddress(
                                                    addressToEdit
                                                  );
                                                  setIsEditingAddress(true);
                                                }}
                                                className="gap-2"
                                              >
                                                <Edit2 className="h-4 w-4" />
                                                {clientAddress
                                                  ? "Edit"
                                                  : "Add"}{" "}
                                                Address
                                              </Button>
                                            )}
                                        </div>
                                        {isEditingAddress ? (
                                          <div
                                            className={`rounded-lg border border-${colors.borderColor} ${colors.cardBg} shadow-sm p-6`}
                                          >
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                              {addressFieldConfig.length > 0 ? (
                                                addressFieldConfig.map(
                                                  (fieldConfig: any) => {
                                                    const fieldName =
                                                      fieldConfig.field;
                                                    const fieldValue =
                                                      editedAddress[
                                                        fieldName
                                                      ] || "";
                                                    const isRequired =
                                                      fieldConfig.isMandatory;
                                                    const label =
                                                      formatHeaderName(
                                                        fieldName
                                                      );

                                                    // Handle special field types
                                                    if (
                                                      fieldName ===
                                                      "addressType"
                                                    ) {
                                                      // Address type dropdown from template
                                                      const addressTypeOptions =
                                                        (
                                                          addressTemplate?.addressTypeIdOptions ||
                                                          []
                                                        )
                                                          .filter(
                                                            (opt: any) =>
                                                              opt.active
                                                          )
                                                          .map(
                                                            (option: any) => ({
                                                              value:
                                                                option.id.toString(),
                                                              label:
                                                                option.name,
                                                            })
                                                          );
                                                      return (
                                                        <div
                                                          key={fieldName}
                                                          className="space-y-2"
                                                        >
                                                          <Label
                                                            className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                          >
                                                            {label}
                                                            {isRequired && (
                                                              <span className="text-red-500 ml-1">
                                                                *
                                                              </span>
                                                            )}
                                                          </Label>
                                                          <SearchableSelect
                                                            options={
                                                              addressTypeOptions
                                                            }
                                                            value={
                                                              fieldValue?.toString() ||
                                                              ""
                                                            }
                                                            onValueChange={(
                                                              value
                                                            ) =>
                                                              setEditedAddress({
                                                                ...editedAddress,
                                                                [fieldName]:
                                                                  parseInt(
                                                                    value
                                                                  ) || 0,
                                                              })
                                                            }
                                                            placeholder={`Select ${label}`}
                                                            className={`border-${colors.borderColor} ${colors.inputBg}`}
                                                            onAddNew={() =>
                                                              setShowAddAddressTypeDialog(
                                                                true
                                                              )
                                                            }
                                                            addNewLabel="Add new address type"
                                                          />
                                                        </div>
                                                      );
                                                    }

                                                    if (
                                                      fieldName ===
                                                      "stateProvinceId"
                                                    ) {
                                                      // State/Province dropdown from template
                                                      const stateProvinceOptions =
                                                        (
                                                          addressTemplate?.stateProvinceIdOptions ||
                                                          []
                                                        ).map(
                                                          (option: any) => ({
                                                            value:
                                                              option.id?.toString() ||
                                                              option.toString(),
                                                            label:
                                                              option.name ||
                                                              option.toString(),
                                                          })
                                                        );
                                                      return (
                                                        <div
                                                          key={fieldName}
                                                          className="space-y-2"
                                                        >
                                                          <Label
                                                            className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                          >
                                                            {label}
                                                            {isRequired && (
                                                              <span className="text-red-500 ml-1">
                                                                *
                                                              </span>
                                                            )}
                                                          </Label>
                                                          <SearchableSelect
                                                            options={
                                                              stateProvinceOptions
                                                            }
                                                            value={
                                                              fieldValue?.toString() ||
                                                              ""
                                                            }
                                                            onValueChange={(
                                                              value
                                                            ) =>
                                                              setEditedAddress({
                                                                ...editedAddress,
                                                                [fieldName]:
                                                                  parseInt(
                                                                    value
                                                                  ) || 0,
                                                              })
                                                            }
                                                            placeholder={`Select ${label}`}
                                                            className={`border-${colors.borderColor} ${colors.inputBg}`}
                                                            onAddNew={() =>
                                                              setShowAddStateProvinceDialog(
                                                                true
                                                              )
                                                            }
                                                            addNewLabel="Add new state/province"
                                                            emptyMessage="No states/provinces available"
                                                          />
                                                        </div>
                                                      );
                                                    }

                                                    if (
                                                      fieldName === "countryId"
                                                    ) {
                                                      // Country dropdown from template
                                                      const countryOptions = (
                                                        addressTemplate?.countryIdOptions ||
                                                        []
                                                      ).map((option: any) => ({
                                                        value:
                                                          option.id?.toString() ||
                                                          option.toString(),
                                                        label:
                                                          option.name ||
                                                          option.toString(),
                                                      }));
                                                      return (
                                                        <div
                                                          key={fieldName}
                                                          className="space-y-2"
                                                        >
                                                          <Label
                                                            className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                          >
                                                            {label}
                                                            {isRequired && (
                                                              <span className="text-red-500 ml-1">
                                                                *
                                                              </span>
                                                            )}
                                                          </Label>
                                                          <SearchableSelect
                                                            options={
                                                              countryOptions
                                                            }
                                                            value={
                                                              fieldValue?.toString() ||
                                                              ""
                                                            }
                                                            onValueChange={(
                                                              value
                                                            ) =>
                                                              setEditedAddress({
                                                                ...editedAddress,
                                                                [fieldName]:
                                                                  parseInt(
                                                                    value
                                                                  ) || 0,
                                                              })
                                                            }
                                                            placeholder={`Select ${label}`}
                                                            className={`border-${colors.borderColor} ${colors.inputBg}`}
                                                            onAddNew={() =>
                                                              setShowAddCountryDialog(
                                                                true
                                                              )
                                                            }
                                                            addNewLabel="Add new country"
                                                            emptyMessage="No countries available"
                                                          />
                                                        </div>
                                                      );
                                                    }

                                                    if (
                                                      fieldName ===
                                                        "latitude" ||
                                                      fieldName === "longitude"
                                                    ) {
                                                      // These are decimal numbers
                                                      return (
                                                        <div
                                                          key={fieldName}
                                                          className="space-y-2"
                                                        >
                                                          <Label
                                                            className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                          >
                                                            {label}
                                                            {isRequired && (
                                                              <span className="text-red-500 ml-1">
                                                                *
                                                              </span>
                                                            )}
                                                          </Label>
                                                          <Input
                                                            type="number"
                                                            step="0.00000001"
                                                            value={fieldValue}
                                                            onChange={(e) =>
                                                              setEditedAddress({
                                                                ...editedAddress,
                                                                [fieldName]:
                                                                  parseFloat(
                                                                    e.target
                                                                      .value
                                                                  ) || 0,
                                                              })
                                                            }
                                                            placeholder={label}
                                                            className={
                                                              colors.textColor
                                                            }
                                                            required={
                                                              isRequired
                                                            }
                                                          />
                                                        </div>
                                                      );
                                                    }

                                                    if (
                                                      fieldName === "isActive"
                                                    ) {
                                                      // Boolean field
                                                      return (
                                                        <div
                                                          key={fieldName}
                                                          className="space-y-2"
                                                        >
                                                          <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                              checked={Boolean(
                                                                fieldValue
                                                              )}
                                                              onCheckedChange={(
                                                                checked
                                                              ) =>
                                                                setEditedAddress(
                                                                  {
                                                                    ...editedAddress,
                                                                    [fieldName]:
                                                                      checked,
                                                                  }
                                                                )
                                                              }
                                                            />
                                                            <Label
                                                              className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                            >
                                                              {label}
                                                              {isRequired && (
                                                                <span className="text-red-500 ml-1">
                                                                  *
                                                                </span>
                                                              )}
                                                            </Label>
                                                          </div>
                                                        </div>
                                                      );
                                                    }

                                                    // Default: text input
                                                    return (
                                                      <div
                                                        key={fieldName}
                                                        className="space-y-2"
                                                      >
                                                        <Label
                                                          className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                        >
                                                          {label}
                                                          {isRequired && (
                                                            <span className="text-red-500 ml-1">
                                                              *
                                                            </span>
                                                          )}
                                                        </Label>
                                                        <Input
                                                          value={fieldValue}
                                                          onChange={(e) =>
                                                            setEditedAddress({
                                                              ...editedAddress,
                                                              [fieldName]:
                                                                e.target.value,
                                                            })
                                                          }
                                                          placeholder={label}
                                                          className={
                                                            colors.textColor
                                                          }
                                                          required={isRequired}
                                                        />
                                                      </div>
                                                    );
                                                  }
                                                )
                                              ) : (
                                                // Fallback: show common address fields if config not loaded yet
                                                <>
                                                  <div className="space-y-2">
                                                    <Label
                                                      className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                    >
                                                      Address Type
                                                    </Label>
                                                    <SearchableSelect
                                                      options={(
                                                        addressTemplate?.addressTypeIdOptions ||
                                                        []
                                                      )
                                                        .filter(
                                                          (opt: any) =>
                                                            opt.active
                                                        )
                                                        .map((option: any) => ({
                                                          value:
                                                            option.id.toString(),
                                                          label: option.name,
                                                        }))}
                                                      value={
                                                        editedAddress.addressType?.toString() ||
                                                        ""
                                                      }
                                                      onValueChange={(value) =>
                                                        setEditedAddress({
                                                          ...editedAddress,
                                                          addressType:
                                                            parseInt(value) ||
                                                            0,
                                                        })
                                                      }
                                                      placeholder="Select Address Type"
                                                      className={`border-${colors.borderColor} ${colors.inputBg}`}
                                                      onAddNew={() =>
                                                        setShowAddAddressTypeDialog(
                                                          true
                                                        )
                                                      }
                                                      addNewLabel="Add new address type"
                                                    />
                                                  </div>
                                                  <div className="space-y-2">
                                                    <Label
                                                      className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                    >
                                                      Address Line 1
                                                    </Label>
                                                    <Input
                                                      value={
                                                        editedAddress.addressLine1 ||
                                                        ""
                                                      }
                                                      onChange={(e) =>
                                                        setEditedAddress({
                                                          ...editedAddress,
                                                          addressLine1:
                                                            e.target.value,
                                                        })
                                                      }
                                                      placeholder="Address Line 1"
                                                      className={
                                                        colors.textColor
                                                      }
                                                    />
                                                  </div>
                                                  <div className="space-y-2">
                                                    <Label
                                                      className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                    >
                                                      Address Line 2
                                                    </Label>
                                                    <Input
                                                      value={
                                                        editedAddress.addressLine2 ||
                                                        ""
                                                      }
                                                      onChange={(e) =>
                                                        setEditedAddress({
                                                          ...editedAddress,
                                                          addressLine2:
                                                            e.target.value,
                                                        })
                                                      }
                                                      placeholder="Address Line 2"
                                                      className={
                                                        colors.textColor
                                                      }
                                                    />
                                                  </div>
                                                  <div className="space-y-2">
                                                    <Label
                                                      className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                    >
                                                      Address Line 3
                                                    </Label>
                                                    <Input
                                                      value={
                                                        editedAddress.addressLine3 ||
                                                        ""
                                                      }
                                                      onChange={(e) =>
                                                        setEditedAddress({
                                                          ...editedAddress,
                                                          addressLine3:
                                                            e.target.value,
                                                        })
                                                      }
                                                      placeholder="Address Line 3"
                                                      className={
                                                        colors.textColor
                                                      }
                                                    />
                                                  </div>
                                                  <div className="space-y-2">
                                                    <Label
                                                      className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                    >
                                                      City
                                                    </Label>
                                                    <Input
                                                      value={
                                                        editedAddress.city || ""
                                                      }
                                                      onChange={(e) =>
                                                        setEditedAddress({
                                                          ...editedAddress,
                                                          city: e.target.value,
                                                        })
                                                      }
                                                      placeholder="City"
                                                      className={
                                                        colors.textColor
                                                      }
                                                    />
                                                  </div>
                                                  <div className="space-y-2">
                                                    <Label
                                                      className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                    >
                                                      Town/Village
                                                    </Label>
                                                    <Input
                                                      value={
                                                        editedAddress.townVillage ||
                                                        ""
                                                      }
                                                      onChange={(e) =>
                                                        setEditedAddress({
                                                          ...editedAddress,
                                                          townVillage:
                                                            e.target.value,
                                                        })
                                                      }
                                                      placeholder="Town/Village"
                                                      className={
                                                        colors.textColor
                                                      }
                                                    />
                                                  </div>
                                                  <div className="space-y-2">
                                                    <Label
                                                      className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                    >
                                                      Postal Code
                                                    </Label>
                                                    <Input
                                                      value={
                                                        editedAddress.postalCode ||
                                                        ""
                                                      }
                                                      onChange={(e) =>
                                                        setEditedAddress({
                                                          ...editedAddress,
                                                          postalCode:
                                                            e.target.value,
                                                        })
                                                      }
                                                      placeholder="Postal Code"
                                                      className={
                                                        colors.textColor
                                                      }
                                                    />
                                                  </div>
                                                  <div className="space-y-2">
                                                    <Label
                                                      className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                    >
                                                      State/Province
                                                    </Label>
                                                    <SearchableSelect
                                                      options={(
                                                        addressTemplate?.stateProvinceIdOptions ||
                                                        []
                                                      ).map((option: any) => ({
                                                        value:
                                                          option.id?.toString() ||
                                                          option.toString(),
                                                        label:
                                                          option.name ||
                                                          option.toString(),
                                                      }))}
                                                      value={
                                                        editedAddress.stateProvinceId?.toString() ||
                                                        ""
                                                      }
                                                      onValueChange={(value) =>
                                                        setEditedAddress({
                                                          ...editedAddress,
                                                          stateProvinceId:
                                                            parseInt(value) ||
                                                            0,
                                                        })
                                                      }
                                                      placeholder="Select State/Province"
                                                      className={`border-${colors.borderColor} ${colors.inputBg}`}
                                                      onAddNew={() =>
                                                        setShowAddStateProvinceDialog(
                                                          true
                                                        )
                                                      }
                                                      addNewLabel="Add new state/province"
                                                      emptyMessage="No states/provinces available"
                                                    />
                                                  </div>
                                                  <div className="space-y-2">
                                                    <Label
                                                      className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                    >
                                                      Country
                                                    </Label>
                                                    <SearchableSelect
                                                      options={(
                                                        addressTemplate?.countryIdOptions ||
                                                        []
                                                      ).map((option: any) => ({
                                                        value:
                                                          option.id?.toString() ||
                                                          option.toString(),
                                                        label:
                                                          option.name ||
                                                          option.toString(),
                                                      }))}
                                                      value={
                                                        editedAddress.countryId?.toString() ||
                                                        ""
                                                      }
                                                      onValueChange={(value) =>
                                                        setEditedAddress({
                                                          ...editedAddress,
                                                          countryId:
                                                            parseInt(value) ||
                                                            0,
                                                        })
                                                      }
                                                      placeholder="Select Country"
                                                      className={`border-${colors.borderColor} ${colors.inputBg}`}
                                                      onAddNew={() =>
                                                        setShowAddCountryDialog(
                                                          true
                                                        )
                                                      }
                                                      addNewLabel="Add new country"
                                                      emptyMessage="No countries available"
                                                    />
                                                  </div>
                                                  <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                      checked={Boolean(
                                                        editedAddress.isActive
                                                      )}
                                                      onCheckedChange={(
                                                        checked
                                                      ) =>
                                                        setEditedAddress({
                                                          ...editedAddress,
                                                          isActive: checked,
                                                        })
                                                      }
                                                    />
                                                    <Label
                                                      className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                    >
                                                      Is Active
                                                    </Label>
                                                  </div>
                                                </>
                                              )}
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  setIsEditingAddress(false);
                                                  setEditedAddress({});
                                                }}
                                                disabled={savingAddress}
                                                className="gap-2"
                                              >
                                                <X className="h-4 w-4" />
                                                Cancel
                                              </Button>
                                              <Button
                                                type="button"
                                                size="sm"
                                                onClick={async () => {
                                                  if (!fineractClientId) return;
                                                  setSavingAddress(true);
                                                  try {
                                                    // If we have an existing address with an addressType, update it
                                                    // Otherwise, create a new one
                                                    // Fineract uses addressType as query parameter for updates, not addressId
                                                    // Ensure addressType is a number (ID), not a string name
                                                    let addressType =
                                                      editedAddress.addressType ||
                                                      clientAddress?.addressType ||
                                                      clientAddress?.addressTypeId;

                                                    // If addressType is a string, look it up in the template to get the ID
                                                    if (
                                                      typeof addressType ===
                                                        "string" &&
                                                      addressTemplate
                                                    ) {
                                                      const addressTypeOptions =
                                                        addressTemplate?.addressTypeIdOptions ||
                                                        [];
                                                      const matchingType =
                                                        addressTypeOptions.find(
                                                          (opt: any) =>
                                                            opt.name?.trim() ===
                                                            addressType?.trim()
                                                        );
                                                      if (
                                                        matchingType &&
                                                        matchingType.id
                                                      ) {
                                                        addressType =
                                                          matchingType.id;
                                                        console.log(
                                                          "Converted addressType string to ID:",
                                                          addressType,
                                                          "for:",
                                                          matchingType.name
                                                        );
                                                      } else {
                                                        // If not found, try to parse as number
                                                        addressType =
                                                          parseInt(addressType);
                                                      }
                                                    } else if (
                                                      typeof addressType ===
                                                      "string"
                                                    ) {
                                                      // If template not loaded, try to parse as number
                                                      addressType =
                                                        parseInt(addressType);
                                                    }

                                                    // Ensure it's a valid number and not 0
                                                    if (
                                                      addressType &&
                                                      (isNaN(addressType) ||
                                                        addressType === 0)
                                                    ) {
                                                      addressType = undefined;
                                                    }

                                                    // Validate that addressType is set for both create and update
                                                    if (
                                                      !addressType ||
                                                      addressType === 0
                                                    ) {
                                                      error({
                                                        title:
                                                          "Validation Error",
                                                        description:
                                                          "Please select an address type before saving",
                                                      });
                                                      setSavingAddress(false);
                                                      return;
                                                    }

                                                    const hasExistingAddress =
                                                      clientAddress &&
                                                      addressType &&
                                                      !isNaN(addressType) &&
                                                      addressType !== 0;

                                                    const endpoint =
                                                      hasExistingAddress
                                                        ? `/api/fineract/clients/${fineractClientId}/addresses/${addressType}`
                                                        : `/api/fineract/clients/${fineractClientId}/addresses`;
                                                    const method =
                                                      hasExistingAddress
                                                        ? "PUT"
                                                        : "POST";

                                                    // Ensure editedAddress has the correct addressType
                                                    const addressPayload = {
                                                      ...editedAddress,
                                                      addressType: addressType, // Ensure we use the validated addressType
                                                      dateFormat: "yyyy-MM-dd",
                                                      locale: "en",
                                                    };

                                                    const response =
                                                      await fetch(endpoint, {
                                                        method,
                                                        headers: {
                                                          "Content-Type":
                                                            "application/json",
                                                        },
                                                        body: JSON.stringify(
                                                          addressPayload
                                                        ),
                                                      });

                                                    if (!response.ok) {
                                                      const error =
                                                        await response.json();
                                                      throw new Error(
                                                        error.error ||
                                                          error.details
                                                            ?.defaultUserMessage ||
                                                          "Failed to save address"
                                                      );
                                                    }

                                                    const savedAddress =
                                                      await response.json();

                                                    // Refresh addresses list
                                                    const addressesResponse =
                                                      await fetch(
                                                        `/api/fineract/clients/${fineractClientId}/addresses`
                                                      );
                                                    if (addressesResponse.ok) {
                                                      const addressesData =
                                                        await addressesResponse.json();
                                                      const address =
                                                        Array.isArray(
                                                          addressesData
                                                        )
                                                          ? addressesData[0] ||
                                                            null
                                                          : addressesData ||
                                                            null;
                                                      setClientAddress(address);
                                                    }

                                                    setIsEditingAddress(false);
                                                    setEditedAddress({});

                                                    success({
                                                      title: "Success",
                                                      description:
                                                        hasExistingAddress
                                                          ? "Address updated successfully"
                                                          : "Address created successfully",
                                                    });
                                                  } catch (err: any) {
                                                    console.error(
                                                      "Error saving address:",
                                                      err
                                                    );
                                                    error({
                                                      title: "Error",
                                                      description:
                                                        err.message ||
                                                        "Failed to save address",
                                                    });
                                                  } finally {
                                                    setSavingAddress(false);
                                                  }
                                                }}
                                                disabled={savingAddress}
                                                className="gap-2 bg-blue-500 hover:bg-blue-600"
                                              >
                                                {savingAddress ? (
                                                  <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Saving...
                                                  </>
                                                ) : (
                                                  <>
                                                    <Save className="h-4 w-4" />
                                                    Save
                                                  </>
                                                )}
                                              </Button>
                                            </div>
                                          </div>
                                        ) : clientAddress ? (
                                          <div
                                            className={`rounded-lg border border-${colors.borderColor} ${colors.cardBg} shadow-sm p-6`}
                                          >
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                              {addressFieldConfig.length > 0 ? (
                                                // Use field configuration if available
                                                addressFieldConfig.map(
                                                  (fieldConfig: any) => {
                                                    const fieldName =
                                                      fieldConfig.field;
                                                    let fieldValue =
                                                      clientAddress[fieldName];

                                                    // Only show fields that have values and are enabled
                                                    if (
                                                      !fieldValue &&
                                                      fieldValue !== 0 &&
                                                      fieldValue !== false
                                                    ) {
                                                      return null;
                                                    }

                                                    const label =
                                                      formatHeaderName(
                                                        fieldName
                                                      );

                                                    // Convert IDs to names for display FIRST (before number formatting)
                                                    // This must happen before the number formatting check
                                                    if (
                                                      fieldName ===
                                                      "addressType"
                                                    ) {
                                                      // Handle both number and string IDs
                                                      const idValue =
                                                        typeof fieldValue ===
                                                        "string"
                                                          ? parseInt(fieldValue)
                                                          : fieldValue;

                                                      if (
                                                        idValue === 0 ||
                                                        !idValue ||
                                                        isNaN(idValue)
                                                      ) {
                                                        fieldValue = "Unknown";
                                                      } else if (
                                                        addressTemplate
                                                      ) {
                                                        const addressTypeOptions =
                                                          addressTemplate?.addressTypeIdOptions ||
                                                          [];
                                                        const matchingType =
                                                          addressTypeOptions.find(
                                                            (opt: any) =>
                                                              opt.id === idValue
                                                          );
                                                        fieldValue =
                                                          matchingType?.name?.trim() ||
                                                          `Unknown (ID: ${idValue})`;
                                                      } else if (
                                                        typeof fieldValue ===
                                                        "string"
                                                      ) {
                                                        fieldValue =
                                                          fieldValue.trim();
                                                      }
                                                    } else if (
                                                      fieldName ===
                                                      "stateProvinceId"
                                                    ) {
                                                      // Handle both number and string IDs
                                                      const idValue =
                                                        typeof fieldValue ===
                                                        "string"
                                                          ? parseInt(fieldValue)
                                                          : fieldValue;

                                                      if (
                                                        idValue === 0 ||
                                                        !idValue ||
                                                        isNaN(idValue)
                                                      ) {
                                                        fieldValue = "Unknown";
                                                      } else if (
                                                        addressTemplate
                                                      ) {
                                                        const stateProvinceOptions =
                                                          addressTemplate?.stateProvinceIdOptions ||
                                                          [];
                                                        const matchingState =
                                                          stateProvinceOptions.find(
                                                            (opt: any) =>
                                                              opt.id === idValue
                                                          );
                                                        fieldValue =
                                                          matchingState?.name?.trim() ||
                                                          `Unknown (ID: ${idValue})`;
                                                      }
                                                    } else if (
                                                      fieldName === "countryId"
                                                    ) {
                                                      // Handle both number and string IDs
                                                      const idValue =
                                                        typeof fieldValue ===
                                                        "string"
                                                          ? parseInt(fieldValue)
                                                          : fieldValue;

                                                      if (
                                                        idValue === 0 ||
                                                        !idValue ||
                                                        isNaN(idValue)
                                                      ) {
                                                        fieldValue = "Unknown";
                                                      } else if (
                                                        addressTemplate
                                                      ) {
                                                        const countryOptions =
                                                          addressTemplate?.countryIdOptions ||
                                                          [];
                                                        const matchingCountry =
                                                          countryOptions.find(
                                                            (opt: any) =>
                                                              opt.id === idValue
                                                          );
                                                        fieldValue =
                                                          matchingCountry?.name?.trim() ||
                                                          `Unknown (ID: ${idValue})`;
                                                      }
                                                    }

                                                    // Format boolean values
                                                    if (
                                                      fieldName === "isActive"
                                                    ) {
                                                      return (
                                                        <div
                                                          key={fieldName}
                                                          className="space-y-1"
                                                        >
                                                          <p
                                                            className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                          >
                                                            {label}
                                                          </p>
                                                          <Badge
                                                            variant={
                                                              fieldValue
                                                                ? "default"
                                                                : "outline"
                                                            }
                                                            className={
                                                              fieldValue
                                                                ? "bg-green-500 hover:bg-green-600"
                                                                : ""
                                                            }
                                                          >
                                                            {fieldValue
                                                              ? "Yes"
                                                              : "No"}
                                                          </Badge>
                                                        </div>
                                                      );
                                                    }

                                                    // Format number values (but skip ID fields that were already converted)
                                                    if (
                                                      typeof fieldValue ===
                                                        "number" &&
                                                      fieldName !==
                                                        "addressType" &&
                                                      fieldName !==
                                                        "stateProvinceId" &&
                                                      fieldName !== "countryId"
                                                    ) {
                                                      return (
                                                        <div
                                                          key={fieldName}
                                                          className="space-y-1"
                                                        >
                                                          <p
                                                            className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                          >
                                                            {label}
                                                          </p>
                                                          <p
                                                            className={`text-sm ${colors.textColor} font-medium`}
                                                          >
                                                            {fieldValue.toLocaleString()}
                                                          </p>
                                                        </div>
                                                      );
                                                    }

                                                    // Default: text value
                                                    return (
                                                      <div
                                                        key={fieldName}
                                                        className="space-y-1"
                                                      >
                                                        <p
                                                          className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                        >
                                                          {label}
                                                        </p>
                                                        <p
                                                          className={`text-sm ${colors.textColor} font-medium`}
                                                        >
                                                          {String(fieldValue)}
                                                        </p>
                                                      </div>
                                                    );
                                                  }
                                                )
                                              ) : (
                                                // Fallback: show common address fields if config not loaded yet
                                                <>
                                                  {clientAddress.addressLine1 && (
                                                    <div className="space-y-1">
                                                      <p
                                                        className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                      >
                                                        Address Line 1
                                                      </p>
                                                      <p
                                                        className={`text-sm ${colors.textColor} font-medium`}
                                                      >
                                                        {
                                                          clientAddress.addressLine1
                                                        }
                                                      </p>
                                                    </div>
                                                  )}
                                                  {clientAddress.addressLine2 && (
                                                    <div className="space-y-1">
                                                      <p
                                                        className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                      >
                                                        Address Line 2
                                                      </p>
                                                      <p
                                                        className={`text-sm ${colors.textColor} font-medium`}
                                                      >
                                                        {
                                                          clientAddress.addressLine2
                                                        }
                                                      </p>
                                                    </div>
                                                  )}
                                                  {clientAddress.addressLine3 && (
                                                    <div className="space-y-1">
                                                      <p
                                                        className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                      >
                                                        Address Line 3
                                                      </p>
                                                      <p
                                                        className={`text-sm ${colors.textColor} font-medium`}
                                                      >
                                                        {
                                                          clientAddress.addressLine3
                                                        }
                                                      </p>
                                                    </div>
                                                  )}
                                                  {clientAddress.city && (
                                                    <div className="space-y-1">
                                                      <p
                                                        className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                      >
                                                        City
                                                      </p>
                                                      <p
                                                        className={`text-sm ${colors.textColor} font-medium`}
                                                      >
                                                        {clientAddress.city}
                                                      </p>
                                                    </div>
                                                  )}
                                                  {clientAddress.townVillage && (
                                                    <div className="space-y-1">
                                                      <p
                                                        className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                      >
                                                        Town/Village
                                                      </p>
                                                      <p
                                                        className={`text-sm ${colors.textColor} font-medium`}
                                                      >
                                                        {
                                                          clientAddress.townVillage
                                                        }
                                                      </p>
                                                    </div>
                                                  )}
                                                  {clientAddress.postalCode && (
                                                    <div className="space-y-1">
                                                      <p
                                                        className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                      >
                                                        Postal Code
                                                      </p>
                                                      <p
                                                        className={`text-sm ${colors.textColor} font-medium`}
                                                      >
                                                        {
                                                          clientAddress.postalCode
                                                        }
                                                      </p>
                                                    </div>
                                                  )}
                                                  {/* Show address type, state, and country with name conversion */}
                                                  {clientAddress.addressType !==
                                                    undefined && (
                                                    <div className="space-y-1">
                                                      <p
                                                        className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                      >
                                                        Address Type
                                                      </p>
                                                      <p
                                                        className={`text-sm ${colors.textColor} font-medium`}
                                                      >
                                                        {(() => {
                                                          const addressTypeValue =
                                                            clientAddress.addressType;
                                                          if (
                                                            addressTypeValue ===
                                                              0 ||
                                                            !addressTypeValue
                                                          ) {
                                                            return "Unknown";
                                                          } else if (
                                                            typeof addressTypeValue ===
                                                              "number" &&
                                                            addressTemplate
                                                          ) {
                                                            const addressTypeOptions =
                                                              addressTemplate?.addressTypeIdOptions ||
                                                              [];
                                                            const matchingType =
                                                              addressTypeOptions.find(
                                                                (opt: any) =>
                                                                  opt.id ===
                                                                  addressTypeValue
                                                              );
                                                            return (
                                                              matchingType?.name?.trim() ||
                                                              `Unknown (ID: ${addressTypeValue})`
                                                            );
                                                          } else if (
                                                            typeof addressTypeValue ===
                                                            "string"
                                                          ) {
                                                            return addressTypeValue.trim();
                                                          }
                                                          return String(
                                                            addressTypeValue
                                                          );
                                                        })()}
                                                      </p>
                                                    </div>
                                                  )}
                                                  {clientAddress.stateProvinceId !==
                                                    undefined && (
                                                    <div className="space-y-1">
                                                      <p
                                                        className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                      >
                                                        State/Province
                                                      </p>
                                                      <p
                                                        className={`text-sm ${colors.textColor} font-medium`}
                                                      >
                                                        {(() => {
                                                          const stateValue =
                                                            clientAddress.stateProvinceId;
                                                          if (
                                                            stateValue === 0 ||
                                                            !stateValue
                                                          ) {
                                                            return "Unknown";
                                                          } else if (
                                                            typeof stateValue ===
                                                              "number" &&
                                                            addressTemplate
                                                          ) {
                                                            const stateProvinceOptions =
                                                              addressTemplate?.stateProvinceIdOptions ||
                                                              [];
                                                            const matchingState =
                                                              stateProvinceOptions.find(
                                                                (opt: any) =>
                                                                  opt.id ===
                                                                  stateValue
                                                              );
                                                            return (
                                                              matchingState?.name?.trim() ||
                                                              `Unknown (ID: ${stateValue})`
                                                            );
                                                          }
                                                          return String(
                                                            stateValue
                                                          );
                                                        })()}
                                                      </p>
                                                    </div>
                                                  )}
                                                  {clientAddress.countryId !==
                                                    undefined && (
                                                    <div className="space-y-1">
                                                      <p
                                                        className={`text-xs font-semibold uppercase tracking-wide ${colors.textColorMuted}`}
                                                      >
                                                        Country
                                                      </p>
                                                      <p
                                                        className={`text-sm ${colors.textColor} font-medium`}
                                                      >
                                                        {(() => {
                                                          const countryValue =
                                                            clientAddress.countryId;
                                                          if (
                                                            countryValue ===
                                                              0 ||
                                                            !countryValue
                                                          ) {
                                                            return "Unknown";
                                                          } else if (
                                                            typeof countryValue ===
                                                              "number" &&
                                                            addressTemplate
                                                          ) {
                                                            const countryOptions =
                                                              addressTemplate?.countryIdOptions ||
                                                              [];
                                                            const matchingCountry =
                                                              countryOptions.find(
                                                                (opt: any) =>
                                                                  opt.id ===
                                                                  countryValue
                                                              );
                                                            return (
                                                              matchingCountry?.name?.trim() ||
                                                              `Unknown (ID: ${countryValue})`
                                                            );
                                                          }
                                                          return String(
                                                            countryValue
                                                          );
                                                        })()}
                                                      </p>
                                                    </div>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <div
                                            className={`rounded-lg border border-dashed border-${colors.borderColor} ${colors.cardBg} p-6 text-center`}
                                          >
                                            <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                            <p
                                              className={`text-sm ${colors.textColorMuted}`}
                                            >
                                              No address information available
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>

                                  {/* Data Tables */}
                                  <Card className="border-green-500 bg-green-50 dark:bg-green-950">
                                    <CardContent className="pt-6">
                                      <div className="space-y-4">
                                        <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                                          <Database className="h-5 w-5 text-blue-500" />
                                          <h3
                                            className={`text-lg font-semibold ${colors.textColor}`}
                                          >
                                            Associated Data Tables
                                          </h3>
                                        </div>
                                        {dataTables.length > 0 ? (
                                          <div className="space-y-6">
                                            {dataTables.map((table: any) => (
                                              <div
                                                key={
                                                  table.registeredTableName ||
                                                  table.datatableName
                                                }
                                                className={`rounded-lg border border-${colors.borderColor} ${colors.cardBg} shadow-sm`}
                                              >
                                                <div className="px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                                                  <h4
                                                    className={`text-base font-semibold ${colors.textColor} flex items-center gap-2`}
                                                  >
                                                    <Building2 className="h-4 w-4 text-blue-500" />
                                                    {table.registeredTableName ||
                                                      table.displayName ||
                                                      table.datatableName}
                                                  </h4>
                                                </div>
                                                <div className="p-6">
                                                  {fineractClientId && (
                                                    <DynamicDatatableContent
                                                      datatableName={
                                                        table.registeredTableName ||
                                                        table.datatableName
                                                      }
                                                      clientId={
                                                        fineractClientId
                                                      }
                                                    />
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <Card
                                            className={`border-${colors.borderColor} ${colors.cardBg} border-dashed`}
                                          >
                                            <CardContent className="p-6 text-center">
                                              <Database className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                              <p
                                                className={`text-sm ${colors.textColorMuted}`}
                                              >
                                                No data tables configured
                                              </p>
                                            </CardContent>
                                          </Card>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>

                                  {/* Family Members / Next of Kin */}
                                  <Card className="border-green-500 bg-green-50 dark:bg-green-950">
                                    <CardContent className="pt-6">
                                      <div className="space-y-4">
                                        <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                                          <div className="flex items-center gap-2">
                                            <Users className="h-5 w-5 text-blue-500" />
                                            <h3
                                              className={`text-lg font-semibold ${colors.textColor}`}
                                            >
                                              Family Members / Next of Kin
                                            </h3>
                                          </div>
                                          {!isAddingFamilyMember && (
                                            <Button
                                              type="button"
                                              onClick={() => {
                                                setIsAddingFamilyMember(true);
                                                setEditingFamilyMember({});
                                              }}
                                              className="bg-blue-500 hover:bg-blue-600 text-white"
                                              size="sm"
                                            >
                                              <UserPlus className="h-4 w-4 mr-2" />
                                              Add Next of Kin
                                            </Button>
                                          )}
                                        </div>

                                        {/* Inline Add Form */}
                                        {isAddingFamilyMember && (
                                          <Card
                                            className={`border-${colors.borderColor} ${colors.cardBg} border-2 border-blue-500`}
                                          >
                                            <CardContent className="p-6">
                                              <h4
                                                className={`font-semibold mb-4 ${colors.textColor}`}
                                              >
                                                Add Next of Kin
                                              </h4>
                                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                  <Label
                                                    className={colors.textColor}
                                                  >
                                                    First Name{" "}
                                                    <span className="text-red-500">
                                                      *
                                                    </span>
                                                  </Label>
                                                  <Input
                                                    value={
                                                      editingFamilyMember.firstname ||
                                                      ""
                                                    }
                                                    onChange={(e) =>
                                                      setEditingFamilyMember({
                                                        ...editingFamilyMember,
                                                        firstname:
                                                          e.target.value,
                                                      })
                                                    }
                                                    placeholder="First name"
                                                    className={colors.inputBg}
                                                  />
                                                </div>
                                                <div className="space-y-2">
                                                  <Label
                                                    className={colors.textColor}
                                                  >
                                                    Middle Name
                                                  </Label>
                                                  <Input
                                                    value={
                                                      editingFamilyMember.middlename ||
                                                      ""
                                                    }
                                                    onChange={(e) =>
                                                      setEditingFamilyMember({
                                                        ...editingFamilyMember,
                                                        middlename:
                                                          e.target.value,
                                                      })
                                                    }
                                                    placeholder="Middle name"
                                                    className={colors.inputBg}
                                                  />
                                                </div>
                                                <div className="space-y-2">
                                                  <Label
                                                    className={colors.textColor}
                                                  >
                                                    Last Name{" "}
                                                    <span className="text-red-500">
                                                      *
                                                    </span>
                                                  </Label>
                                                  <Input
                                                    value={
                                                      editingFamilyMember.lastname ||
                                                      ""
                                                    }
                                                    onChange={(e) =>
                                                      setEditingFamilyMember({
                                                        ...editingFamilyMember,
                                                        lastname:
                                                          e.target.value,
                                                      })
                                                    }
                                                    placeholder="Last name"
                                                    className={colors.inputBg}
                                                  />
                                                </div>
                                                <div className="space-y-2">
                                                  <Label
                                                    className={colors.textColor}
                                                  >
                                                    Relationship{" "}
                                                    <span className="text-red-500">
                                                      *
                                                    </span>
                                                  </Label>
                                                  <SearchableSelect
                                                    options={
                                                      relationshipOptions
                                                    }
                                                    value={
                                                      editingFamilyMember.relationship ||
                                                      ""
                                                    }
                                                    onValueChange={(value) =>
                                                      setEditingFamilyMember({
                                                        ...editingFamilyMember,
                                                        relationship: value,
                                                      })
                                                    }
                                                    placeholder="Select relationship"
                                                    className={`border-${colors.borderColor} ${colors.inputBg}`}
                                                    onAddNew={() =>
                                                      setShowAddRelationshipDialog(
                                                        true
                                                      )
                                                    }
                                                    addNewLabel="Add new relationship"
                                                  />
                                                </div>
                                                <div className="space-y-2">
                                                  <Label
                                                    className={colors.textColor}
                                                  >
                                                    Mobile Number
                                                  </Label>
                                                  <Input
                                                    value={
                                                      editingFamilyMember.mobileNo ||
                                                      ""
                                                    }
                                                    onChange={(e) =>
                                                      setEditingFamilyMember({
                                                        ...editingFamilyMember,
                                                        mobileNo:
                                                          e.target.value,
                                                      })
                                                    }
                                                    placeholder="Mobile number"
                                                    className={colors.inputBg}
                                                  />
                                                </div>
                                                <div className="space-y-2">
                                                  <Label
                                                    className={colors.textColor}
                                                  >
                                                    Email Address
                                                  </Label>
                                                  <Input
                                                    type="email"
                                                    value={
                                                      editingFamilyMember.emailAddress ||
                                                      ""
                                                    }
                                                    onChange={(e) =>
                                                      setEditingFamilyMember({
                                                        ...editingFamilyMember,
                                                        emailAddress:
                                                          e.target.value,
                                                      })
                                                    }
                                                    placeholder="Email address"
                                                    className={colors.inputBg}
                                                  />
                                                </div>
                                                <div className="space-y-2">
                                                  <Label
                                                    className={colors.textColor}
                                                  >
                                                    Date of Birth
                                                  </Label>
                                                  <Input
                                                    type="date"
                                                    value={
                                                      editingFamilyMember.dateOfBirth
                                                        ? new Date(
                                                            editingFamilyMember.dateOfBirth
                                                          )
                                                            .toISOString()
                                                            .split("T")[0]
                                                        : ""
                                                    }
                                                    onChange={(e) =>
                                                      setEditingFamilyMember({
                                                        ...editingFamilyMember,
                                                        dateOfBirth: e.target
                                                          .value
                                                          ? new Date(
                                                              e.target.value
                                                            )
                                                          : undefined,
                                                      })
                                                    }
                                                    className={colors.inputBg}
                                                  />
                                                </div>
                                                <div className="space-y-2 flex items-center">
                                                  <Checkbox
                                                    id="isDependent"
                                                    checked={
                                                      editingFamilyMember.isDependent ||
                                                      false
                                                    }
                                                    onCheckedChange={(
                                                      checked
                                                    ) =>
                                                      setEditingFamilyMember({
                                                        ...editingFamilyMember,
                                                        isDependent: checked,
                                                      })
                                                    }
                                                  />
                                                  <Label
                                                    htmlFor="isDependent"
                                                    className={`ml-2 ${colors.textColor}`}
                                                  >
                                                    Is Dependent
                                                  </Label>
                                                </div>
                                              </div>
                                              <div className="flex gap-2 justify-end mt-4">
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => {
                                                    setIsAddingFamilyMember(
                                                      false
                                                    );
                                                    setEditingFamilyMember({});
                                                  }}
                                                >
                                                  Cancel
                                                </Button>
                                                <Button
                                                  type="button"
                                                  size="sm"
                                                  onClick={async () => {
                                                    if (
                                                      !editingFamilyMember.firstname ||
                                                      !editingFamilyMember.lastname ||
                                                      !editingFamilyMember.relationship
                                                    ) {
                                                      error({
                                                        title:
                                                          "Validation Error",
                                                        description:
                                                          "Please fill in all required fields",
                                                      });
                                                      return;
                                                    }
                                                    await handleAddFamilyMember(
                                                      editingFamilyMember as FamilyMemberValues
                                                    );
                                                    setIsAddingFamilyMember(
                                                      false
                                                    );
                                                    setEditingFamilyMember({});
                                                  }}
                                                  className="bg-blue-500 hover:bg-blue-600"
                                                >
                                                  Save
                                                </Button>
                                              </div>
                                            </CardContent>
                                          </Card>
                                        )}

                                        {/* Existing Family Members */}
                                        {familyMembers.length > 0 && (
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {familyMembers.map(
                                              (member: any, index: number) => (
                                                <Card
                                                  key={member.id || index}
                                                  className={`border-${colors.borderColor} ${colors.cardBg} shadow-sm hover:shadow-md transition-shadow`}
                                                >
                                                  <CardContent className="p-5">
                                                    {editingFamilyMemberIndex ===
                                                    index ? (
                                                      // Edit Mode
                                                      <div className="space-y-4">
                                                        <h4
                                                          className={`font-semibold mb-4 ${colors.textColor}`}
                                                        >
                                                          Edit Next of Kin
                                                        </h4>
                                                        <div className="grid grid-cols-1 gap-3">
                                                          <div className="space-y-2">
                                                            <Label
                                                              className={
                                                                colors.textColor
                                                              }
                                                            >
                                                              First Name{" "}
                                                              <span className="text-red-500">
                                                                *
                                                              </span>
                                                            </Label>
                                                            <Input
                                                              value={
                                                                editingFamilyMember.firstname ||
                                                                ""
                                                              }
                                                              onChange={(e) =>
                                                                setEditingFamilyMember(
                                                                  {
                                                                    ...editingFamilyMember,
                                                                    firstname:
                                                                      e.target
                                                                        .value,
                                                                  }
                                                                )
                                                              }
                                                              className={
                                                                colors.inputBg
                                                              }
                                                            />
                                                          </div>
                                                          <div className="space-y-2">
                                                            <Label
                                                              className={
                                                                colors.textColor
                                                              }
                                                            >
                                                              Middle Name
                                                            </Label>
                                                            <Input
                                                              value={
                                                                editingFamilyMember.middlename ||
                                                                ""
                                                              }
                                                              onChange={(e) =>
                                                                setEditingFamilyMember(
                                                                  {
                                                                    ...editingFamilyMember,
                                                                    middlename:
                                                                      e.target
                                                                        .value,
                                                                  }
                                                                )
                                                              }
                                                              className={
                                                                colors.inputBg
                                                              }
                                                            />
                                                          </div>
                                                          <div className="space-y-2">
                                                            <Label
                                                              className={
                                                                colors.textColor
                                                              }
                                                            >
                                                              Last Name{" "}
                                                              <span className="text-red-500">
                                                                *
                                                              </span>
                                                            </Label>
                                                            <Input
                                                              value={
                                                                editingFamilyMember.lastname ||
                                                                ""
                                                              }
                                                              onChange={(e) =>
                                                                setEditingFamilyMember(
                                                                  {
                                                                    ...editingFamilyMember,
                                                                    lastname:
                                                                      e.target
                                                                        .value,
                                                                  }
                                                                )
                                                              }
                                                              className={
                                                                colors.inputBg
                                                              }
                                                            />
                                                          </div>
                                                          <div className="space-y-2">
                                                            <Label
                                                              className={
                                                                colors.textColor
                                                              }
                                                            >
                                                              Relationship{" "}
                                                              <span className="text-red-500">
                                                                *
                                                              </span>
                                                            </Label>
                                                            <SearchableSelect
                                                              options={
                                                                relationshipOptions
                                                              }
                                                              value={
                                                                editingFamilyMember.relationship ||
                                                                ""
                                                              }
                                                              onValueChange={(
                                                                value
                                                              ) =>
                                                                setEditingFamilyMember(
                                                                  {
                                                                    ...editingFamilyMember,
                                                                    relationship:
                                                                      value,
                                                                  }
                                                                )
                                                              }
                                                              placeholder="Select relationship"
                                                              className={`border-${colors.borderColor} ${colors.inputBg}`}
                                                              onAddNew={() =>
                                                                setShowAddRelationshipDialog(
                                                                  true
                                                                )
                                                              }
                                                              addNewLabel="Add new relationship"
                                                            />
                                                          </div>
                                                          <div className="space-y-2">
                                                            <Label
                                                              className={
                                                                colors.textColor
                                                              }
                                                            >
                                                              Mobile Number
                                                            </Label>
                                                            <Input
                                                              value={
                                                                editingFamilyMember.mobileNo ||
                                                                ""
                                                              }
                                                              onChange={(e) =>
                                                                setEditingFamilyMember(
                                                                  {
                                                                    ...editingFamilyMember,
                                                                    mobileNo:
                                                                      e.target
                                                                        .value,
                                                                  }
                                                                )
                                                              }
                                                              className={
                                                                colors.inputBg
                                                              }
                                                            />
                                                          </div>
                                                          <div className="space-y-2">
                                                            <Label
                                                              className={
                                                                colors.textColor
                                                              }
                                                            >
                                                              Email Address
                                                            </Label>
                                                            <Input
                                                              type="email"
                                                              value={
                                                                editingFamilyMember.emailAddress ||
                                                                ""
                                                              }
                                                              onChange={(e) =>
                                                                setEditingFamilyMember(
                                                                  {
                                                                    ...editingFamilyMember,
                                                                    emailAddress:
                                                                      e.target
                                                                        .value,
                                                                  }
                                                                )
                                                              }
                                                              className={
                                                                colors.inputBg
                                                              }
                                                            />
                                                          </div>
                                                          <div className="space-y-2">
                                                            <Label
                                                              className={
                                                                colors.textColor
                                                              }
                                                            >
                                                              Date of Birth
                                                            </Label>
                                                            <Input
                                                              type="date"
                                                              value={
                                                                editingFamilyMember.dateOfBirth
                                                                  ? new Date(
                                                                      editingFamilyMember.dateOfBirth
                                                                    )
                                                                      .toISOString()
                                                                      .split(
                                                                        "T"
                                                                      )[0]
                                                                  : ""
                                                              }
                                                              onChange={(e) =>
                                                                setEditingFamilyMember(
                                                                  {
                                                                    ...editingFamilyMember,
                                                                    dateOfBirth:
                                                                      e.target
                                                                        .value
                                                                        ? new Date(
                                                                            e.target.value
                                                                          )
                                                                        : undefined,
                                                                  }
                                                                )
                                                              }
                                                              className={
                                                                colors.inputBg
                                                              }
                                                            />
                                                          </div>
                                                          <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                              id={`isDependent-${index}`}
                                                              checked={
                                                                editingFamilyMember.isDependent ||
                                                                false
                                                              }
                                                              onCheckedChange={(
                                                                checked
                                                              ) =>
                                                                setEditingFamilyMember(
                                                                  {
                                                                    ...editingFamilyMember,
                                                                    isDependent:
                                                                      checked,
                                                                  }
                                                                )
                                                              }
                                                            />
                                                            <Label
                                                              htmlFor={`isDependent-${index}`}
                                                              className={
                                                                colors.textColor
                                                              }
                                                            >
                                                              Is Dependent
                                                            </Label>
                                                          </div>
                                                        </div>
                                                        <div className="flex gap-2 justify-end mt-4">
                                                          <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => {
                                                              setEditingFamilyMemberIndex(
                                                                null
                                                              );
                                                              setEditingFamilyMember(
                                                                {}
                                                              );
                                                            }}
                                                          >
                                                            Cancel
                                                          </Button>
                                                          <Button
                                                            type="button"
                                                            size="sm"
                                                            onClick={async () => {
                                                              if (
                                                                !editingFamilyMember.firstname ||
                                                                !editingFamilyMember.lastname ||
                                                                !editingFamilyMember.relationship
                                                              ) {
                                                                error({
                                                                  title:
                                                                    "Validation Error",
                                                                  description:
                                                                    "Please fill in all required fields",
                                                                });
                                                                return;
                                                              }
                                                              // Update existing member
                                                              await handleAddFamilyMember(
                                                                editingFamilyMember as FamilyMemberValues
                                                              );
                                                              setEditingFamilyMemberIndex(
                                                                null
                                                              );
                                                              setEditingFamilyMember(
                                                                {}
                                                              );
                                                            }}
                                                            className="bg-blue-500 hover:bg-blue-600"
                                                          >
                                                            Save
                                                          </Button>
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      // View Mode
                                                      <div className="space-y-3">
                                                        <div className="flex items-start justify-between">
                                                          <div className="flex-1">
                                                            <h4
                                                              className={`font-semibold text-base ${colors.textColor} mb-1`}
                                                            >
                                                              {member.firstname}{" "}
                                                              {member.middlename ||
                                                                ""}{" "}
                                                              {member.lastname}
                                                            </h4>
                                                            {member.relationship && (
                                                              <Badge
                                                                variant="outline"
                                                                className="mt-1"
                                                              >
                                                                {
                                                                  member.relationship
                                                                }
                                                              </Badge>
                                                            )}
                                                          </div>
                                                          <div className="flex gap-2">
                                                            {member.isDependent && (
                                                              <Badge className="bg-blue-500">
                                                                Dependent
                                                              </Badge>
                                                            )}
                                                            <Button
                                                              type="button"
                                                              variant="ghost"
                                                              size="sm"
                                                              onClick={() => {
                                                                setEditingFamilyMemberIndex(
                                                                  index
                                                                );
                                                                setEditingFamilyMember(
                                                                  {
                                                                    ...member,
                                                                    dateOfBirth:
                                                                      member.dateOfBirth
                                                                        ? new Date(
                                                                            member.dateOfBirth
                                                                          )
                                                                        : undefined,
                                                                  }
                                                                );
                                                              }}
                                                            >
                                                              <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                              type="button"
                                                              variant="ghost"
                                                              size="sm"
                                                              onClick={() =>
                                                                handleRemoveFamilyMember(
                                                                  member.id
                                                                )
                                                              }
                                                              className="text-red-500 hover:text-red-700"
                                                            >
                                                              <X className="h-4 w-4" />
                                                            </Button>
                                                          </div>
                                                        </div>
                                                        <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                                                          {member.mobileNo && (
                                                            <div className="flex items-center gap-2">
                                                              <p
                                                                className={`text-xs font-medium ${colors.textColorMuted} w-20`}
                                                              >
                                                                Mobile:
                                                              </p>
                                                              <p
                                                                className={`text-sm ${colors.textColor}`}
                                                              >
                                                                {
                                                                  member.mobileNo
                                                                }
                                                              </p>
                                                            </div>
                                                          )}
                                                          {member.emailAddress && (
                                                            <div className="flex items-center gap-2">
                                                              <p
                                                                className={`text-xs font-medium ${colors.textColorMuted} w-20`}
                                                              >
                                                                Email:
                                                              </p>
                                                              <p
                                                                className={`text-sm ${colors.textColor}`}
                                                              >
                                                                {
                                                                  member.emailAddress
                                                                }
                                                              </p>
                                                            </div>
                                                          )}
                                                          {member.dateOfBirth && (
                                                            <div className="flex items-center gap-2">
                                                              <p
                                                                className={`text-xs font-medium ${colors.textColorMuted} w-20`}
                                                              >
                                                                DOB:
                                                              </p>
                                                              <p
                                                                className={`text-sm ${colors.textColor}`}
                                                              >
                                                                {new Date(
                                                                  member.dateOfBirth
                                                                ).toLocaleDateString()}
                                                              </p>
                                                            </div>
                                                          )}
                                                        </div>
                                                      </div>
                                                    )}
                                                  </CardContent>
                                                </Card>
                                              )
                                            )}
                                          </div>
                                        )}

                                        {familyMembers.length === 0 &&
                                          !isAddingFamilyMember && (
                                            <Card
                                              className={`border-${colors.borderColor} ${colors.cardBg} border-dashed`}
                                            >
                                              <CardContent className="p-6 text-center">
                                                <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                                <p
                                                  className={`text-sm ${colors.textColorMuted} mb-4`}
                                                >
                                                  No family members or next of
                                                  kin added yet
                                                </p>
                                              </CardContent>
                                            </Card>
                                          )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                </>
                              )}
                            </CardContent>
                            <CardFooter className="flex justify-between border-t border-gray-200 dark:border-gray-800 pt-4">
                              <Button
                                type="button"
                                variant="outline"
                                className={`border-${colors.borderColor} hover:bg-${colors.hoverBgColor}`}
                                onClick={() => setActiveClientTab("account")}
                              >
                                Previous
                              </Button>
                            </CardFooter>
                          </Card>
                        </TabsContent>
                      )}
                    </Tabs>
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
                <CardFooter className="flex justify-between pt-4">
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

        {/* Add Document Type Dialog */}
        {showAddDocumentTypeDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card
              className={`w-full max-w-md border-${colors.borderColor} ${colors.cardBg}`}
            >
              <CardHeader>
                <CardTitle className={colors.textColor}>
                  Add New Document Type
                </CardTitle>
                <CardDescription className={colors.textColorMuted}>
                  Enter the details of the new document type.
                </CardDescription>
              </CardHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  documentTypeForm.handleSubmit(handleAddDocumentType)(e);
                }}
              >
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="docTypeName" className={colors.textColor}>
                        Document Type Name{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="docTypeName"
                        placeholder="Enter document type name"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...documentTypeForm.register("name")}
                      />
                      {documentTypeForm.formState.errors.name && (
                        <p className="text-sm text-red-500">
                          {documentTypeForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label
                        htmlFor="docTypeDescription"
                        className={colors.textColor}
                      >
                        Description
                      </Label>
                      <Input
                        id="docTypeDescription"
                        placeholder="Enter description"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...documentTypeForm.register("description")}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddDocumentTypeDialog(false);
                      documentTypeForm.reset();
                    }}
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
                      "Add Document Type"
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
                <CardFooter className="flex justify-between pt-4">
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
                <CardFooter className="flex justify-between pt-4">
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

        {/* Add Relationship Dialog */}
        {showAddRelationshipDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card
              className={`w-full max-w-md border-${colors.borderColor} ${colors.cardBg}`}
            >
              <CardHeader>
                <CardTitle className={colors.textColor}>
                  Add New Relationship
                </CardTitle>
                <CardDescription className={colors.textColorMuted}>
                  Enter the details of the new relationship type.
                </CardDescription>
              </CardHeader>
              <form
                onSubmit={relationshipForm.handleSubmit(handleAddRelationship)}
              >
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="name" className={colors.textColor}>
                        Relationship Name{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        placeholder="Enter relationship name"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...relationshipForm.register("name")}
                      />
                      {relationshipForm.formState.errors.name && (
                        <p className="text-sm text-red-500">
                          {relationshipForm.formState.errors.name.message}
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
                        {...relationshipForm.register("description")}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddRelationshipDialog(false)}
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
                      "Add Relationship"
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

        {/* Add Address Type Dialog */}
        {showAddAddressTypeDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card
              className={`w-full max-w-md border-${colors.borderColor} ${colors.cardBg}`}
            >
              <CardHeader>
                <CardTitle className={colors.textColor}>
                  Add New Address Type
                </CardTitle>
                <CardDescription className={colors.textColorMuted}>
                  Enter the details of the new address type.
                </CardDescription>
              </CardHeader>
              <form
                onSubmit={addressTypeForm.handleSubmit(handleAddAddressType)}
              >
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="name" className={colors.textColor}>
                        Address Type Name{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        placeholder="Enter address type name"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...addressTypeForm.register("name")}
                      />
                      {addressTypeForm.formState.errors.name && (
                        <p className="text-sm text-red-500">
                          {addressTypeForm.formState.errors.name.message}
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
                        {...addressTypeForm.register("description")}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddAddressTypeDialog(false)}
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
                      "Add Address Type"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        )}

        {/* Add Country Dialog */}
        {showAddCountryDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card
              className={`w-full max-w-md border-${colors.borderColor} ${colors.cardBg}`}
            >
              <CardHeader>
                <CardTitle className={colors.textColor}>
                  Add New Country
                </CardTitle>
                <CardDescription className={colors.textColorMuted}>
                  Enter the details of the new country.
                </CardDescription>
              </CardHeader>
              <form onSubmit={countryForm.handleSubmit(handleAddCountry)}>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="name" className={colors.textColor}>
                        Country Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        placeholder="Enter country name"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...countryForm.register("name")}
                      />
                      {countryForm.formState.errors.name && (
                        <p className="text-sm text-red-500">
                          {countryForm.formState.errors.name.message}
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
                        {...countryForm.register("description")}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddCountryDialog(false)}
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
                      "Add Country"
                    )}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        )}

        {/* Add State/Province Dialog */}
        {showAddStateProvinceDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card
              className={`w-full max-w-md border-${colors.borderColor} ${colors.cardBg}`}
            >
              <CardHeader>
                <CardTitle className={colors.textColor}>
                  Add New State/Province
                </CardTitle>
                <CardDescription className={colors.textColorMuted}>
                  Enter the details of the new state/province.
                </CardDescription>
              </CardHeader>
              <form
                onSubmit={stateProvinceForm.handleSubmit(
                  handleAddStateProvince
                )}
              >
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="name" className={colors.textColor}>
                        State/Province Name{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="name"
                        placeholder="Enter state/province name"
                        className={`h-10 w-full border-${colors.borderColor} ${colors.inputBg}`}
                        {...stateProvinceForm.register("name")}
                      />
                      {stateProvinceForm.formState.errors.name && (
                        <p className="text-sm text-red-500">
                          {stateProvinceForm.formState.errors.name.message}
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
                        {...stateProvinceForm.register("description")}
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddStateProvinceDialog(false)}
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
                      "Add State/Province"
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

        {/* Delete Identifier Confirmation Dialog */}
        <Dialog
          open={showDeleteConfirmDialog}
          onOpenChange={setShowDeleteConfirmDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" />
                Delete Identifier
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this identifier? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirmDialog(false);
                  setIdentifierToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDeleteIdentifier}
                disabled={deletingIdentifierId !== null}
              >
                {deletingIdentifierId ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
