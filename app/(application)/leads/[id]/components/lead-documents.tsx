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
} from "lucide-react";

interface LeadDocumentsProps {
  leadId: string;
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

interface LoanDocument {
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

export function LeadDocuments({ leadId }: LeadDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loanDocuments, setLoanDocuments] = useState<LoanDocument[]>([]);
  const [fineractLoanId, setFineractLoanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingLoanDocs, setLoadingLoanDocs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);

        // Fetch lead documents
        const response = await fetch(`/api/leads/${leadId}/documents`);
        if (!response.ok) {
          throw new Error("Failed to fetch documents");
        }
        const data = await response.json();
        setDocuments(data);

        // Fetch lead complete details to get fineractLoanId
        const leadDetailsResponse = await fetch(
          `/api/leads/${leadId}/complete-details`
        );
        if (leadDetailsResponse.ok) {
          const leadDetails = await leadDetailsResponse.json();
          const loanId = leadDetails?.lead?.fineractLoanId;

          if (loanId) {
            setFineractLoanId(loanId.toString());
            // Fetch loan documents
            await fetchLoanDocuments(loanId.toString());
          }
        }
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
        let docs: LoanDocument[] = [];

        if (Array.isArray(data)) {
          // Direct array response
          docs = data;
        } else if (data.pageItems && Array.isArray(data.pageItems)) {
          // Paginated response
          docs = data.pageItems;
        } else if (data.content && Array.isArray(data.content)) {
          // Alternative paginated structure
          docs = data.content;
        } else if (data.data && Array.isArray(data.data)) {
          // Wrapped in data property
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
        <Button className="bg-blue-500 hover:bg-blue-600">
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
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
                          From Fineract
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
          {documents.length === 0 && !fineractLoanId ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No documents uploaded yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Upload documents to get started with the loan application
                process.
              </p>
              <Button className="bg-blue-500 hover:bg-blue-600">
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
                                  <div className="flex items-center gap-2 mt-1">
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
    </Card>
  );
}
