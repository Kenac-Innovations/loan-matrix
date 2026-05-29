"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Papa from "papaparse";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, Upload, CheckCircle2, XCircle, Clock, AlertCircle, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type LoanProductOption = {
  id: number;
  name: string;
  shortName?: string;
};

type LoanProductApiRecord = {
  id?: unknown;
  name?: unknown;
  shortName?: unknown;
};

type UploadRecord = {
  id: string;
  fileName: string;
  productExternalId: string;
  productName: string;
  uploadedBy: string;
  status: string;
  totalRows: number;
  syncedRows: number;
  failedRows: number;
  syncError: string | null;
  createdAt: string;
  _count?: { items: number };
};

type ParsedItem = {
  rowNumber: number;
  name: string;
  nrc: string;
  phone: string;
};

type UploadItem = {
  id: string;
  rowNumber: number;
  name: string;
  nrc: string;
  phone: string;
  normalizedPhone: string;
  status: string;
};

type ItemsPage = {
  items: UploadItem[];
  total: number;
  page: number;
  pageSize: number;
};

const REQUIRED_HEADERS = ["name", "nrc", "phone"] as const;

const STATUS_STYLES: Record<string, string> = {
  STAGING: "bg-amber-100 text-amber-800",
  SYNCING: "bg-blue-100 text-blue-800",
  SYNCED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  PARTIAL: "bg-orange-100 text-orange-800",
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function LoanProductEligibilityManager() {
  const [products, setProducts] = useState<LoanProductOption[]>([]);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncingUploadId, setSyncingUploadId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [viewUpload, setViewUpload] = useState<UploadRecord | null>(null);
  const [recordsData, setRecordsData] = useState<ItemsPage | null>(null);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsSearch, setRecordsSearch] = useState("");
  const [loadingRecords, setLoadingRecords] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === selectedProductId) || null,
    [products, selectedProductId]
  );

  // uploads is sorted newest-first; only the latest upload per product can be resynced,
  // and only if it still has failed rows
  const syncEligibleIds = useMemo(() => {
    const seen = new Set<string>();
    const eligible = new Set<string>();
    for (const upload of uploads) {
      if (!seen.has(upload.productExternalId)) {
        seen.add(upload.productExternalId);
        if (upload.failedRows > 0) {
          eligible.add(upload.id);
        }
      }
    }
    return eligible;
  }, [uploads]);

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const response = await fetch("/api/fineract/loanproducts");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load loan products");

      const options: LoanProductOption[] = (Array.isArray(data) ? data : [])
        .map((item) => item as LoanProductApiRecord)
        .filter((item) => item.id != null && item.name != null)
        .map((item) => ({
          id: Number(item.id),
          name: String(item.name),
          shortName: item.shortName != null ? String(item.shortName) : undefined,
        }));

      setProducts(options);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to load loan products"));
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const fetchUploads = useCallback(async () => {
    setLoadingUploads(true);
    try {
      const response = await fetch("/api/loan-product-eligibility/uploads");
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load uploads");
      setUploads(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to load uploads"));
    } finally {
      setLoadingUploads(false);
    }
  }, []);

  const fetchRecords = useCallback(async (uploadId: string, page: number, search: string) => {
    setLoadingRecords(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        ...(search ? { search } : {}),
      });
      const response = await fetch(`/api/loan-product-eligibility/uploads/${uploadId}/items?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load records");
      setRecordsData(data as ItemsPage);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to load records"));
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  const openViewRecords = useCallback(
    (upload: UploadRecord) => {
      setViewUpload(upload);
      setRecordsPage(1);
      setRecordsSearch("");
      setRecordsData(null);
      void fetchRecords(upload.id, 1, "");
    },
    [fetchRecords]
  );

  const closeViewRecords = useCallback(() => {
    setViewUpload(null);
    setRecordsData(null);
    setRecordsSearch("");
    setRecordsPage(1);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, []);

  const handleRecordsSearchChange = useCallback(
    (value: string) => {
      setRecordsSearch(value);
      setRecordsPage(1);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      if (!viewUpload) return;
      searchDebounceRef.current = setTimeout(() => {
        void fetchRecords(viewUpload.id, 1, value);
      }, 350);
    },
    [fetchRecords, viewUpload]
  );

  const handleRecordsPageChange = useCallback(
    (nextPage: number) => {
      if (!viewUpload) return;
      setRecordsPage(nextPage);
      void fetchRecords(viewUpload.id, nextPage, recordsSearch);
    },
    [fetchRecords, recordsSearch, viewUpload]
  );

  useEffect(() => {
    void fetchUploads();
  }, [fetchUploads]);

  useEffect(() => {
    if (isUploadModalOpen && products.length === 0 && !loadingProducts) {
      void fetchProducts();
    }
  }, [fetchProducts, isUploadModalOpen, loadingProducts, products.length]);

  // Poll while any upload is actively syncing
  useEffect(() => {
    const hasSyncing = uploads.some((u) => u.status === "SYNCING");
    if (!hasSyncing) return;
    const timer = setInterval(() => void fetchUploads(), 4000);
    return () => clearInterval(timer);
  }, [uploads, fetchUploads]);

  const parseFile = useCallback((nextFile: File) => {
    setValidationErrors([]);
    setParsedItems([]);
    setError(null);
    setMessage(null);

    Papa.parse(nextFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = (results.meta.fields || []).map((h) => String(h));
        const headerMap = new Map<string, string>();
        for (const header of headers) {
          headerMap.set(normalizeHeader(header), header);
        }

        const missing = REQUIRED_HEADERS.filter((required) => !headerMap.has(required));
        if (missing.length > 0) {
          setValidationErrors([
            `Missing required column(s): ${missing.join(", ")}. Expected headers: name, NRC, phone`,
          ]);
          return;
        }

        const resolvedHeaders = {
          name: headerMap.get("name")!,
          nrc: headerMap.get("nrc")!,
          phone: headerMap.get("phone")!,
        };

        const data = results.data as Record<string, string>[];
        const items: ParsedItem[] = [];
        const errors: string[] = [];

        data.forEach((row, index) => {
          const rowNumber = index + 1;
          const name = (row[resolvedHeaders.name] || "").trim();
          const nrc = (row[resolvedHeaders.nrc] || "").trim();
          const phone = (row[resolvedHeaders.phone] || "").trim();

          if (!name || !nrc || !phone) {
            errors.push(`Row ${rowNumber}: name, NRC and phone are all required.`);
            return;
          }

          items.push({ rowNumber, name, nrc, phone });
        });

        if (errors.length > 0) {
          setValidationErrors(errors.slice(0, 20));
          return;
        }

        if (items.length === 0) {
          setValidationErrors(["No valid rows found in file."]);
          return;
        }

        setParsedItems(items);
      },
      error: () => {
        setValidationErrors(["Could not parse CSV file."]);
      },
    });
  }, []);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0] || null;
      setFile(nextFile);
      setParsedItems([]);
      setValidationErrors([]);
      setMessage(null);
      setError(null);
      if (nextFile) {
        parseFile(nextFile);
      }
    },
    [parseFile]
  );

  const syncUpload = useCallback(
    async (uploadId: string) => {
      setSyncingUploadId(uploadId);
      setError(null);
      setMessage(null);
      try {
        const response = await fetch(`/api/loan-product-eligibility/uploads/${uploadId}/sync`, {
          method: "POST",
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || "Sync failed");
        }
        setMessage(`Upload synced successfully (${result.syncedRows} rows).`);
        await fetchUploads();
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Sync failed"));
        await fetchUploads();
      } finally {
        setSyncingUploadId(null);
      }
    },
    [fetchUploads]
  );

  const handleUploadAndSync = useCallback(async () => {
    if (!selectedProduct || !file || parsedItems.length === 0) return;

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const createResponse = await fetch("/api/loan-product-eligibility/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          productExternalId: String(selectedProduct.id),
          productName: selectedProduct.name,
          items: parsedItems,
        }),
      });

      const createResult = await createResponse.json();
      if (!createResponse.ok) {
        throw new Error(createResult?.error || "Upload failed");
      }

      setFile(null);
      setParsedItems([]);
      setValidationErrors([]);
      setIsPreviewModalOpen(false);
      setIsUploadModalOpen(false);
      toast.success("Upload saved — syncing to USSD in the background.");
      await fetchUploads();
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Upload failed"));
    } finally {
      setUploading(false);
    }
  }, [fetchUploads, file, parsedItems, selectedProduct]);

  const openUploadModal = useCallback(() => {
    setError(null);
    setMessage(null);
    setIsPreviewModalOpen(false);
    setIsUploadModalOpen(true);
  }, []);

  const resetUploadForm = useCallback(() => {
    setFile(null);
    setParsedItems([]);
    setValidationErrors([]);
  }, []);

  const closeUploadFlow = useCallback(() => {
    setIsPreviewModalOpen(false);
    setIsUploadModalOpen(false);
    resetUploadForm();
  }, [resetUploadForm]);

  const handlePreview = useCallback(() => {
    if (!selectedProduct) {
      setError("Please select a loan product.");
      return;
    }
    if (!file) {
      setError("Please choose a CSV file.");
      return;
    }
    if (validationErrors.length > 0 || parsedItems.length === 0) {
      setError("Please fix CSV validation errors before preview.");
      return;
    }
    setError(null);
    setIsUploadModalOpen(false);
    setIsPreviewModalOpen(true);
  }, [file, parsedItems.length, selectedProduct, validationErrors.length]);

  const previewRows = parsedItems.slice(0, 5);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Loan Product Eligibility Uploads</CardTitle>
              <CardDescription>
                Upload CSV with mandatory columns: <strong>name</strong>, <strong>NRC</strong>,{" "}
                <strong>phone</strong>. New synced upload replaces previous whitelist for that product in USSD.
              </CardDescription>
            </div>
            <Button onClick={openUploadModal}>
              <Upload className="mr-2 h-4 w-4" />
              New Upload
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Dialog
        open={isUploadModalOpen}
        onOpenChange={(open) => {
          setIsUploadModalOpen(open);
          if (!open) {
            setIsPreviewModalOpen(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Eligibility CSV</DialogTitle>
            <DialogDescription>
              Select a loan product, upload your CSV, then preview before syncing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Loan Product</label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={loadingProducts ? "Loading products..." : "Select product"} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This product whitelist will be replaced by the uploaded file after sync.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">CSV File</label>
              <Input className="w-full" type="file" accept=".csv,text/csv" onChange={handleFileChange} />
              <p className="text-xs text-muted-foreground">
                Required columns: <strong>name</strong>, <strong>NRC</strong>, <strong>phone</strong>.
              </p>
            </div>

            {file && (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                File selected: <strong>{file.name}</strong>
              </div>
            )}

            {validationErrors.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 space-y-1">
                {validationErrors.map((item, index) => (
                  <p key={`${item}-${index}`}>{item}</p>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {parsedItems.length > 0 ? `${parsedItems.length} valid row(s) ready` : "No rows ready"}
              </p>
              <div className="flex w-full flex-col sm:w-auto sm:flex-row items-stretch sm:items-center gap-2">
                <Button className="w-full sm:w-auto" variant="outline" onClick={closeUploadFlow}>
                  Cancel
                </Button>
                <Button className="w-full sm:w-auto" onClick={handlePreview} disabled={!selectedProduct || parsedItems.length === 0}>
                  Preview CSV
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Upload Data</DialogTitle>
            <DialogDescription>
              Review CSV rows before syncing whitelist to USSD.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Product: <strong>{selectedProduct?.name || "-"}</strong>
              {file ? (
                <>
                  {" "}
                  | File: <strong>{file.name}</strong>
                </>
              ) : null}
            </div>

            {previewRows.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>NRC</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.nrc}</TableCell>
                        <TableCell>{row.phone}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {parsedItems.length} valid row(s) ready to upload and sync
              </p>
              <div className="flex w-full flex-col sm:w-auto sm:flex-row items-stretch sm:items-center gap-2">
                <Button
                  className="w-full sm:w-auto"
                  variant="outline"
                  onClick={() => {
                    setIsPreviewModalOpen(false);
                    setIsUploadModalOpen(true);
                  }}
                >
                  Back
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  onClick={handleUploadAndSync}
                  disabled={!selectedProduct || parsedItems.length === 0 || uploading}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewUpload} onOpenChange={(open) => { if (!open) closeViewRecords(); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Upload Records</DialogTitle>
            <DialogDescription>
              {viewUpload ? (
                <>
                  <strong>{viewUpload.productName}</strong> &mdash; {viewUpload.fileName} &mdash; uploaded{" "}
                  {format(new Date(viewUpload.createdAt), "dd MMM yyyy HH:mm")}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search by name, NRC or phone…"
              value={recordsSearch}
              onChange={(e) => handleRecordsSearchChange(e.target.value)}
            />
          </div>

          <div className="flex-1 overflow-auto rounded-md border">
            {loadingRecords ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : !recordsData || recordsData.items.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {recordsSearch ? "No records match your search." : "No records found."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>NRC</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recordsData.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{item.rowNumber}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.nrc}</TableCell>
                      <TableCell>{item.normalizedPhone || item.phone}</TableCell>
                      <TableCell>
                        <Badge className={cn("gap-1 text-xs", STATUS_STYLES[item.status] || "bg-slate-100 text-slate-800")}>
                          {item.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {recordsData && recordsData.total > 0 && (
            <div className="flex items-center justify-between gap-2 pt-1 text-sm text-muted-foreground">
              <span>
                {recordsData.total} record{recordsData.total !== 1 ? "s" : ""}
                {recordsSearch ? " matching" : ""}
                {" — page "}
                {recordsData.page} of {Math.ceil(recordsData.total / recordsData.pageSize)}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={recordsPage <= 1 || loadingRecords}
                  onClick={() => handleRecordsPageChange(recordsPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={recordsPage >= Math.ceil(recordsData.total / recordsData.pageSize) || loadingRecords}
                  onClick={() => handleRecordsPageChange(recordsPage + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {message && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Upload History</CardTitle>
              <CardDescription>Shows whether each upload has synced to USSD.</CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={() => void fetchUploads()} disabled={loadingUploads}>
              <RefreshCw className={cn("h-4 w-4", loadingUploads && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingUploads ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : uploads.length === 0 ? (
            <div className="py-8 text-sm text-muted-foreground">No uploads yet.</div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Uploaded At</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Sync Error</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploads.map((upload) => (
                    <TableRow key={upload.id}>
                      <TableCell>{format(new Date(upload.createdAt), "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell>{upload.productName}</TableCell>
                      <TableCell>{upload.fileName}</TableCell>
                      <TableCell>
                        <Badge className={cn("gap-1", STATUS_STYLES[upload.status] || "bg-slate-100 text-slate-800")}>
                          {upload.status === "SYNCED" && <CheckCircle2 className="h-3 w-3" />}
                          {upload.status === "FAILED" && <XCircle className="h-3 w-3" />}
                          {upload.status === "SYNCING" && <Loader2 className="h-3 w-3 animate-spin" />}
                          {upload.status === "STAGING" && <AlertCircle className="h-3 w-3" />}
                          {upload.status === "PARTIAL" && <AlertCircle className="h-3 w-3" />}
                          {upload.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {upload.syncedRows}/{upload.totalRows}
                      </TableCell>
                      <TableCell>{upload.uploadedBy}</TableCell>
                      <TableCell className="max-w-[280px] truncate" title={upload.syncError || ""}>
                        {upload.syncError || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openViewRecords(upload)}
                          >
                            <Eye className="h-4 w-4" />
                            <span className="ml-1">View</span>
                          </Button>
                          {syncEligibleIds.has(upload.id) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void syncUpload(upload.id)}
                              disabled={syncingUploadId === upload.id || upload.status === "SYNCING"}
                            >
                              {syncingUploadId === upload.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Sync"
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
