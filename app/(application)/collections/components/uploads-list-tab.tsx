"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
  Loader2,
  Upload,
  RefreshCw,
  Eye,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format-currency";
import { useCurrency } from "@/contexts/currency-context";
import { BulkUploadDialog } from "./bulk-upload-dialog";
import { format } from "date-fns";

interface UploadRecord {
  id: string;
  fileName: string;
  status: string;
  totalRows: number;
  queuedCount: number;
  successCount: number;
  failedCount: number;
  reversedCount: number;
  totalAmount: string;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number };
}

interface UploadsListTabProps {
  onCountChange: (count: number) => void;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  STAGING: {
    label: "Staging",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    icon: <FileSpreadsheet className="h-3 w-3" />,
  },
  PROCESSING: {
    label: "Processing",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    icon: <Clock className="h-3 w-3 animate-spin" />,
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  FAILED: {
    label: "Failed",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: <XCircle className="h-3 w-3" />,
  },
};

const POLL_INTERVAL = 10000;

export function UploadsListTab({ onCountChange }: UploadsListTabProps) {
  const router = useRouter();
  const { currencyCode } = useCurrency();
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  const fetchUploads = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const response = await fetch("/api/collections/uploads");
      if (response.ok) {
        const data = await response.json();
        setUploads(data);
        onCountChangeRef.current(data.length);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUploads();
    const interval = setInterval(() => fetchUploads(false), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchUploads]);

  const handleUploadCreated = useCallback((uploadId: string) => {
    setUploadDialogOpen(false);
    router.push(`/collections/bulk-receipting/${uploadId}`);
  }, [router]);

  const handleViewUpload = useCallback((uploadId: string) => {
    router.push(`/collections/bulk-receipting/${uploadId}`);
  }, [router]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage bulk repayment file uploads
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => fetchUploads()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button onClick={() => setUploadDialogOpen(true)} className="bg-blue-500 hover:bg-blue-600">
            <Upload className="h-4 w-4 mr-2" />
            New Upload
          </Button>
        </div>
      </div>

      {loading && uploads.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span className="text-muted-foreground">Loading uploads...</span>
        </div>
      ) : uploads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileSpreadsheet className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-1">No uploads yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload a CSV file to begin processing bulk repayments
          </p>
          <Button onClick={() => setUploadDialogOpen(true)} className="bg-blue-500 hover:bg-blue-600">
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Rows</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-center">Progress</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uploads.map((upload) => {
                const statusCfg = STATUS_CONFIG[upload.status] || STATUS_CONFIG.STAGING;
                const totalAmount = parseFloat(upload.totalAmount) || 0;
                const processed =
                  upload.successCount +
                  upload.failedCount +
                  upload.reversedCount;
                const hasProcessing = upload.status === "PROCESSING" || upload.status === "COMPLETED";

                return (
                  <TableRow
                    key={upload.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewUpload(upload.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{upload.fileName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("text-xs gap-1", statusCfg.className)}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {upload.totalRows}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totalAmount, currencyCode)}
                    </TableCell>
                    <TableCell>
                      {hasProcessing ? (
                        <div className="flex items-center justify-center gap-2 text-xs">
                          <span className="text-green-600 flex items-center gap-0.5">
                            <CheckCircle2 className="h-3 w-3" /> {upload.successCount}
                          </span>
                          <span className="text-red-600 flex items-center gap-0.5">
                            <XCircle className="h-3 w-3" /> {upload.failedCount}
                          </span>
                          {upload.reversedCount > 0 && (
                            <span className="text-amber-600 flex items-center gap-0.5">
                              <Undo2 className="h-3 w-3" /> {upload.reversedCount}
                            </span>
                          )}
                          {upload.queuedCount > 0 && (
                            <span className="text-purple-600 flex items-center gap-0.5">
                              <Clock className="h-3 w-3" /> {upload.queuedCount}
                            </span>
                          )}
                          <span className="text-muted-foreground">
                            ({processed}/{upload.totalRows})
                          </span>
                        </div>
                      ) : (
                        <div className="text-center text-xs text-muted-foreground">—</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(upload.createdAt), "dd MMM yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewUpload(upload.id);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{uploads.length} upload{uploads.length !== 1 ? "s" : ""}</span>
          <span className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Click a row to view details
          </span>
        </div>
      )}

      <BulkUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadCreated={handleUploadCreated}
      />
    </div>
  );
}
