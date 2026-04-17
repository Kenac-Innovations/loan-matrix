"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  CreditCard,
  Briefcase,
  AlertCircle,
  Loader2,
  Clock,
  CheckCircle,
  ArrowRight,
  ExternalLink,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  User,
  MapPin,
  Hash,
  Download,
  MoreVertical,
  ArrowRightLeft,
  Coins,
} from "lucide-react";
import { format } from "date-fns";
import { useCurrency } from "@/contexts/currency-context";
import { CreditBalanceRefundModal } from "./credit-balance-refund-modal";
import { TransferFundsModal } from "./transfer-funds-modal";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { PendingApprovalLoanTermsEditor } from "./pending-approval-loan-terms-editor";

interface ComprehensiveLeadDetailsProps {
  leadId: string;
  canEditPendingLoanApplication?: boolean;
}

export function ComprehensiveLeadDetails({
  leadId,
  canEditPendingLoanApplication = false,
}: ComprehensiveLeadDetailsProps) {
  const { currencyCode, currencySymbol } = useCurrency();
  const { isEnabled, tenantSlug } = useFeatureFlags();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientImage, setClientImage] = useState<string | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [loanDocuments, setLoanDocuments] = useState<any[]>([]);
  const [loadingLoanDocs, setLoadingLoanDocs] = useState(false);
  const [showCreditBalanceRefundModal, setShowCreditBalanceRefundModal] = useState(false);
  const [showTransferFundsModal, setShowTransferFundsModal] = useState(false);

  // Memoized fetch function that can be called to refresh data
  const fetchData = useCallback(
    async (showLoadingState = true) => {
      try {
        if (showLoadingState) {
          setLoading(true);
        }
        console.log("Fetching complete details for lead:", leadId);

        const response = await fetch(`/api/leads/${leadId}/complete-details`);
        console.log("Response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Error response:", errorData);
          throw new Error(
            errorData.error ||
              `Failed to fetch lead details (${response.status})`
          );
        }

        const result = await response.json();
        console.log("Complete details received:", result);
        setData(result);
      } catch (err) {
        console.error("Error fetching lead details:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    },
    [leadId]
  );

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for loan action complete events to refresh data
  useEffect(() => {
    const handleLoanActionComplete = (event: CustomEvent) => {
      // Only refresh if this is the same lead
      if (event.detail?.leadId === leadId) {
        console.log("Loan action completed, refreshing data...");
        fetchData(false); // Don't show loading state for refresh
      }
    };

    window.addEventListener(
      "loan-action-complete",
      handleLoanActionComplete as EventListener
    );
    return () => {
      window.removeEventListener(
        "loan-action-complete",
        handleLoanActionComplete as EventListener
      );
    };
  }, [leadId, fetchData]);

  // Fetch client image when fineractClientId is available
  useEffect(() => {
    const fetchClientImage = async () => {
      const clientId = data?.lead?.fineractClientId || data?.fineractClient?.id;

      if (!clientId) {
        setClientImage(null);
        return;
      }

      try {
        const imageResponse = await fetch(
          `/api/fineract/clients/${clientId}/images?maxHeight=200`
        );

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();

          // Handle null response (no image found)
          if (imageData === null || imageData === undefined) {
            setClientImage(null);
            return;
          }

          // Helper function to check if a string looks like base64
          const isBase64Like = (str: string): boolean => {
            const base64Regex = /^[A-Za-z0-9+/=]+$/;
            return base64Regex.test(str) && str.length > 10;
          };

          // Convert to data URI if needed
          let imageUri: string | null = null;

          if (imageData && typeof imageData === "string") {
            // If it's already a data URI
            if (imageData.startsWith("data:image/")) {
              imageUri = imageData;
            } else if (isBase64Like(imageData)) {
              // If it's base64, add data URI prefix
              imageUri = `data:image/jpeg;base64,${imageData}`;
            }
          } else if (imageData?.imageData) {
            // If it has imageData property
            if (typeof imageData.imageData === "string") {
              if (imageData.imageData.startsWith("data:image/")) {
                imageUri = imageData.imageData;
              } else if (isBase64Like(imageData.imageData)) {
                imageUri = `data:image/jpeg;base64,${imageData.imageData}`;
              }
            }
          } else if (imageData?.base64EncodedImage) {
            // If it has base64EncodedImage property
            if (typeof imageData.base64EncodedImage === "string") {
              if (imageData.base64EncodedImage.startsWith("data:image/")) {
                imageUri = imageData.base64EncodedImage;
              } else if (isBase64Like(imageData.base64EncodedImage)) {
                imageUri = `data:image/jpeg;base64,${imageData.base64EncodedImage}`;
              }
            }
          }

          setClientImage(imageUri);
        } else {
          setClientImage(null);
        }
      } catch (error) {
        console.error("Error fetching client image:", error);
        setClientImage(null);
      }
    };

    if (data) {
      fetchClientImage();
    }
  }, [data]);

  // Fetch loan documents when fineractLoanId is available
  useEffect(() => {
    console.log("=== LOAN DOCUMENTS useEffect triggered ===");
    console.log("Data:", data);
    console.log("lead.fineractLoanId:", data?.lead?.fineractLoanId);
    console.log("fineractLoan?.id:", data?.fineractLoan?.id);

    const fetchLoanDocuments = async () => {
      // Try multiple sources for loan ID
      const loanId = data?.lead?.fineractLoanId || data?.fineractLoan?.id;

      if (!loanId) {
        console.log("No loan ID found, clearing documents");
        setLoanDocuments([]);
        return;
      }

      try {
        setLoadingLoanDocs(true);
        console.log("Fetching loan documents for loan ID:", loanId);
        const response = await fetch(`/api/fineract/loans/${loanId}/documents`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.warn("Failed to fetch loan documents:", {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
          setLoanDocuments([]);
          return;
        }

        const responseData = await response.json();
        console.log("=== LOAN DOCUMENTS RESPONSE ===");
        console.log("Full response:", JSON.stringify(responseData, null, 2));
        console.log("Response type:", typeof responseData);
        console.log("Is array?", Array.isArray(responseData));
        console.log(
          "Response keys:",
          responseData && typeof responseData === "object"
            ? Object.keys(responseData)
            : "N/A"
        );

        // Handle different response structures from Fineract
        let docs: any[] = [];

        if (Array.isArray(responseData)) {
          console.log("Response is direct array");
          docs = responseData;
        } else if (responseData && typeof responseData === "object") {
          // Try pageItems
          if (responseData.pageItems && Array.isArray(responseData.pageItems)) {
            console.log("Found documents in pageItems");
            docs = responseData.pageItems;
          }
          // Try content
          else if (
            responseData.content &&
            Array.isArray(responseData.content)
          ) {
            console.log("Found documents in content");
            docs = responseData.content;
          }
          // Try data
          else if (responseData.data && Array.isArray(responseData.data)) {
            console.log("Found documents in data");
            docs = responseData.data;
          }
          // Try documents
          else if (
            responseData.documents &&
            Array.isArray(responseData.documents)
          ) {
            console.log("Found documents in documents");
            docs = responseData.documents;
          }
          // Try items
          else if (responseData.items && Array.isArray(responseData.items)) {
            console.log("Found documents in items");
            docs = responseData.items;
          }
          // Try to find any array property
          else {
            console.log("Searching for array properties...");
            for (const key in responseData) {
              if (Array.isArray(responseData[key])) {
                console.log(
                  `Found array in property: ${key} with ${responseData[key].length} items`
                );
                docs = responseData[key];
                break;
              }
            }
          }
        }

        console.log(`=== PARSED ${docs.length} DOCUMENTS ===`);
        console.log("Documents:", docs);
        if (docs.length > 0) {
          console.log("First document:", docs[0]);
          console.log("Document keys:", Object.keys(docs[0]));
        }

        setLoanDocuments(docs);
      } catch (err) {
        console.error("Error fetching loan documents:", err);
        setLoanDocuments([]);
      } finally {
        setLoadingLoanDocs(false);
      }
    };

    // Check if we have a loan ID from either source
    const loanId = data?.lead?.fineractLoanId || data?.fineractLoan?.id;
    if (loanId) {
      fetchLoanDocuments();
    } else {
      console.log("No loan ID available, not fetching documents");
      setLoanDocuments([]);
    }
  }, [data]);

  const handleDownloadLoanDocument = async (
    documentId: string | number,
    fileName: string
  ) => {
    const loanId = data?.lead?.fineractLoanId || data?.fineractLoan?.id;
    if (!loanId) {
      console.error("No loan ID available for download");
      alert("Error: Loan ID not found. Cannot download document.");
      return;
    }

    console.log("Downloading document:", { loanId, documentId, fileName });

    try {
      const response = await fetch(
        `/api/fineract/loans/${loanId}/documents/${documentId}/attachment`
      );

      if (!response.ok) {
        let errorMessage = "Failed to download document";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        console.error("Download failed:", errorMessage);
        alert(`Failed to download document: ${errorMessage}`);
        return;
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        console.error("Downloaded file is empty");
        alert("Error: Downloaded file is empty");
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || `document-${documentId}`;
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      console.log("Document downloaded successfully:", fileName);
    } catch (err) {
      console.error("Error downloading loan document:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      alert(`Error downloading document: ${errorMessage}`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Error Loading Lead Details
              </h3>
              <p className="text-muted-foreground mb-4">
                {error || "Failed to load lead data"}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Check the browser console (F12) for more details
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Retry
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { lead, loanInfo, fineractClient, fineractLoan, cdeResult, invoiceDiscounting } = data;
  const invoiceDiscountingEnabled = isEnabled("hasInvoiceDiscounting");
  const isInvoiceDiscountingLead = lead?.facilityType === "INVOICE_DISCOUNTING";
  const showInvoiceDiscountingDetails =
    invoiceDiscountingEnabled && isInvoiceDiscountingLead;

  // Get loan ID from multiple sources
  const loanId = fineractLoan?.id || lead?.fineractLoanId || null;

  // Debug logging
  console.log("=== COMPREHENSIVE LEAD DETAILS DEBUG ===");
  console.log("Lead fineractLoanId:", lead?.fineractLoanId);
  console.log("FineractLoan ID:", fineractLoan?.id);
  console.log("Resolved loanId:", loanId);
  console.log("Fineract loan data:", fineractLoan ? "Present" : "Missing");
  console.log(
    "Fineract loan keys:",
    fineractLoan ? Object.keys(fineractLoan) : "N/A"
  );
  console.log("Loan documents state:", {
    count: loanDocuments.length,
    loading: loadingLoanDocs,
    documents: loanDocuments,
  });

  const fullName =
    [lead.firstname, lead.middlename, lead.lastname]
      .filter(Boolean)
      .join(" ") || `Lead #${leadId}`;

  const phoneNumber = lead.mobileNo
    ? `${lead.countryCode} ${lead.mobileNo}`
    : "Not provided";

  const originalRequestedAmount =
    (typeof lead.stateMetadata?.originalRequestedAmount === "number" &&
    lead.stateMetadata.originalRequestedAmount > 0
      ? lead.stateMetadata.originalRequestedAmount
      : null) ??
    (typeof lead.stateMetadata?.originalPendingApprovalLoanTerms?.principal === "number" &&
    lead.stateMetadata.originalPendingApprovalLoanTerms.principal > 0
      ? lead.stateMetadata.originalPendingApprovalLoanTerms.principal
      : null);

  const principalAmountFallback =
    fineractLoan?.principal ||
    fineractLoan?.approvedPrincipal ||
    fineractLoan?.proposedPrincipal ||
    loanInfo?.loanTerms?.principal ||
    0;

  const requestedAmount =
    originalRequestedAmount ??
    (typeof lead.requestedAmount === "number" && lead.requestedAmount > 0
        ? lead.requestedAmount
        : principalAmountFallback);
  const tenantSettings =
    data?.tenant?.settings && typeof data.tenant.settings === "object"
      ? (data.tenant.settings as Record<string, any>)
      : null;
  const resolvedTenantSlug = (data?.tenant?.slug || tenantSlug || "")
    .trim()
    .toLowerCase();
  const interestRateDisplayMode =
    tenantSettings?.loanTermsInterestRateDisplay ||
    (resolvedTenantSlug === "omama" ? "monthly" : "annual");
  const annualInterestRate =
    typeof fineractLoan?.annualInterestRate === "number"
      ? fineractLoan.annualInterestRate
      : typeof fineractLoan?.interestRatePerPeriod === "number"
        ? fineractLoan.interestRatePerPeriod * 12
        : 0;
  const monthlyInterestRate =
    typeof fineractLoan?.interestRatePerPeriod === "number"
      ? fineractLoan.interestRatePerPeriod
      : annualInterestRate / 12;
  const interestRateLabel =
    interestRateDisplayMode === "monthly"
      ? "Monthly Interest Rate"
      : "Annual Interest Rate";
  const displayedInterestRate =
    interestRateDisplayMode === "monthly"
      ? monthlyInterestRate
      : annualInterestRate;

  // Get Fineract loan status
  const fineractLoanStatus = fineractLoan?.status?.value || null;
  const fineractLoanId = fineractLoan?.id || lead?.fineractLoanId || null;
  const isLoanApprovedOrBeyond = Boolean(
    fineractLoan?.status?.approved ||
      fineractLoan?.status?.active ||
      fineractLoan?.status?.closed
  );
  const approvalAmountLabel = isLoanApprovedOrBeyond
    ? "Approved Amount"
    : "Amount To Be Approved";
  const approvalAmount =
    isLoanApprovedOrBeyond
      ? fineractLoan?.approvedPrincipal
        || fineractLoan?.principal
        || requestedAmount
      : fineractLoan?.principal
        || fineractLoan?.proposedPrincipal
        || fineractLoan?.approvedPrincipal
        || loanInfo?.loanTerms?.principal
        || requestedAmount;

  // Get status badge color
  const getStatusBadgeColor = (status: string | null) => {
    if (!status) return "bg-gray-500";
    const statusLower = status.toLowerCase();
    if (statusLower.includes("active")) return "bg-green-500";
    if (statusLower.includes("approved")) return "bg-blue-500";
    if (statusLower.includes("submitted") || statusLower.includes("pending"))
      return "bg-yellow-500";
    if (statusLower.includes("closed")) return "bg-gray-500";
    return "bg-gray-500";
  };

  return (
    <div className="space-y-6">
      {/* Title Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap"></div>
      </div>

      {/* Header Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Client Summary */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar 
                className={`h-16 w-16 ${clientImage ? "cursor-pointer ring-2 ring-transparent hover:ring-primary/50 transition-all" : ""}`}
                onClick={() => clientImage && setImageDialogOpen(true)}
              >
                <AvatarImage
                  src={clientImage || "/placeholder.svg"}
                  alt={fullName}
                />
                <AvatarFallback className="text-xl">
                  {fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-xl">{fullName}</CardTitle>
              </div>
            </div>

            {/* Image Preview Dialog */}
            <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{fullName}</DialogTitle>
                </DialogHeader>
                <div className="flex items-center justify-center p-4">
                  {clientImage && (
                    <img
                      src={clientImage}
                      alt={fullName}
                      className="max-h-[70vh] max-w-full rounded-lg object-contain"
                    />
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{phoneNumber}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">
                  {lead.emailAddress || "Not provided"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {lead.dateOfBirth
                    ? format(new Date(lead.dateOfBirth), "PPP")
                    : "Not provided"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span>{lead.officeName || "Not assigned"}</span>
              </div>
              {fineractClient?.accountNo && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Account No:</span>
                  <span className="font-medium">
                    {fineractClient.accountNo}
                  </span>
                </div>
              )}
              {fineractClient?.externalId && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">External ID:</span>
                  <span className="font-medium">
                    {fineractClient.externalId}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader className="pt-6">
            <CardTitle className="text-sm">Key Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Credit Score</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">
                  {lead.creditScore || "N/A"}
                </p>
                {lead.creditScore && lead.creditScore >= 700 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : lead.creditScore && lead.creditScore >= 600 ? (
                  <Minus className="h-5 w-5 text-yellow-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Requested Amount</p>
              <p className="text-2xl font-bold">
                {currencyCode} {requestedAmount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{approvalAmountLabel}</p>
              <p className="text-2xl font-bold">
                {currencyCode} {approvalAmount.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monthly Income</p>
              <p className="text-2xl font-bold">
                {currencyCode} {(lead.monthlyIncome || 0).toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Information Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="loan">Loan Details</TabsTrigger>
          <TabsTrigger value="financial">CDE</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          {fineractLoan && (
            <TabsTrigger value="repayment">Repayment</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 text-sm">
                  <div>
                    <p className="text-muted-foreground">Gender</p>
                    <p className="font-medium">{lead.gender || fineractClient?.gender?.name || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date of Birth</p>
                    <p className="font-medium">
                      {lead.dateOfBirth
                        ? format(new Date(lead.dateOfBirth), "PP")
                        : fineractClient?.dateOfBirth
                        ? format(
                            new Date(
                              Array.isArray(fineractClient.dateOfBirth)
                                ? `${fineractClient.dateOfBirth[0]}-${String(fineractClient.dateOfBirth[1]).padStart(2, "0")}-${String(fineractClient.dateOfBirth[2]).padStart(2, "0")}`
                                : fineractClient.dateOfBirth
                            ),
                            "PP"
                          )
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">External ID</p>
                    <p className="font-medium">{lead.externalId || fineractClient?.externalId || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Classification</p>
                    <p className="font-medium">
                      {lead.clientClassificationName || fineractClient?.clientClassification?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Client Type</p>
                    <p className="font-medium">
                      {lead.clientTypeName || fineractClient?.clientType?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Office</p>
                    <p className="font-medium">{lead.officeName || fineractClient?.officeName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{lead.mobileNo || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{lead.emailAddress || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Originated By</p>
                    <p className="font-medium">
                      {lead.createdByUserName || lead.userId || "N/A"}
                    </p>
                  </div>
                  {lead.assignedToUserName && lead.createdByUserName && lead.assignedToUserName !== lead.createdByUserName && (
                    <div>
                      <p className="text-muted-foreground">Assigned To</p>
                      <p className="font-medium">{lead.assignedToUserName}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="loan" className="mt-4">
          {showInvoiceDiscountingDetails && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Invoice Discounting Details</CardTitle>
                <CardDescription>
                  Facility setup and debtor invoice summary captured during lead creation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Facility Type</p>
                    <p className="font-semibold">Invoice Discounting</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Debtor</p>
                    <p className="font-semibold">{invoiceDiscounting?.debtorName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Advance Rate</p>
                    <p className="font-semibold">
                      {invoiceDiscounting?.advanceRate != null
                        ? `${invoiceDiscounting.advanceRate}%`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Debtor Terms</p>
                    <p className="font-semibold">
                      {invoiceDiscounting?.debtorTermsDays != null
                        ? `${invoiceDiscounting.debtorTermsDays} days`
                        : "N/A"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 rounded-md border bg-muted/30 p-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Presented</p>
                    <p className="text-base font-semibold">
                      {currencyCode}{" "}
                      {(invoiceDiscounting?.totalPresentedAmount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Financed</p>
                    <p className="text-base font-semibold">
                      {currencyCode}{" "}
                      {(invoiceDiscounting?.totalFinancedAmount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Income</p>
                    <p className="text-base font-semibold">
                      {currencyCode}{" "}
                      {(invoiceDiscounting?.totalReserveAmount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                {Array.isArray(invoiceDiscounting?.invoices) &&
                invoiceDiscounting.invoices.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Invoices</p>
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Invoice #</th>
                            <th className="px-3 py-2 text-left font-medium">Invoice Date</th>
                            <th className="px-3 py-2 text-left font-medium">Due Date</th>
                            <th className="px-3 py-2 text-left font-medium">File</th>
                            <th className="px-3 py-2 text-left font-medium">Gross</th>
                            <th className="px-3 py-2 text-left font-medium">Financed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoiceDiscounting.invoices.map((invoice: any) => (
                            <tr key={invoice.id} className="border-t">
                              <td className="px-3 py-2">{invoice.invoiceNumber}</td>
                              <td className="px-3 py-2">
                                {invoice.invoiceDate
                                  ? format(new Date(invoice.invoiceDate), "PP")
                                  : "N/A"}
                              </td>
                              <td className="px-3 py-2">
                                {invoice.dueDate
                                  ? format(new Date(invoice.dueDate), "PP")
                                  : "N/A"}
                              </td>
                              <td className="px-3 py-2">
                                {invoice.fineractDocumentId && lead?.fineractClientId ? (
                                  <a
                                    href={`/api/fineract/clients/${lead.fineractClientId}/documents/${invoice.fineractDocumentId}/attachment`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    View file
                                  </a>
                                ) : (
                                  "N/A"
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {invoice.currencyCode || currencyCode}{" "}
                                {(invoice.grossAmount || 0).toLocaleString()}
                              </td>
                              <td className="px-3 py-2">
                                {invoice.currencyCode || currencyCode}{" "}
                                {(invoice.financedAmount || 0).toLocaleString()}
                              </td>
                              {/* Invoice status is intentionally hidden in UI for now.
                                  Backend defaults invoice rows to APPROVED. */}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No invoice rows were captured yet.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {lead.fineractLoanId && !fineractLoan ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      Loan ID Found, But Data Not Loaded
                    </h3>
                    <p className="text-muted-foreground mb-2">
                      Loan ID: <strong>{lead.fineractLoanId}</strong>
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      The loan exists in Fineract, but we couldn't fetch the
                      details. Check the server console for more information.
                    </p>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : fineractLoan ? (
            <div className="space-y-6">
              {/* Loan Basic Information */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Loan Information</CardTitle>
                  {(() => {
                    const isOverpaid =
                      fineractLoan.status?.overpaid === true ||
                      (fineractLoan.summary &&
                        fineractLoan.summary.totalRepayment > 0 &&
                        fineractLoan.summary.totalOutstanding === 0 &&
                        fineractLoan.summary.totalRepayment >
                          fineractLoan.summary.totalExpectedRepayment);
                    if (!isOverpaid) return null;
                    return (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setShowTransferFundsModal(true)}
                          >
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            Transfer Funds
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setShowCreditBalanceRefundModal(true)
                            }
                          >
                            <Coins className="mr-2 h-4 w-4" />
                            Credit Balance Refund
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })()}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Account Number
                      </p>
                      <p className="text-lg font-semibold break-words">
                        {fineractLoan.accountNo || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Status
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          className={`${
                            fineractLoan.status?.value === "Active"
                              ? "bg-green-500"
                              : fineractLoan.status?.value === "Approved"
                              ? "bg-blue-500"
                              : fineractLoan.status?.value ===
                                "Submitted and pending approval"
                              ? "bg-yellow-500"
                              : "bg-gray-500"
                          } text-white border-0 whitespace-normal break-words`}
                        >
                          {fineractLoan.status?.value || "Unknown"}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Loan Product
                      </p>
                      <p className="text-lg font-semibold break-words">
                        {fineractLoan.loanProductName ||
                          fineractLoan.productName ||
                          "N/A"}
                      </p>
                    </div>
                    {fineractLoan.externalId && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">
                          External ID
                        </p>
                        <p className="text-lg font-semibold break-words font-mono">
                          {fineractLoan.externalId}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Loan Terms */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle>Loan Terms</CardTitle>
                      {fineractLoan?.id ? (
                        <PendingApprovalLoanTermsEditor
                          leadId={leadId}
                          canEdit={canEditPendingLoanApplication}
                          loan={{
                            id: fineractLoan.id,
                            principal: fineractLoan.principal,
                            termFrequency: fineractLoan.termFrequency,
                            termPeriodLabel:
                              fineractLoan.termPeriodFrequencyType?.value || null,
                            numberOfRepayments: fineractLoan.numberOfRepayments,
                            interestRatePerPeriod:
                              fineractLoan.interestRatePerPeriod,
                            interestRateFrequencyLabel:
                              fineractLoan.interestRateFrequencyType?.value || null,
                          }}
                          onSaved={() => {
                            fetchData(false);
                          }}
                        />
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Principal</p>
                      <p className="text-2xl font-bold text-green-600">
                        {fineractLoan.currency?.displaySymbol || currencySymbol}
                        {(fineractLoan.principal || 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {interestRateLabel}
                      </p>
                      <p className="text-xl font-semibold">
                        {(displayedInterestRate || 0).toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Number of Repayments
                      </p>
                      <p className="text-lg font-semibold">
                        {fineractLoan.numberOfRepayments || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Repayment Frequency
                      </p>
                      <p className="text-lg font-semibold">
                        {fineractLoan.repaymentFrequencyType?.value ||
                        fineractLoan.repaymentEvery
                          ? `Every ${fineractLoan.repaymentEvery} ${
                              fineractLoan.repaymentFrequencyType?.value || ""
                            }`
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Amortization Type
                      </p>
                      <p className="text-lg font-semibold">
                        {fineractLoan.amortizationType?.value || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Interest Type
                      </p>
                      <p className="text-lg font-semibold">
                        {fineractLoan.interestType?.value || "N/A"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Loan Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Loan Summary</CardTitle>
                    <CardDescription>
                      Comprehensive financial summary
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {fineractLoan.summary ? (
                      <>
                        {/* Principal Section */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-foreground border-b pb-2">
                            Principal
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Disbursed
                              </p>
                              <p className="text-lg font-semibold text-green-600">
                                {fineractLoan.currency?.displaySymbol || currencySymbol}
                                {(
                                  fineractLoan.summary.principalDisbursed || 0
                                ).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Paid
                              </p>
                              <p className="text-lg font-semibold text-blue-600">
                                {fineractLoan.currency?.displaySymbol || currencySymbol}
                                {(
                                  fineractLoan.summary.principalPaid || 0
                                ).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Outstanding
                              </p>
                              <p className="text-lg font-semibold text-orange-600">
                                {fineractLoan.currency?.displaySymbol || currencySymbol}
                                {(
                                  fineractLoan.summary.principalOutstanding || 0
                                ).toLocaleString()}
                              </p>
                            </div>
                            {fineractLoan.summary.principalOverdue > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Overdue
                                </p>
                                <p className="text-lg font-semibold text-red-600">
                                  {fineractLoan.currency?.displaySymbol || currencySymbol}
                                  {(
                                    fineractLoan.summary.principalOverdue || 0
                                  ).toLocaleString()}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Interest Section */}
                        <div className="space-y-3 pt-3 border-t">
                          <h4 className="text-sm font-semibold text-foreground border-b pb-2">
                            Interest
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Charged
                              </p>
                              <p className="text-lg font-semibold">
                                {fineractLoan.currency?.displaySymbol || currencySymbol}
                                {(
                                  fineractLoan.summary.interestCharged || 0
                                ).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Paid
                              </p>
                              <p className="text-lg font-semibold text-blue-600">
                                {fineractLoan.currency?.displaySymbol || currencySymbol}
                                {(
                                  fineractLoan.summary.interestPaid || 0
                                ).toLocaleString()}
                              </p>
                            </div>
                            {fineractLoan.summary.interestOutstanding > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Outstanding
                                </p>
                                <p className="text-lg font-semibold text-orange-600">
                                  {fineractLoan.currency?.displaySymbol || currencySymbol}
                                  {(
                                    fineractLoan.summary.interestOutstanding ||
                                    0
                                  ).toLocaleString()}
                                </p>
                              </div>
                            )}
                            {fineractLoan.summary.interestOverdue > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Overdue
                                </p>
                                <p className="text-lg font-semibold text-red-600">
                                  {fineractLoan.currency?.displaySymbol || currencySymbol}
                                  {(
                                    fineractLoan.summary.interestOverdue || 0
                                  ).toLocaleString()}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Charges Section */}
                        {(fineractLoan.summary.feeChargesCharged > 0 ||
                          fineractLoan.summary.penaltyChargesCharged > 0) && (
                          <div className="space-y-3 pt-3 border-t">
                            <h4 className="text-sm font-semibold text-foreground border-b pb-2">
                              Charges
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {fineractLoan.summary.feeChargesCharged > 0 && (
                                <>
                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      Fee Charges
                                    </p>
                                    <p className="text-lg font-semibold">
                                      {fineractLoan.currency?.displaySymbol ||
                                        currencySymbol}
                                      {(
                                        fineractLoan.summary
                                          .feeChargesCharged || 0
                                      ).toLocaleString()}
                                    </p>
                                  </div>
                                  {fineractLoan.summary.feeChargesPaid > 0 && (
                                    <div>
                                      <p className="text-xs text-muted-foreground">
                                        Fee Paid
                                      </p>
                                      <p className="text-lg font-semibold text-blue-600">
                                        {fineractLoan.currency?.displaySymbol ||
                                          currencySymbol}
                                        {(
                                          fineractLoan.summary.feeChargesPaid ||
                                          0
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  )}
                                </>
                              )}
                              {fineractLoan.summary.penaltyChargesCharged >
                                0 && (
                                <>
                                  <div>
                                    <p className="text-xs text-muted-foreground">
                                      Penalty Charges
                                    </p>
                                    <p className="text-lg font-semibold text-red-600">
                                      {fineractLoan.currency?.displaySymbol ||
                                        currencySymbol}
                                      {(
                                        fineractLoan.summary
                                          .penaltyChargesCharged || 0
                                      ).toLocaleString()}
                                    </p>
                                  </div>
                                  {fineractLoan.summary.penaltyChargesPaid >
                                    0 && (
                                    <div>
                                      <p className="text-xs text-muted-foreground">
                                        Penalty Paid
                                      </p>
                                      <p className="text-lg font-semibold text-blue-600">
                                        {fineractLoan.currency?.displaySymbol ||
                                          currencySymbol}
                                        {(
                                          fineractLoan.summary
                                            .penaltyChargesPaid || 0
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Totals Section */}
                        <div className="space-y-3 pt-3 border-t">
                          <h4 className="text-sm font-semibold text-foreground border-b pb-2">
                            Totals
                          </h4>
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Total Outstanding
                              </p>
                              <p className="text-2xl font-bold text-red-600">
                                {fineractLoan.currency?.displaySymbol || currencySymbol}
                                {(
                                  fineractLoan.summary.totalOutstanding || 0
                                ).toLocaleString()}
                              </p>
                            </div>
                            {fineractLoan.summary.totalOverdue > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Total Overdue
                                </p>
                                <p className="text-xl font-semibold text-red-600">
                                  {fineractLoan.currency?.displaySymbol || currencySymbol}
                                  {(
                                    fineractLoan.summary.totalOverdue || 0
                                  ).toLocaleString()}
                                </p>
                              </div>
                            )}
                            {fineractLoan.summary.totalRepayment > 0 && (
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Total Repaid
                                </p>
                                <p className="text-xl font-semibold text-green-600">
                                  {fineractLoan.currency?.displaySymbol || currencySymbol}
                                  {(
                                    fineractLoan.summary.totalRepayment || 0
                                  ).toLocaleString()}
                                </p>
                              </div>
                            )}
                            {fineractLoan.summary.totalExpectedRepayment >
                              0 && (
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  Total Expected
                                </p>
                                <p className="text-lg font-semibold">
                                  {fineractLoan.currency?.displaySymbol || currencySymbol}
                                  {(
                                    fineractLoan.summary
                                      .totalExpectedRepayment || 0
                                  ).toLocaleString()}
                                </p>
                              </div>
                            )}
                            {(() => {
                              const overpaidAmt =
                                fineractLoan.summary.totalOverpaid ||
                                (fineractLoan.summary.totalRepayment > 0 &&
                                fineractLoan.summary.totalOutstanding === 0 &&
                                fineractLoan.summary.totalRepayment >
                                  fineractLoan.summary.totalExpectedRepayment
                                  ? fineractLoan.summary.totalRepayment -
                                    fineractLoan.summary.totalExpectedRepayment
                                  : 0);
                              if (!overpaidAmt || overpaidAmt <= 0) return null;
                              return (
                                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                                  <p className="text-xs text-muted-foreground">
                                    Overpaid By
                                  </p>
                                  <p className="text-xl font-semibold text-green-600">
                                    {fineractLoan.currency?.displaySymbol || currencySymbol}
                                    {overpaidAmt.toLocaleString()}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8">
                        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Loan summary not available
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Summary data will appear here once the loan is
                          disbursed
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Loan Timeline */}
              {fineractLoan.timeline && (
                <Card>
                  <CardHeader>
                    <CardTitle>Loan Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {fineractLoan.timeline.submittedOnDate && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Submitted
                          </p>
                          <p className="font-medium">
                            {format(
                              new Date(
                                Array.isArray(
                                  fineractLoan.timeline.submittedOnDate
                                )
                                  ? fineractLoan.timeline.submittedOnDate.join(
                                      "-"
                                    )
                                  : fineractLoan.timeline.submittedOnDate
                              ),
                              "PPP"
                            )}
                          </p>
                        </div>
                      )}
                      {fineractLoan.timeline.approvedOnDate && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Approved
                          </p>
                          <p className="font-medium">
                            {format(
                              new Date(
                                Array.isArray(
                                  fineractLoan.timeline.approvedOnDate
                                )
                                  ? fineractLoan.timeline.approvedOnDate.join(
                                      "-"
                                    )
                                  : fineractLoan.timeline.approvedOnDate
                              ),
                              "PPP"
                            )}
                          </p>
                        </div>
                      )}
                      {fineractLoan.timeline.expectedDisbursementDate && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Expected Disbursement
                          </p>
                          <p className="font-medium">
                            {format(
                              new Date(
                                Array.isArray(
                                  fineractLoan.timeline.expectedDisbursementDate
                                )
                                  ? fineractLoan.timeline.expectedDisbursementDate.join(
                                      "-"
                                    )
                                  : fineractLoan.timeline
                                      .expectedDisbursementDate
                              ),
                              "PPP"
                            )}
                          </p>
                        </div>
                      )}
                      {fineractLoan.timeline.actualDisbursementDate && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Disbursed
                          </p>
                          <p className="font-medium text-green-600">
                            {format(
                              new Date(
                                Array.isArray(
                                  fineractLoan.timeline.actualDisbursementDate
                                )
                                  ? fineractLoan.timeline.actualDisbursementDate.join(
                                      "-"
                                    )
                                  : fineractLoan.timeline.actualDisbursementDate
                              ),
                              "PPP"
                            )}
                          </p>
                        </div>
                      )}
                      {fineractLoan.timeline.expectedMaturityDate && (
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Expected Maturity
                          </p>
                          <p className="font-medium">
                            {format(
                              new Date(
                                Array.isArray(
                                  fineractLoan.timeline.expectedMaturityDate
                                )
                                  ? fineractLoan.timeline.expectedMaturityDate.join(
                                      "-"
                                    )
                                  : fineractLoan.timeline.expectedMaturityDate
                              ),
                              "PPP"
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <p className="text-muted-foreground">
                    No loan data available from Fineract. Loan may not have been
                    created yet.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="financial" className="mt-4">
          {cdeResult ? (
            <div className="space-y-6">
              {/* Overall Decision */}
              <Card>
                <CardHeader>
                  <CardTitle>CDE Decision</CardTitle>
                  <CardDescription>
                    Credit Decision Engine Evaluation Result
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Decision</p>
                      <Badge
                        className={`mt-2 ${
                          cdeResult.decision === "APPROVED"
                            ? "bg-green-500"
                            : cdeResult.decision === "MANUAL_REVIEW"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        } text-white border-0`}
                      >
                        {cdeResult.decision}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Evaluated At
                      </p>
                      <p className="text-sm font-medium">
                        {cdeResult.decisionTimestamp
                          ? format(new Date(cdeResult.decisionTimestamp), "PPp")
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  {cdeResult.recommendation && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Recommendation
                      </p>
                      <p className="text-base font-medium mt-1">
                        {cdeResult.recommendation}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Scoring Result */}
              {cdeResult.scoringResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>Credit Scoring</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Credit Score
                        </p>
                        <p className="text-2xl font-bold text-blue-600">
                          {cdeResult.scoringResult.creditScore || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Credit Rating
                        </p>
                        <p className="text-lg font-semibold">
                          {cdeResult.scoringResult.creditRating || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Score Percentage
                        </p>
                        <p className="text-lg font-semibold">
                          {cdeResult.scoringResult.scorePercentage
                            ? `${cdeResult.scoringResult.scorePercentage.toFixed(
                                2
                              )}%`
                            : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Total Points
                        </p>
                        <p className="text-lg font-semibold">
                          {cdeResult.scoringResult.totalPoints || "N/A"}
                        </p>
                      </div>
                    </div>
                    {cdeResult.scoringResult.factorScores &&
                      cdeResult.scoringResult.factorScores.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold mb-2">
                            Factor Scores
                          </p>
                          <div className="space-y-2">
                            {cdeResult.scoringResult.factorScores.map(
                              (factor: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 bg-muted/50 rounded"
                                >
                                  <div>
                                    <p className="text-sm font-medium">
                                      {factor.factorName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {factor.bandMatched} •{" "}
                                      {factor.actualValue}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold">
                                      {factor.pointsEarned} / {factor.maxPoints}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {factor.weightedPoints.toFixed(2)} pts
                                    </p>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                  </CardContent>
                </Card>
              )}

              {/* Affordability Result */}
              {cdeResult.affordabilityResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>Affordability Assessment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          DTI Ratio
                        </p>
                        <p className="text-xl font-bold">
                          {(
                            cdeResult.affordabilityResult.dtiRatio * 100
                          ).toFixed(2)}
                          %
                        </p>
                        {cdeResult.affordabilityResult.dtiCheckPassed ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600 mt-1" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Discretionary Income Ratio
                        </p>
                        <p className="text-xl font-bold">
                          {(
                            cdeResult.affordabilityResult
                              .discretionaryIncomeRatio * 100
                          ).toFixed(2)}
                          %
                        </p>
                        {cdeResult.affordabilityResult
                          .discretionaryIncomeCheckPassed ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mt-1" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600 mt-1" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Proposed Payment
                        </p>
                        <p className="text-xl font-bold">
                          $
                          {cdeResult.affordabilityResult.proposedPayment?.toFixed(
                            2
                          ) || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">
                          Overall Affordability:
                        </p>
                        {cdeResult.affordabilityResult
                          .overallAffordabilityPassed ? (
                          <Badge className="bg-green-500 text-white">
                            Passed
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500 text-white">
                            Failed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pricing Result */}
              {cdeResult.pricingResult && (
                <Card>
                  <CardHeader>
                    <CardTitle>Pricing & Risk Assessment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">APR</p>
                        <p className="text-2xl font-bold text-red-600">
                          {cdeResult.pricingResult.calculatedAPR?.toFixed(2) ||
                            "N/A"}
                          %
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Risk Tier
                        </p>
                        <p className="text-lg font-semibold">
                          {cdeResult.pricingResult.riskTier || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Monthly Payment
                        </p>
                        <p className="text-lg font-semibold">
                          $
                          {cdeResult.pricingResult.monthlyPayment?.toFixed(2) ||
                            "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Total Repayment
                        </p>
                        <p className="text-lg font-semibold">
                          $
                          {cdeResult.pricingResult.totalRepayment?.toFixed(2) ||
                            "N/A"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Fraud Check */}
              {cdeResult.fraudCheck && (
                <Card>
                  <CardHeader>
                    <CardTitle>Fraud Check</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Risk Level
                        </p>
                        <Badge
                          className={`mt-2 ${
                            cdeResult.fraudCheck.riskLevel === "NONE"
                              ? "bg-green-500"
                              : cdeResult.fraudCheck.riskLevel === "LOW"
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          } text-white border-0`}
                        >
                          {cdeResult.fraudCheck.riskLevel}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Fraud Score
                        </p>
                        <p className="text-lg font-semibold">
                          {cdeResult.fraudCheck.fraudScore || 0}
                        </p>
                      </div>
                    </div>
                    {cdeResult.fraudCheck.recommendedAction && (
                      <p className="text-sm mt-4">
                        {cdeResult.fraudCheck.recommendedAction}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    CDE evaluation not yet performed
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    The Credit Decision Engine evaluation will appear here once
                    affordability data is saved.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <div className="space-y-6">
            {/* Signatures Section */}
            <Card>
              <CardHeader>
                <CardTitle>Signatures</CardTitle>
              </CardHeader>
              <CardContent>
                {loanInfo?.signatures ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {loanInfo.signatures.borrowerSignature ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        )}
                        <p className="font-semibold">Borrower</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {loanInfo.signatures.borrowerSignature
                          ? "Signed"
                          : "Pending"}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {loanInfo.signatures.guarantorSignature ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-gray-400" />
                        )}
                        <p className="font-semibold">Guarantor</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {loanInfo.signatures.guarantorSignature
                          ? "Signed"
                          : "N/A"}
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        {loanInfo.signatures.loanOfficerSignature ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        )}
                        <p className="font-semibold">Loan Officer</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {loanInfo.signatures.loanOfficerSignature
                          ? "Signed"
                          : "Pending"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No signature information available
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Loan Documents Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      Loan Documents
                      {loanDocuments.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {loanDocuments.length}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Documents uploaded to the loan in Fineract
                      {loanId && (
                        <span className="ml-2 text-xs">
                          (Loan ID: {loanId})
                        </span>
                      )}
                      {loanDocuments.length > 0 && (
                        <span className="ml-2 text-xs text-green-600">
                          • {loanDocuments.length} document(s) found
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  {loadingLoanDocs && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!loanId ? (
                  <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No loan created yet
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Loan documents will appear here once the loan is created
                    </p>
                  </div>
                ) : loadingLoanDocs ? (
                  <div className="text-center py-8">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">
                      Loading loan documents...
                    </p>
                  </div>
                ) : loanDocuments.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                    <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No loan documents found in Fineract
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Documents uploaded to the loan will appear here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {loanDocuments.map((doc, index) => (
                      <div
                        key={doc.id || doc.documentId || `doc-${index}`}
                        className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md border border-border bg-card p-3 hover:bg-muted/50"
                      >
                        <div className="flex items-start gap-3 mb-3 sm:mb-0">
                          <div className="rounded-md bg-green-500/20 p-2">
                            <FileText className="h-5 w-5 text-green-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {doc.name || doc.fileName || `Document ${doc.id}`}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {doc.type || "Document"}
                              </Badge>
                              {doc.size > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {formatFileSize(doc.size)}
                                </span>
                              )}
                              {doc.description && (
                                <span className="text-xs text-muted-foreground">
                                  • {doc.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 justify-between sm:justify-end">
                          <Badge
                            variant="outline"
                            className="border-green-500 bg-green-500/10 text-green-500 text-xs"
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            From Cloud Storage
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Download document"
                            onClick={() => {
                              const docId =
                                doc.id ||
                                doc.documentId ||
                                doc.resourceId ||
                                index;
                              handleDownloadLoanDocument(
                                docId.toString(),
                                doc.fileName || doc.name || `document-${docId}`
                              );
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {fineractLoan && fineractLoan.repaymentSchedule && (
          <TabsContent value="repayment" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Repayment Schedule</CardTitle>
                <CardDescription>Real-time repayment data from</CardDescription>
              </CardHeader>
              <CardContent>
                {fineractLoan.repaymentSchedule.periods && (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Total Principal
                        </p>
                        <p className="text-lg font-bold">
                          {fineractLoan.currency?.displaySymbol || currencySymbol}
                          {(
                            fineractLoan.repaymentSchedule
                              .totalPrincipalExpected || 0
                          ).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Total Interest
                        </p>
                        <p className="text-lg font-bold text-green-600">
                          {fineractLoan.currency?.displaySymbol || currencySymbol}
                          {(
                            fineractLoan.repaymentSchedule
                              .totalInterestCharged || 0
                          ).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Total Repayment
                        </p>
                        <p className="text-lg font-bold text-blue-600">
                          {fineractLoan.currency?.displaySymbol || currencySymbol}
                          {(
                            fineractLoan.repaymentSchedule
                              .totalRepaymentExpected || 0
                          ).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Outstanding
                        </p>
                        <p className="text-lg font-bold text-orange-600">
                          {fineractLoan.currency?.displaySymbol || currencySymbol}
                          {(
                            fineractLoan.repaymentSchedule.totalOutstanding || 0
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Schedule Table */}
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-2 text-left">#</th>
                            <th className="px-4 py-2 text-left">Due Date</th>
                            <th className="px-4 py-2 text-right">Principal</th>
                            <th className="px-4 py-2 text-right">Interest</th>
                            <th className="px-4 py-2 text-right">Total Due</th>
                            <th className="px-4 py-2 text-right">Paid</th>
                            <th className="px-4 py-2 text-right">
                              Outstanding
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(fineractLoan.repaymentSchedule.periods || [])
                            .filter((period: any) => period?.period > 0)
                            .map((period: any) => (
                              <tr key={period.period} className="border-t">
                                <td className="px-4 py-2">{period.period}</td>
                                <td className="px-4 py-2">
                                  {period.dueDate?.join("-") || "N/A"}
                                </td>
                                <td className="px-4 py-2 text-right">
                                  {fineractLoan.currency?.displaySymbol || currencySymbol}
                                  {period.principalDue?.toLocaleString() || 0}
                                </td>
                                <td className="px-4 py-2 text-right">
                                  {fineractLoan.currency?.displaySymbol || currencySymbol}
                                  {period.interestDue?.toLocaleString() || 0}
                                </td>
                                <td className="px-4 py-2 text-right font-medium">
                                  {fineractLoan.currency?.displaySymbol || currencySymbol}
                                  {period.totalDueForPeriod?.toLocaleString() ||
                                    0}
                                </td>
                                <td className="px-4 py-2 text-right text-green-600">
                                  {fineractLoan.currency?.displaySymbol || currencySymbol}
                                  {period.totalPaidForPeriod?.toLocaleString() ||
                                    0}
                                </td>
                                <td className="px-4 py-2 text-right text-orange-600">
                                  {fineractLoan.currency?.displaySymbol || currencySymbol}
                                  {period.totalOutstandingForPeriod?.toLocaleString() ||
                                    0}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {fineractLoan?.id && (
        <>
          <CreditBalanceRefundModal
            isOpen={showCreditBalanceRefundModal}
            onClose={() => setShowCreditBalanceRefundModal(false)}
            loanId={fineractLoan.id}
            onSuccess={() => {
              fetchData(false);
              window.dispatchEvent(
                new CustomEvent("loan-action-complete", {
                  detail: { leadId },
                })
              );
            }}
          />
          <TransferFundsModal
            isOpen={showTransferFundsModal}
            onClose={() => setShowTransferFundsModal(false)}
            loanId={fineractLoan.id}
            clientId={fineractLoan.clientId}
            overpaidAmount={
              fineractLoan.summary?.totalOverpaid ||
              (fineractLoan.summary?.totalRepayment >
                fineractLoan.summary?.totalExpectedRepayment
                ? fineractLoan.summary.totalRepayment -
                  fineractLoan.summary.totalExpectedRepayment
                : 0)
            }
            currencySymbol={
              fineractLoan.currency?.displaySymbol || currencySymbol
            }
            onSuccess={() => {
              fetchData(false);
              window.dispatchEvent(
                new CustomEvent("loan-action-complete", {
                  detail: { leadId },
                })
              );
            }}
          />
        </>
      )}
    </div>
  );
}
