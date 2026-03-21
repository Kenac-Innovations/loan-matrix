"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import {
  FileText,
  Download,
  Eye,
  Calendar,
  AlertCircle,
  Upload,
  CheckCircle2,
  X,
  ShieldAlert,
  Clock,
} from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  storageType: number;
  createdDate: string;
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

interface ClientDocumentsProps {
  clientId: number;
}

function getExpiryInfo(
  createdAt: string,
  expiryMonths: number | null
): {
  expiryDate: Date | null;
  isExpired: boolean;
  daysUntilExpiry: number | null;
} {
  if (!expiryMonths)
    return { expiryDate: null, isExpired: false, daysUntilExpiry: null };
  const created = new Date(createdAt);
  const expiry = new Date(created);
  expiry.setMonth(expiry.getMonth() + expiryMonths);
  const now = new Date();
  const daysUntilExpiry = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  return { expiryDate: expiry, isExpired: daysUntilExpiry <= 0, daysUntilExpiry };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function ClientDocuments({ clientId }: ClientDocumentsProps) {
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR(`/api/fineract/clients/${clientId}/documents`, fetcher);

  const [requiredDocs, setRequiredDocs] = useState<RequiredDocConfig[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedRequiredDoc, setSelectedRequiredDoc] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadDescription, setUploadDescription] = useState("");

  useEffect(() => {
    fetch("/api/pipeline/required-documents")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) =>
        setRequiredDocs(data.filter((d: RequiredDocConfig) => d.isActive))
      )
      .catch(() => {});
  }, []);

  const documents: FineractDocument[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.pageItems && Array.isArray(data.pageItems)) return data.pageItems;
    if (data.content && Array.isArray(data.content)) return data.content;
    if (data.documents && Array.isArray(data.documents)) return data.documents;
    return [];
  })();

  const isDocUploaded = (reqName: string) => {
    const target = reqName.toLowerCase();
    return documents.some((d) =>
      (d.name || d.fileName || "").toLowerCase().includes(target)
    );
  };

  const handleUploadDocument = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const docName =
          selectedRequiredDoc && selectedRequiredDoc !== "__other__"
            ? `${selectedRequiredDoc} - ${file.name}`
            : file.name;

        const formData = new FormData();
        formData.append("name", docName);
        formData.append("file", file);
        if (uploadDescription) {
          formData.append("description", uploadDescription);
        }

        await fetch(`/api/fineract/clients/${clientId}/documents`, {
          method: "POST",
          body: formData,
        });
      }

      mutate();
      setShowUploadModal(false);
      setSelectedRequiredDoc("");
      setUploadDescription("");
    } catch (err) {
      console.error("Error uploading document:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadDocument = async (
    documentId: number,
    fileName: string
  ) => {
    try {
      const response = await fetch(
        `/api/fineract/clients/${clientId}/documents/${documentId}/attachment`
      );
      if (!response.ok) throw new Error("Failed to download");
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
      console.error("Error downloading document:", err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getFileTypeIcon = (type: string) => {
    if (type.includes("pdf"))
      return <FileText className="h-4 w-4 text-red-500" />;
    if (type.includes("image"))
      return <FileText className="h-4 w-4 text-blue-500" />;
    return <FileText className="h-4 w-4 text-gray-500" />;
  };

  const getFileTypeBadge = (type: string) => {
    if (type.includes("pdf")) {
      return (
        <Badge variant="outline" className="bg-red-500 text-white border-0">
          PDF
        </Badge>
      );
    }
    if (type.includes("image")) {
      return (
        <Badge variant="outline" className="bg-blue-500 text-white border-0">
          Image
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-gray-500 text-white border-0">
        Document
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load client documents from Fineract</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Documents</CardTitle>
            <CardDescription>Client documents and attachments</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowUploadModal(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>
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
                  const uploaded = isDocUploaded(req.name);
                  const matchedDoc = uploaded
                    ? documents.find((d) =>
                        (d.name || d.fileName || "")
                          .toLowerCase()
                          .includes(req.name.toLowerCase())
                      )
                    : null;
                  const expiry =
                    matchedDoc?.createdDate && req.expiryMonths
                      ? getExpiryInfo(matchedDoc.createdDate, req.expiryMonths)
                      : null;

                  return (
                    <div
                      key={req.id}
                      className={`flex items-center gap-2 p-2 rounded-md border text-sm ${
                        uploaded
                          ? expiry?.isExpired
                            ? "border-red-200 bg-red-50 dark:bg-red-950/20"
                            : "border-green-200 bg-green-50 dark:bg-green-950/20"
                          : req.isRequired
                          ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20"
                          : "border-border bg-background"
                      }`}
                    >
                      {uploaded ? (
                        expiry?.isExpired ? (
                          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        )
                      ) : (
                        <div
                          className={`h-4 w-4 rounded-full border-2 shrink-0 ${
                            req.isRequired
                              ? "border-amber-400"
                              : "border-muted-foreground/30"
                          }`}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <span
                          className={`font-medium ${
                            !uploaded && req.isRequired
                              ? "text-amber-700 dark:text-amber-400"
                              : ""
                          }`}
                        >
                          {req.name}
                        </span>
                        {req.isRequired && !uploaded && (
                          <span className="text-xs text-red-500 ml-1">*</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {uploaded && expiry?.expiryDate && (
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
                        {!uploaded && req.expiryMonths && (
                          <span className="text-[10px] text-muted-foreground">
                            {req.expiryMonths}mo validity
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const requiredCount = requiredDocs.filter(
                  (r) => r.isRequired
                ).length;
                const uploadedRequired = requiredDocs.filter((r) => {
                  if (!r.isRequired) return false;
                  return isDocUploaded(r.name);
                }).length;
                return (
                  <p className="text-xs text-muted-foreground mt-3">
                    {uploadedRequired}/{requiredCount} required documents
                    uploaded
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

          {/* Documents Table */}
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No documents found for this client
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => setShowUploadModal(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload First Document
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {getFileTypeIcon(doc.type)}
                          <div>
                            <div className="font-medium">{doc.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {doc.fileName}
                            </div>
                            {doc.description && (
                              <div className="text-xs text-muted-foreground">
                                {doc.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getFileTypeBadge(doc.type)}</TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatFileSize(doc.size)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {formatDate(doc.createdDate)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleDownloadDocument(
                                doc.id,
                                doc.fileName || doc.name
                              )
                            }
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                              {uploaded && (
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                              )}
                              {doc.name}
                              {doc.isRequired && !uploaded && (
                                <span className="text-red-500 text-xs">
                                  Required
                                </span>
                              )}
                              {uploaded && (
                                <span className="text-green-600 text-xs">
                                  Uploaded
                                </span>
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

              <div>
                <Label className="text-sm font-medium">Description</Label>
                <Input
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Optional description"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">
                  File <span className="text-red-500">*</span>
                </Label>
                <div className="mt-1">
                  <label
                    className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      uploading ||
                      (requiredDocs.length > 0 && !selectedRequiredDoc)
                        ? "opacity-50 cursor-not-allowed border-muted"
                        : "hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border-muted-foreground/30"
                    }`}
                  >
                    <Upload className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {uploading
                        ? "Uploading..."
                        : selectedRequiredDoc &&
                          selectedRequiredDoc !== "__other__"
                        ? `Click to upload ${selectedRequiredDoc}`
                        : "Click to select file"}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      disabled={
                        uploading ||
                        (requiredDocs.length > 0 && !selectedRequiredDoc)
                      }
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
