"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Upload,
  Download,
  Eye,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface LeadDocumentsProps {
  leadId: string;
  fineractClientId?: number | null;
  fineractLoanId?: number | null;
  initialClientDocuments?: any[];
  initialLoanDocuments?: any[];
}

interface Document {
  id: string;
  name: string;
  originalName: string;
  type: string;
  size: number;
  category: string;
  status: string;
  filePath?: string;
  mimeType?: string;
  uploadedBy: string;
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface RequiredDocConfig {
  id: string;
  name: string;
  description?: string;
  category: string;
  expiryMonths: number | null;
  isRequired: boolean;
  isActive: boolean;
}

function getExpiryInfo(createdAt: string, expiryMonths: number | null): { expiryDate: Date | null; isExpired: boolean; daysUntilExpiry: number | null } {
  if (!expiryMonths) return { expiryDate: null, isExpired: false, daysUntilExpiry: null };
  const created = new Date(createdAt);
  const expiry = new Date(created);
  expiry.setMonth(expiry.getMonth() + expiryMonths);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return { expiryDate: expiry, isExpired: daysUntilExpiry <= 0, daysUntilExpiry };
}

interface FineractDocument {
  id: number;
  parentEntityType: string;
  parentEntityId: number;
  name: string;
  fileName: string;
  size: number;
  type: string;
  description?: string;
  location?: string;
  storageKey?: string;
}

export function LeadDocuments({ 
  leadId,
  fineractClientId: initialClientId,
  fineractLoanId: initialLoanId,
  initialClientDocuments = [],
  initialLoanDocuments = [],
}: LeadDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loanDocuments, setLoanDocuments] = useState<FineractDocument[]>(initialLoanDocuments);
  const [clientDocuments, setClientDocuments] = useState<FineractDocument[]>(initialClientDocuments);
  const [fineractLoanId, setFineractLoanId] = useState<string | null>(
    initialLoanId ? String(initialLoanId) : null
  );
  const [fineractClientId, setFineractClientId] = useState<string | null>(
    initialClientId ? String(initialClientId) : null
  );
  const [requiredDocs, setRequiredDocs] = useState<RequiredDocConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLoanDocs, setLoadingLoanDocs] = useState(false);
  const [loadingClientDocs, setLoadingClientDocs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(
    initialClientDocuments.length > 0 || initialLoanDocuments.length > 0
  );
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedRequiredDoc, setSelectedRequiredDoc] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadDescription, setUploadDescription] = useState("");

  useEffect(() => {
    fetch("/api/pipeline/required-documents")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setRequiredDocs(data.filter((d: RequiredDocConfig) => d.isActive)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchDocuments = async () => {
      // Skip if we already have server-side data
      if (hasFetched) return;

      try {
        setLoading(true);

        // Fetch lead documents (local)
        const response = await fetch(`/api/leads/${leadId}/documents`);
        if (!response.ok) {
          throw new Error("Failed to fetch documents");
        }
        const data = await response.json();
        setDocuments(data);

        // Only fetch Fineract documents if not already provided
        if (initialClientDocuments.length === 0 && initialLoanDocuments.length === 0) {
          // Fetch lead complete details to get fineractLoanId and fineractClientId
        const leadDetailsResponse = await fetch(
          `/api/leads/${leadId}/complete-details`
        );
        if (leadDetailsResponse.ok) {
          const leadDetails = await leadDetailsResponse.json();
            const loanId = leadDetails?.fineractLoan?.id;
            const clientId = leadDetails?.lead?.fineractClientId;

            if (loanId && !fineractLoanId) {
            setFineractLoanId(loanId.toString());
            // Fetch loan documents
            await fetchLoanDocuments(loanId.toString());
          }

            if (clientId && !fineractClientId) {
              setFineractClientId(clientId.toString());
              // Fetch client documents
              await fetchClientDocuments(clientId.toString());
            }
          }
        }

        setHasFetched(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    const fetchLoanDocuments = async (loanId: string) => {
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

        const data = await response.json();
        console.log("Loan documents response:", data);

        // Handle different response structures from Fineract
        let docs: FineractDocument[] = [];

        if (Array.isArray(data)) {
          docs = data;
        } else if (data.pageItems && Array.isArray(data.pageItems)) {
          docs = data.pageItems;
        } else if (data.content && Array.isArray(data.content)) {
          docs = data.content;
        } else if (data.data && Array.isArray(data.data)) {
          docs = data.data;
        } else {
          console.warn("Unexpected loan documents response structure:", data);
          docs = [];
        }

        console.log(`Found ${docs.length} loan documents`);
        setLoanDocuments(docs);
      } catch (err) {
        console.error("Error fetching loan documents:", err);
        setLoanDocuments([]);
      } finally {
        setLoadingLoanDocs(false);
      }
    };

    const fetchClientDocuments = async (clientId: string) => {
      try {
        setLoadingClientDocs(true);
        console.log("Fetching client documents for client ID:", clientId);
        const response = await fetch(`/api/fineract/clients/${clientId}/documents`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.warn("Failed to fetch client documents:", {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
          setClientDocuments([]);
          return;
        }

        const data = await response.json();
        console.log("Client documents response:", data);

        // Handle different response structures from Fineract
        let docs: FineractDocument[] = [];

        if (Array.isArray(data)) {
          docs = data;
        } else if (data.pageItems && Array.isArray(data.pageItems)) {
          docs = data.pageItems;
        } else if (data.content && Array.isArray(data.content)) {
          docs = data.content;
        } else if (data.data && Array.isArray(data.data)) {
          docs = data.data;
        } else {
          console.warn("Unexpected client documents response structure:", data);
          docs = [];
        }

        console.log(`Found ${docs.length} client documents`);
        setClientDocuments(docs);
      } catch (err) {
        console.error("Error fetching client documents:", err);
        setClientDocuments([]);
      } finally {
        setLoadingClientDocs(false);
      }
    };

    fetchDocuments();
  }, [leadId]);

  const handleDeleteDocument = async (documentId: string) => {
    try {
      const response = await fetch(
        `/api/leads/${leadId}/documents?documentId=${documentId}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to delete document");
      }
      // Remove document from state
      setDocuments(documents.filter((doc) => doc.id !== documentId));
    } catch (err) {
      console.error("Error deleting document:", err);
    }
  };

  const handleVerifyDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/leads/${leadId}/documents`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          status: "verified",
          verifiedBy: "current-user", // This should be the actual user ID
          verifiedAt: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to verify document");
      }
      const updatedDocument = await response.json();
      // Update document in state
      setDocuments(
        documents.map((doc) => (doc.id === documentId ? updatedDocument : doc))
      );
    } catch (err) {
      console.error("Error verifying document:", err);
    }
  };

  const isDocUploaded = (reqName: string) => {
    const target = reqName.toLowerCase();
    return documents.some((d) => d.name.toLowerCase().includes(target)) ||
      clientDocuments.some((d) => (d.name || d.fileName || "").toLowerCase().includes(target));
  };

  const handleUploadDocument = async (files: FileList | null) => {
    if (!files || files.length === 0 || !fineractClientId) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const docName = selectedRequiredDoc && selectedRequiredDoc !== "__other__"
          ? `${selectedRequiredDoc} - ${file.name}`
          : file.name;

        const formData = new FormData();
        formData.append("name", docName);
        formData.append("file", file);
        if (uploadDescription) {
          formData.append("description", uploadDescription);
        }

        const response = await fetch(
          `/api/fineract/clients/${fineractClientId}/documents`,
          { method: "POST", body: formData }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Upload failed:", errorData);
          setError(`Failed to upload ${file.name}`);
          continue;
        }
      }

      // Refresh client documents
      const res = await fetch(`/api/fineract/clients/${fineractClientId}/documents`);
      if (res.ok) {
        const data = await res.json();
        setClientDocuments(Array.isArray(data) ? data : data.pageItems || data.content || []);
      }

      setShowUploadModal(false);
      setSelectedRequiredDoc("");
      setUploadDescription("");
    } catch (err) {
      console.error("Error uploading document:", err);
      setError("An error occurred during upload");
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleDownloadLoanDocument = async (
    documentId: string,
    fileName: string
  ) => {
    if (!fineractLoanId) return;

    try {
      const response = await fetch(
        `/api/fineract/loans/${fineractLoanId}/documents/${documentId}/attachment`
      );

      if (!response.ok) {
        throw new Error("Failed to download document");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || `document-${documentId}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error downloading loan document:", err);
    }
  };

  const handleDownloadClientDocument = async (
    documentId: string,
    fileName: string
  ) => {
    if (!fineractClientId) return;

    try {
      const response = await fetch(
        `/api/fineract/clients/${fineractClientId}/documents/${documentId}/attachment`
      );

      if (!response.ok) {
        throw new Error("Failed to download document");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || `document-${documentId}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Error downloading client document:", err);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Group documents by category
  const documentsByCategory = documents.reduce((acc, doc) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  // If no documents exist, show sample data structure
  const displayCategories =
    Object.keys(documentsByCategory).length > 0
      ? documentsByCategory
      : {
          "Business Documents": [],
          "Financial Documents": [],
          "Collateral Documents": [],
        };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle>Lead Documents</CardTitle>
          <CardDescription>
            Documents submitted for this loan application
            {documents.length > 0 && ` (${documents.length} documents)`}
          </CardDescription>
        </div>
        <Button
          className="bg-blue-500 hover:bg-blue-600"
          onClick={() => setShowUploadModal(true)}
          disabled={!fineractClientId}
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Required Documents Checklist */}
          {requiredDocs.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                Required Documents Checklist
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {requiredDocs.map((req) => {
                  const target = req.name.toLowerCase();
                  const matchedLocalDoc = documents.find(
                    (d) => d.name.toLowerCase().includes(target)
                  );
                  const matchedFineractDoc = clientDocuments.find(
                    (d) => (d.name || d.fileName || "").toLowerCase().includes(target)
                  );
                  const isUploaded = !!matchedLocalDoc || !!matchedFineractDoc;
                  const expiry = matchedLocalDoc && req.expiryMonths
                    ? getExpiryInfo(matchedLocalDoc.createdAt, req.expiryMonths)
                    : null;

                  return (
                    <div
                      key={req.id}
                      className={`flex items-center gap-2 p-2 rounded-md border text-sm ${
                        isUploaded
                          ? expiry?.isExpired
                            ? "border-red-200 bg-red-50 dark:bg-red-950/20"
                            : "border-green-200 bg-green-50 dark:bg-green-950/20"
                          : req.isRequired
                          ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20"
                          : "border-border bg-background"
                      }`}
                    >
                      {isUploaded ? (
                        expiry?.isExpired ? (
                          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        )
                      ) : (
                        <div className={`h-4 w-4 rounded-full border-2 shrink-0 ${
                          req.isRequired ? "border-amber-400" : "border-muted-foreground/30"
                        }`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className={`font-medium ${!isUploaded && req.isRequired ? "text-amber-700 dark:text-amber-400" : ""}`}>
                          {req.name}
                        </span>
                        {req.isRequired && !isUploaded && (
                          <span className="text-xs text-red-500 ml-1">*</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isUploaded && expiry?.expiryDate && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${
                                    expiry.isExpired
                                      ? "border-red-300 text-red-600 bg-red-50"
                                      : (expiry.daysUntilExpiry ?? 0) <= 30
                                      ? "border-amber-300 text-amber-600 bg-amber-50"
                                      : "border-green-300 text-green-600 bg-green-50"
                                  }`}
                                >
                                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                                  {expiry.isExpired
                                    ? "Expired"
                                    : `${expiry.daysUntilExpiry}d`}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {expiry.isExpired
                                    ? `Expired on ${expiry.expiryDate.toLocaleDateString()}`
                                    : `Expires ${expiry.expiryDate.toLocaleDateString()} (${expiry.daysUntilExpiry} days)`}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {!isUploaded && req.expiryMonths && (
                          <span className="text-[10px] text-muted-foreground">{req.expiryMonths}mo validity</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const requiredCount = requiredDocs.filter((r) => r.isRequired).length;
                const uploadedRequired = requiredDocs.filter((r) => {
                  if (!r.isRequired) return false;
                  const t = r.name.toLowerCase();
                  return documents.some((d) => d.name.toLowerCase().includes(t)) ||
                    clientDocuments.some((d) => (d.name || d.fileName || "").toLowerCase().includes(t));
                }).length;
                return (
                  <p className="text-xs text-muted-foreground mt-3">
                    {uploadedRequired}/{requiredCount} required documents uploaded
                    {uploadedRequired < requiredCount && (
                      <span className="text-amber-600 ml-1">
                        — {requiredCount - uploadedRequired} missing
                      </span>
                    )}
                  </p>
                );
              })()}
            </div>
          )}

          {/* Client Documents Section */}
          {fineractClientId && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-foreground">
                  Client Documents
                  {clientDocuments.length > 0 && (
                    <span className="ml-2 text-muted-foreground">
                      ({clientDocuments.length})
                    </span>
                  )}
                </h3>
                {loadingClientDocs && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {loadingClientDocs ? (
                <div className="text-center py-8">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">
                    Loading client documents...
                  </p>
                </div>
              ) : clientDocuments.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    No client documents found in Fineract
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clientDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md border border-border bg-card p-3 hover:bg-muted/50"
                    >
                      <div className="flex items-start gap-3 mb-3 sm:mb-0">
                        <div className="rounded-md bg-purple-500/20 p-2">
                          <FileText className="h-5 w-5 text-purple-500" />
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
                          className="border-purple-500 bg-purple-500/10 text-purple-500 text-xs"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Client Document
                        </Badge>
                        <div className="flex items-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Download document"
                            onClick={() =>
                              handleDownloadClientDocument(
                                doc.id.toString(),
                                doc.fileName || doc.name
                              )
                            }
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Loan Documents Section */}
          {fineractLoanId && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-foreground">
                  Loan Documents
                  {loanDocuments.length > 0 && (
                    <span className="ml-2 text-muted-foreground">
                      ({loanDocuments.length})
                    </span>
                  )}
                </h3>
                {loadingLoanDocs && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {loadingLoanDocs ? (
                <div className="text-center py-8">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">
                    Loading loan documents...
                  </p>
                </div>
              ) : loanDocuments.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    No loan documents found in Fineract
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {loanDocuments.map((doc) => (
                    <div
                      key={doc.id}
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
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          From Cloud Storage
                        </Badge>
                        <div className="flex items-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Download document"
                            onClick={() =>
                              handleDownloadLoanDocument(
                                doc.id.toString(),
                                doc.fileName || doc.name
                              )
                            }
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Lead Documents Section */}
          {documents.length === 0 && loanDocuments.length === 0 && clientDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No documents uploaded yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Upload documents to get started with the loan application
                process.
              </p>
              <Button
                className="bg-blue-500 hover:bg-blue-600"
                onClick={() => setShowUploadModal(true)}
                disabled={!fineractClientId}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload First Document
              </Button>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-medium mb-3 text-foreground">
                Application Documents
                {documents.length > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    ({documents.length})
                  </span>
                )}
              </h3>
              {documents.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    No application documents uploaded yet
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(displayCategories).map(([category, docs]) => (
                    <div key={category}>
                      <h3 className="text-sm font-medium mb-3 text-foreground">
                        {category}
                        {docs.length > 0 && (
                          <span className="ml-2 text-muted-foreground">
                            ({docs.length})
                          </span>
                        )}
                      </h3>
                      {docs.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            No {category.toLowerCase()} uploaded yet
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {docs.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between rounded-md border border-border bg-card p-3 hover:bg-muted/50"
                            >
                              <div className="flex items-start gap-3 mb-3 sm:mb-0">
                                <div className="rounded-md bg-blue-500/20 p-2">
                                  <FileText className="h-5 w-5 text-blue-500" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {doc.name}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {doc.type}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {formatFileSize(doc.size)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      •{" "}
                                      {new Date(
                                        doc.createdAt
                                      ).toLocaleDateString()}
                                    </span>
                                    {(() => {
                                      const matchedReq = requiredDocs.find(
                                        (r) => doc.name.toLowerCase().includes(r.name.toLowerCase())
                                      );
                                      if (!matchedReq?.expiryMonths) return null;
                                      const expiry = getExpiryInfo(doc.createdAt, matchedReq.expiryMonths);
                                      if (!expiry.expiryDate) return null;
                                      return (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Badge
                                                variant="outline"
                                                className={`text-[10px] px-1.5 py-0 ${
                                                  expiry.isExpired
                                                    ? "border-red-300 text-red-600 bg-red-50"
                                                    : (expiry.daysUntilExpiry ?? 0) <= 30
                                                    ? "border-amber-300 text-amber-600 bg-amber-50"
                                                    : "border-green-300 text-green-600 bg-green-50"
                                                }`}
                                              >
                                                <Clock className="h-2.5 w-2.5 mr-0.5" />
                                                {expiry.isExpired
                                                  ? "Expired"
                                                  : `Expires ${expiry.expiryDate.toLocaleDateString()}`}
                                              </Badge>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>
                                                {expiry.isExpired
                                                  ? `Expired on ${expiry.expiryDate.toLocaleDateString()}`
                                                  : `Valid until ${expiry.expiryDate.toLocaleDateString()} (${expiry.daysUntilExpiry} days remaining)`}
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      );
                                    })()}
                                  </div>
                                  {doc.notes && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {doc.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 justify-between sm:justify-end">
                                {doc.status === "verified" ? (
                                  <Badge
                                    variant="outline"
                                    className="border-green-500 bg-green-500/10 text-green-500 text-xs"
                                  >
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    Verified
                                  </Badge>
                                ) : doc.status === "rejected" ? (
                                  <Badge
                                    variant="outline"
                                    className="border-red-500 bg-red-500/10 text-red-500 text-xs"
                                  >
                                    <AlertCircle className="mr-1 h-3 w-3" />
                                    Rejected
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="border-yellow-500 bg-yellow-500/10 text-yellow-500 text-xs"
                                  >
                                    <AlertCircle className="mr-1 h-3 w-3" />
                                    Pending Verification
                                  </Badge>
                                )}
                                <div className="flex items-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    title="View document"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    title="Download document"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                  {doc.status === "pending" && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-green-500"
                                      title="Verify document"
                                      onClick={() =>
                                        handleVerifyDocument(doc.id)
                                      }
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                    title="Delete document"
                                    onClick={() => handleDeleteDocument(doc.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="bg-card border rounded-lg shadow-lg p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Upload Document</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedRequiredDoc("");
                  setUploadDescription("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Document Type Selector */}
              {requiredDocs.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">
                    Document Type <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={selectedRequiredDoc}
                    onValueChange={setSelectedRequiredDoc}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select document type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {requiredDocs.map((doc) => {
                        const uploaded = isDocUploaded(doc.name);
                        return (
                          <SelectItem
                            key={doc.id}
                            value={doc.name}
                            disabled={uploaded}
                          >
                            <span className="flex items-center gap-2">
                              {uploaded && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                              {doc.name}
                              {doc.isRequired && !uploaded && (
                                <span className="text-red-500 text-xs">Required</span>
                              )}
                              {uploaded && (
                                <span className="text-green-600 text-xs">Uploaded</span>
                              )}
                            </span>
                          </SelectItem>
                        );
                      })}
                      <SelectItem value="__other__">Other Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Description */}
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <Input
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Optional description"
                  className="mt-1"
                />
              </div>

              {/* File Selection */}
              <div>
                <Label className="text-sm font-medium">
                  File <span className="text-red-500">*</span>
                </Label>
                <div className="mt-1">
                  <label
                    className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      uploading || (requiredDocs.length > 0 && !selectedRequiredDoc)
                        ? "opacity-50 cursor-not-allowed border-muted"
                        : "hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border-muted-foreground/30"
                    }`}
                  >
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {uploading
                        ? "Uploading..."
                        : selectedRequiredDoc && selectedRequiredDoc !== "__other__"
                        ? `Click to upload ${selectedRequiredDoc}`
                        : "Click to select file"}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      disabled={uploading || (requiredDocs.length > 0 && !selectedRequiredDoc)}
                      onChange={(e) => handleUploadDocument(e.target.files)}
                    />
                  </label>
                  {requiredDocs.length > 0 && !selectedRequiredDoc && (
                    <p className="text-xs text-amber-600 mt-1">
                      Select a document type before uploading
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedRequiredDoc("");
                  setUploadDescription("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
