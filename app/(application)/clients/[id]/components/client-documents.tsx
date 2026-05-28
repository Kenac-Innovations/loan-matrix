"use client";

import { useRef, useState, type FormEvent } from "react";
import useSWR from 'swr';
import {
  FileText,
  Download,
  AlertCircle,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadClientDocumentAttachment } from "@/app/actions/client-document-actions";
import { formatDateDdMmYyyy } from "@/lib/date-format";

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
  uploadedBy?: string;
  uploadedAt?: string;
}

interface ClientDocumentsProps {
  clientId: number;
}

// Simple fetcher for SWR
const fetcher = (url: string) => fetch(url).then(res => res.json());

export function ClientDocuments({ clientId }: ClientDocumentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<number | null>(null);
  const canSubmitUpload = uploadFileName.trim().length > 0 && uploadFile !== null;
  const { data, error, isLoading, mutate } = useSWR(
    `/api/fineract/clients/${clientId}/documents`,
    fetcher
  );

  // Handle different response formats
  const documents: FineractDocument[] = (() => {
    if (!data) return [];
    
    // If data is directly an array
    if (Array.isArray(data)) {
      return data;
    }
    
    // If data has pageItems (Fineract pagination format)
    if (data.pageItems && Array.isArray(data.pageItems)) {
      return data.pageItems;
    }
    
    // If data has content (another Fineract format)
    if (data.content && Array.isArray(data.content)) {
      return data.content;
    }
    
    // If data has documents property
    if (data.documents && Array.isArray(data.documents)) {
      return data.documents;
    }
    
    // Fallback to empty array
    return [];
  })();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileTypeIcon = (type: string) => {
    if (type.includes("pdf")) {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    if (type.includes("image")) {
      return <FileText className="h-4 w-4 text-blue-500" />;
    }
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

  const resetUploadForm = () => {
    setUploadFileName("");
    setUploadDescription("");
    setUploadFile(null);
    setUploadError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadDialogOpenChange = (open: boolean) => {
    setIsUploadDialogOpen(open);

    if (!open) {
      resetUploadForm();
      setIsUploading(false);
    } else {
      setUploadError(null);
    }
  };

  const handleDownloadDocument = async (doc: FineractDocument) => {
    setDownloadingDocumentId(doc.id);

    try {
      const result = await downloadClientDocumentAttachment(clientId, doc.id);

      if (!result.success || !result.fileBuffer) {
        throw new Error(result.error || "Failed to download document");
      }

      const blob = new Blob([result.fileBuffer], {
        type: result.contentType || "application/octet-stream",
      });
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download =
        result.fileName || doc.fileName || doc.name || `document-${doc.id}`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Document downloaded successfully");
    } catch (error) {
      console.error("Error downloading client document:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to download document"
      );
    } finally {
      setDownloadingDocumentId((currentId) =>
        currentId === doc.id ? null : currentId
      );
    }
  };

  const handleUploadDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmitUpload) {
      setUploadError("File name and file are required. Description is optional.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("name", uploadFileName.trim());
      formData.append("file", uploadFile);

      if (uploadDescription.trim()) {
        formData.append("description", uploadDescription.trim());
      }

      const response = await fetch(`/api/fineract/clients/${clientId}/documents`, {
        method: "POST",
        body: formData,
      });

      const contentType = response.headers.get("content-type") || "";

      if (!response.ok) {
        let errorMessage = "Failed to upload document";

        try {
          if (contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage =
              errorData.error ||
              errorData.defaultUserMessage ||
              errorData.developerMessage ||
              errorMessage;
          } else {
            const responseText = await response.text();
            if (responseText.trim()) {
              errorMessage = responseText;
            }
          }
        } catch {
          // Keep the default error message when the body is not parseable.
        }

        throw new Error(errorMessage);
      }

      await response.json().catch(() => ({}));
      await mutate();
      handleUploadDialogOpenChange(false);
      toast.success("Document uploaded successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to upload document";
      setUploadError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsUploading(false);
    }
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
          <Button
            type="button"
            size="sm"
            onClick={() => handleUploadDialogOpenChange(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No documents found for this client
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Uploaded On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {getFileTypeIcon(document.type)}
                        <div>
                          <div className="font-medium">{document.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {document.fileName}
                          </div>
                          {document.description && (
                            <div className="text-xs text-muted-foreground">
                              {document.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getFileTypeBadge(document.type)}</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatFileSize(document.size)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {document.uploadedBy?.trim() || "---"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {formatDateDdMmYyyy(document.uploadedAt || document.createdDate)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleDownloadDocument(document)}
                          disabled={downloadingDocumentId === document.id}
                          title={
                            downloadingDocumentId === document.id
                              ? "Downloading document"
                              : "Download document"
                          }
                          aria-label={
                            downloadingDocumentId === document.id
                              ? `Downloading ${document.name}`
                              : `Download ${document.name}`
                          }
                        >
                          {downloadingDocumentId === document.id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Downloading...</span>
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4" />
                              <span>Download</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={isUploadDialogOpen} onOpenChange={handleUploadDialogOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Add a file name, optional description, and choose the file to upload to Fineract.
          </DialogDescription>
          <p className="text-xs text-muted-foreground">
            File name and file are required. Description is optional.
          </p>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleUploadDocument}>
            {uploadError && (
              <p className="text-sm text-destructive">{uploadError}</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="document-file-name">
                File name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="document-file-name"
                value={uploadFileName}
                onChange={(e) => {
                  setUploadFileName(e.target.value);
                  if (uploadError) setUploadError(null);
                }}
                placeholder="e.g. National ID"
                disabled={isUploading}
                autoComplete="off"
                required
                aria-required="true"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document-description">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="document-description"
                value={uploadDescription}
                onChange={(e) => {
                  setUploadDescription(e.target.value);
                  if (uploadError) setUploadError(null);
                }}
                placeholder="Optional description"
                disabled={isUploading}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document-file">
                File <span className="text-destructive">*</span>
              </Label>
              <Input
                ref={fileInputRef}
                id="document-file"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setUploadFile(file);
                  if (uploadError) setUploadError(null);
                }}
                disabled={isUploading}
                required
                aria-required="true"
              />
              {uploadFile && (
                <p className="text-xs text-muted-foreground">
                  Selected file: {uploadFile.name}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleUploadDialogOpenChange(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isUploading || !canSubmitUpload}>
                {isUploading && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
