"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Papa from "papaparse";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Upload,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const NONE_VALUE = "__none__";
const MAX_CSV_FILE_SIZE_BYTES = 50 * 1024 * 1024;

type CsvRow = Record<string, string>;

type ColumnMapping = {
  referenceColumn: string;
};

type LookupPayment = {
  internalReferenceNumber?: string | null;
  userReferenceNumber?: string | null;
  providerReferenceNumber?: string | null;
  status?: string | null;
  callbackStatus?: string | null;
  paymentConfirmed?: boolean;
  confirmedAt?: string | null;
  canConfirm?: boolean;
};

type LookupItem = {
  id: string;
  uploadId: string;
  rowNumber?: number | null;
  paymentReference: string;
  matched: boolean;
  actionStatus: string;
  fineractLoanId?: number | null;
  fineractClientId?: number | null;
  loanAccountNo?: string | null;
  clientName?: string | null;
  createdAt?: string;
  payment?: LookupPayment | null;
};

type LookupResponse = {
  upload: {
    id: string;
    fileName: string;
    totalRows: number;
    matchedCount: number;
    unmatchedCount: number;
  };
  matched: LookupItem[];
  unmatched: LookupItem[];
};

type AuditItem = {
  id: string;
  uploadId?: string | null;
  rowNumber?: number | null;
  paymentReference: string;
  action: string;
  actionStatus: string;
  fineractLoanId?: number | null;
  fineractClientId?: number | null;
  loanAccountNo?: string | null;
  clientName?: string | null;
  paymentProviderReference?: string | null;
  paymentStatus?: string | null;
  paymentConfirmedAt?: string | null;
  actedByName?: string | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  upload?: {
    fileName: string;
    createdAt?: string | null;
  } | null;
};

type AuditPage = {
  items: AuditItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const EMPTY_MAPPING: ColumnMapping = {
  referenceColumn: "",
};

const AUTO_DETECT_PATTERNS: Record<keyof ColumnMapping, RegExp> = {
  referenceColumn:
    /^(payment[_\s-]?ref|payment[_\s-]?reference|internal[_\s-]?reference[_\s-]?number|internalreference|reference|ref)$/i,
};

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}

function normalizeCell(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Request failed");
  }
  return data as T;
}

function statusVariant(status?: string | null): "default" | "secondary" | "destructive" | "outline" {
  const normalized = String(status || "").toUpperCase();
  if (["FAILED", "ERROR"].includes(normalized)) return "destructive";
  if (["SUCCESS", "CONFIRMED", "MATCHED", "COMPLETED"].includes(normalized)) {
    return "secondary";
  }
  return "outline";
}

function StatusBadge({ status }: { status?: string | null }) {
  return (
    <Badge variant={statusVariant(status)} className="max-w-full">
      {status || "-"}
    </Badge>
  );
}

function PaymentConfirmationTableSkeleton({
  columns,
  rows = 5,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={`payment-confirmation-skeleton-row-${rowIndex}`}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <TableCell key={`payment-confirmation-skeleton-cell-${rowIndex}-${columnIndex}`}>
              <Skeleton
                className={
                  columnIndex === 0
                    ? "h-4 w-8"
                    : columnIndex % 3 === 0
                      ? "h-4 w-24"
                      : "h-4 w-32"
                }
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function LookupResultsSkeleton() {
  const tables = [
    {
      titleWidth: "w-40",
      badgeWidth: "w-10",
      columns: ["", "Reference", "Provider Ref", "Status", "Loan ID", "Client"],
    },
    {
      titleWidth: "w-44",
      badgeWidth: "w-10",
      columns: ["", "Reference", "Loan ID", "Client", "Status"],
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-2" aria-busy="true">
      {tables.map((table, index) => (
        <Card key={`lookup-results-skeleton-${index}`}>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className={`h-5 ${table.titleWidth}`} />
                <Skeleton className={`h-5 ${table.badgeWidth}`} />
              </div>
              <Skeleton className="h-9 w-28" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {table.columns.map((column, columnIndex) => (
                      <TableHead key={`${column}-${columnIndex}`}>
                        {column || <span className="sr-only">Select</span>}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <PaymentConfirmationTableSkeleton
                    columns={table.columns.length}
                  />
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CsvUploadDropzone({
  file,
  isDragging,
  onFileInputChange,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}: {
  file: File | null;
  isDragging: boolean;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDragEnter: (event: DragEvent<HTMLLabelElement>) => void;
  onDragLeave: (event: DragEvent<HTMLLabelElement>) => void;
  onDragOver: (event: DragEvent<HTMLLabelElement>) => void;
  onDrop: (event: DragEvent<HTMLLabelElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <Input
        id="payment-confirmation-file"
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={onFileInputChange}
      />
      <Label
        htmlFor="payment-confirmation-file"
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <span className="relative mb-5 inline-flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileSpreadsheet className="h-8 w-8" />
          <span className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Upload className="h-4 w-4" />
          </span>
        </span>
        <span className="text-sm font-medium text-foreground">
          {file ? file.name : "Create or import a payment confirmation CSV"}
        </span>
        {file ? (
          <span className="mt-2 text-xs text-muted-foreground">
            {formatFileSize(file.size)}
          </span>
        ) : (
          <span className="mt-2 text-xs leading-5 text-muted-foreground">
            Maximum file size: 50 MB
            <br />
            Supported format: .CSV
          </span>
        )}
      </Label>
    </div>
  );
}

function AuditTable({
  page,
  loading,
  error,
  onPageChange,
}: {
  page: AuditPage;
  loading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Loan ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <PaymentConfirmationTableSkeleton columns={7} />
              ) : page.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No records
                  </TableCell>
                </TableRow>
              ) : (
                page.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {item.paymentReference}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.actionStatus} />
                    </TableCell>
                    <TableCell>{item.fineractLoanId || "-"}</TableCell>
                    <TableCell className="min-w-40">{item.clientName || "-"}</TableCell>
                    <TableCell className="min-w-44">{item.upload?.fileName || "-"}</TableCell>
                    <TableCell>{item.actedByName || "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(item.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {page.total} records
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page.page - 1)}
              disabled={loading || page.page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page.page} / {page.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page.page + 1)}
              disabled={loading || page.page >= page.totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PaymentConfirmationClient() {
  const [activeTab, setActiveTab] = useState("upload");
  const [file, setFile] = useState<File | null>(null);
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<CsvRow[]>([]);
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [referenceColumnDialogOpen, setReferenceColumnDialogOpen] =
    useState(false);
  const [lookup, setLookup] = useState<LookupResponse | null>(null);
  const [selectedConfirmRefs, setSelectedConfirmRefs] = useState<Set<string>>(new Set());
  const [selectedRejectRefs, setSelectedRejectRefs] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [confirmedPageNumber, setConfirmedPageNumber] = useState(1);
  const [confirmedPage, setConfirmedPage] = useState<AuditPage>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  });
  const [confirmedLoading, setConfirmedLoading] = useState(false);
  const [confirmedError, setConfirmedError] = useState<string | null>(null);

  const [unconfirmedPageNumber, setUnconfirmedPageNumber] = useState(1);
  const [unconfirmedPage, setUnconfirmedPage] = useState<AuditPage>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  });
  const [unconfirmedLoading, setUnconfirmedLoading] = useState(false);
  const [unconfirmedError, setUnconfirmedError] = useState<string | null>(null);

  const confirmableMatched = useMemo(
    () => lookup?.matched.filter((item) => item.payment?.canConfirm) || [],
    [lookup]
  );
  const rejectableUnmatched = useMemo(
    () => lookup?.unmatched.filter((item) => Boolean(item.fineractLoanId)) || [],
    [lookup]
  );

  const loadConfirmed = useCallback(async () => {
    setConfirmedLoading(true);
    setConfirmedError(null);
    try {
      const response = await fetch(
        `/api/leads/payment-confirmation/confirmed?page=${confirmedPageNumber}&pageSize=20`,
        { cache: "no-store" }
      );
      const data = await readJsonResponse<AuditPage>(response);
      setConfirmedPage(data);
    } catch (err) {
      setConfirmedError(err instanceof Error ? err.message : "Failed to load records");
    } finally {
      setConfirmedLoading(false);
    }
  }, [confirmedPageNumber]);

  const loadUnconfirmed = useCallback(async () => {
    setUnconfirmedLoading(true);
    setUnconfirmedError(null);
    try {
      const response = await fetch(
        `/api/leads/payment-confirmation/unconfirmed?page=${unconfirmedPageNumber}&pageSize=20`,
        { cache: "no-store" }
      );
      const data = await readJsonResponse<AuditPage>(response);
      setUnconfirmedPage(data);
    } catch (err) {
      setUnconfirmedError(err instanceof Error ? err.message : "Failed to load records");
    } finally {
      setUnconfirmedLoading(false);
    }
  }, [unconfirmedPageNumber]);

  useEffect(() => {
    if (activeTab !== "confirmed") return;
    const timeout = window.setTimeout(() => {
      void loadConfirmed();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [activeTab, loadConfirmed, refreshKey]);

  useEffect(() => {
    if (activeTab !== "unconfirmed") return;
    const timeout = window.setTimeout(() => {
      void loadUnconfirmed();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [activeTab, loadUnconfirmed, refreshKey]);

  const resetUploadState = useCallback(() => {
    setHeaders([]);
    setPreviewRows([]);
    setAllRows([]);
    setMapping(EMPTY_MAPPING);
    setReferenceColumnDialogOpen(false);
    setLookup(null);
    setSelectedConfirmRefs(new Set());
    setSelectedRejectRefs(new Set());
    setError(null);
    setNotice(null);
  }, []);

  const processCsvFile = useCallback(
    (selected: File | null) => {
      resetUploadState();

      if (!selected) {
        setFile(null);
        return;
      }

      const isCsvFile = selected.name.toLowerCase().endsWith(".csv");

      if (!isCsvFile) {
        setFile(null);
        setError("Choose a CSV file");
        return;
      }

      if (selected.size > MAX_CSV_FILE_SIZE_BYTES) {
        setFile(null);
        setError("CSV file must be 50 MB or smaller");
        return;
      }

      setFile(selected);

      Papa.parse(selected, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0 && results.data.length === 0) {
            setError("Failed to parse CSV file");
            return;
          }

          const parsedHeaders = (results.meta.fields || []).map((header) =>
            header.trim()
          );
          const usableHeaders = parsedHeaders.filter(Boolean);
          const parsedRows = (results.data as Record<string, unknown>[]).map(
            (row) => {
              const normalizedRow: CsvRow = {};
              for (const [key, value] of Object.entries(row)) {
                const normalizedKey = key.trim();
                if (!normalizedKey) continue;
                normalizedRow[normalizedKey] = normalizeCell(value);
              }
              return normalizedRow;
            }
          );

          if (usableHeaders.length === 0) {
            setError("No CSV headers were found");
            return;
          }

          const autoMapping = { ...EMPTY_MAPPING };
          for (const [field, pattern] of Object.entries(AUTO_DETECT_PATTERNS)) {
            const match = usableHeaders.find((header) => pattern.test(header));
            if (match) {
              autoMapping[field as keyof ColumnMapping] = match;
            }
          }

          setHeaders(usableHeaders);
          setPreviewRows(parsedRows.slice(0, 5));
          setAllRows(parsedRows);
          setMapping(autoMapping);
          setReferenceColumnDialogOpen(true);
        },
        error: () => {
          setError("Failed to read CSV file");
        },
      });
    },
    [resetUploadState]
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      processCsvFile(event.target.files?.[0] || null);
    },
    [processCsvFile]
  );

  const handleUploadDragEnter = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDraggingUpload(true);
    },
    []
  );

  const handleUploadDragLeave = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDraggingUpload(false);
    },
    []
  );

  const handleUploadDragOver = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDraggingUpload(true);
    },
    []
  );

  const handleUploadDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDraggingUpload(false);
      processCsvFile(event.dataTransfer.files?.[0] || null);
    },
    [processCsvFile]
  );

  const updateReferenceColumn = (value: string) => {
    setMapping({
      referenceColumn: value === NONE_VALUE ? "" : value,
    });
  };

  const getMappedLabel = (header: string) => {
    return mapping.referenceColumn === header ? "Payment reference" : null;
  };

  const handleOpenReferenceColumnDialog = () => {
    if (!file || allRows.length === 0) {
      setError("Choose a CSV file");
      return;
    }

    setError(null);
    setReferenceColumnDialogOpen(true);
  };

  const handleLookup = async () => {
    setError(null);
    setNotice(null);

    if (!file || allRows.length === 0) {
      setError("Choose a CSV file");
      return;
    }

    if (!mapping.referenceColumn) {
      setError("Select the reference column");
      return;
    }

    const rows = allRows.map((row, index) => ({
      rowNumber: index + 1,
      paymentReference: row[mapping.referenceColumn] || "",
      rawRow: row,
    }));

    setLookupLoading(true);
    try {
      const response = await fetch("/api/leads/payment-confirmation/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          columnMapping: { referenceColumn: mapping.referenceColumn },
          rows,
        }),
      });
      const data = await readJsonResponse<LookupResponse>(response);
      setLookup(data);
      setSelectedConfirmRefs(
        new Set(
          data.matched
            .filter((item) => item.payment?.canConfirm)
            .map((item) => item.paymentReference)
        )
      );
      setSelectedRejectRefs(
        new Set(
          data.unmatched
            .filter((item) => Boolean(item.fineractLoanId))
            .map((item) => item.paymentReference)
        )
      );
      setNotice(
        `${data.upload.matchedCount} matched, ${data.upload.unmatchedCount} unmatched`
      );
      setReferenceColumnDialogOpen(false);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setLookup(null);
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  };

  const toggleConfirmRef = (reference: string, checked: boolean) => {
    setSelectedConfirmRefs((current) => {
      const next = new Set(current);
      if (checked) next.add(reference);
      else next.delete(reference);
      return next;
    });
  };

  const toggleRejectRef = (reference: string, checked: boolean) => {
    setSelectedRejectRefs((current) => {
      const next = new Set(current);
      if (checked) next.add(reference);
      else next.delete(reference);
      return next;
    });
  };

  const toggleAllConfirmable = (checked: boolean) => {
    setSelectedConfirmRefs((current) => {
      const next = new Set(current);
      for (const item of confirmableMatched) {
        if (checked) next.add(item.paymentReference);
        else next.delete(item.paymentReference);
      }
      return next;
    });
  };

  const toggleAllRejectable = (checked: boolean) => {
    setSelectedRejectRefs((current) => {
      const next = new Set(current);
      for (const item of rejectableUnmatched) {
        if (checked) next.add(item.paymentReference);
        else next.delete(item.paymentReference);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!lookup || selectedConfirmRefs.size === 0) return;

    setConfirmLoading(true);
    setError(null);
    setNotice(null);

    const paymentReferences = Array.from(selectedConfirmRefs);
    try {
      const response = await fetch("/api/leads/payment-confirmation/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: lookup.upload.id,
          paymentReferences,
        }),
      });
      const data = await readJsonResponse<{
        confirmedPaymentReferences: string[];
        failedPaymentReferences: string[];
        confirmedAt?: string;
      }>(response);
      const confirmedSet = new Set(data.confirmedPaymentReferences);

      setLookup((current) =>
        current
          ? {
              ...current,
              matched: current.matched.map((item) =>
                confirmedSet.has(item.paymentReference)
                  ? {
                      ...item,
                      actionStatus: "CONFIRMED",
                      payment: item.payment
                        ? {
                            ...item.payment,
                            paymentConfirmed: true,
                            canConfirm: false,
                            confirmedAt: data.confirmedAt || null,
                          }
                        : item.payment,
                    }
                  : item
              ),
            }
          : current
      );
      setSelectedConfirmRefs(new Set());
      setNotice(`${data.confirmedPaymentReferences.length} payments confirmed`);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleReject = async () => {
    if (!lookup || selectedRejectRefs.size === 0) return;

    setRejectLoading(true);
    setError(null);
    setNotice(null);

    const items = lookup.unmatched
      .filter((item) => selectedRejectRefs.has(item.paymentReference))
      .map((item) => ({
        paymentReference: item.paymentReference,
        fineractLoanId: item.fineractLoanId,
        fineractClientId: item.fineractClientId,
        loanAccountNo: item.loanAccountNo,
        clientName: item.clientName,
      }));

    try {
      const response = await fetch("/api/leads/payment-confirmation/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: lookup.upload.id,
          items,
        }),
      });
      const data = await readJsonResponse<{
        rejectedReferences: string[];
        failedReferences: string[];
      }>(response);
      const rejectedSet = new Set(data.rejectedReferences);
      const failedSet = new Set(data.failedReferences);

      setLookup((current) =>
        current
          ? {
              ...current,
              unmatched: current.unmatched.map((item) =>
                rejectedSet.has(item.paymentReference)
                  ? { ...item, actionStatus: "REJECTED" }
                  : failedSet.has(item.paymentReference)
                    ? { ...item, actionStatus: "FAILED" }
                    : item
              ),
            }
          : current
      );
      setSelectedRejectRefs(new Set());
      setNotice(`${data.rejectedReferences.length} loans rejected`);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setRejectLoading(false);
    }
  };

  const allConfirmableSelected =
    confirmableMatched.length > 0 &&
    confirmableMatched.every((item) =>
      selectedConfirmRefs.has(item.paymentReference)
    );
  const allRejectableSelected =
    rejectableUnmatched.length > 0 &&
    rejectableUnmatched.every((item) =>
      selectedRejectRefs.has(item.paymentReference)
    );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList className="grid w-full max-w-3xl grid-cols-3">
        <TabsTrigger value="upload">Upload</TabsTrigger>
        <TabsTrigger value="confirmed">Confirmed Payments</TabsTrigger>
        <TabsTrigger value="unconfirmed">Unconfirmed Payments</TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Done</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-4 w-4" />
              CSV Upload
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <CsvUploadDropzone
              file={file}
              isDragging={isDraggingUpload}
              onFileInputChange={handleFileChange}
              onDragEnter={handleUploadDragEnter}
              onDragLeave={handleUploadDragLeave}
              onDragOver={handleUploadDragOver}
              onDrop={handleUploadDrop}
            />

            {allRows.length > 0 && (
              <>
                <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      Payment reference column
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {mapping.referenceColumn
                        ? mapping.referenceColumn
                        : "No column selected yet"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleOpenReferenceColumnDialog}
                    disabled={lookupLoading}
                  >
                    <Search className="h-4 w-4" />
                    {mapping.referenceColumn ? "Change column" : "Select column"}
                  </Button>
                </div>

                <div className="rounded-md border overflow-auto max-h-[320px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        {headers.map((header) => {
                          const mappedLabel = getMappedLabel(header);
                          return (
                            <TableHead key={header} className="whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span>{header}</span>
                                {mappedLabel && (
                                  <Badge variant="secondary">{mappedLabel}</Badge>
                                )}
                              </div>
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          {headers.map((header) => (
                            <TableCell
                              key={header}
                              className="max-w-52 truncate whitespace-nowrap"
                            >
                              {row[header] || "-"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={referenceColumnDialogOpen}
          onOpenChange={(open) => {
            if (!lookupLoading) setReferenceColumnDialogOpen(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select payment reference column</DialogTitle>
              <DialogDescription>
                Choose the CSV column that contains the payment references to
                lookup.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment-reference-column">
                  Payment reference column
                </Label>
                <Select
                  value={mapping.referenceColumn || NONE_VALUE}
                  onValueChange={updateReferenceColumn}
                >
                  <SelectTrigger id="payment-reference-column">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Select column</SelectItem>
                    {headers.map((header) => (
                      <SelectItem key={header} value={header}>
                        {header}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {mapping.referenceColumn && (
                <div className="rounded-md border bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Sample values
                  </p>
                  <div className="mt-2 space-y-1">
                    {previewRows.slice(0, 3).map((row, index) => (
                      <p
                        key={`${mapping.referenceColumn}-sample-${index}`}
                        className="truncate text-sm"
                      >
                        {row[mapping.referenceColumn] || "-"}
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
                onClick={() => setReferenceColumnDialogOpen(false)}
                disabled={lookupLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleLookup}
                disabled={lookupLoading || !mapping.referenceColumn}
              >
                <Search className="h-4 w-4" />
                {lookupLoading ? "Looking up..." : "Lookup"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {lookupLoading ? (
          <LookupResultsSkeleton />
        ) : lookup && (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle2 className="h-4 w-4" />
                    Matched Payments
                    <Badge variant="secondary">{lookup.matched.length}</Badge>
                  </CardTitle>
                  <Button
                    type="button"
                    onClick={handleConfirm}
                    disabled={confirmLoading || selectedConfirmRefs.size === 0}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {confirmLoading ? "Confirming..." : "Confirm"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-auto max-h-[420px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allConfirmableSelected}
                            onCheckedChange={(checked) =>
                              toggleAllConfirmable(Boolean(checked))
                            }
                            aria-label="Select all confirmable payments"
                          />
                        </TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Provider Ref</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Loan ID</TableHead>
                        <TableHead>Client</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lookup.matched.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            No matched payments
                          </TableCell>
                        </TableRow>
                      ) : (
                        lookup.matched.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedConfirmRefs.has(item.paymentReference)}
                                disabled={!item.payment?.canConfirm}
                                onCheckedChange={(checked) =>
                                  toggleConfirmRef(
                                    item.paymentReference,
                                    Boolean(checked)
                                  )
                                }
                                aria-label={`Select ${item.paymentReference}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium whitespace-nowrap">
                              {item.paymentReference}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {item.payment?.providerReferenceNumber || "-"}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={item.actionStatus} />
                            </TableCell>
                            <TableCell>{item.fineractLoanId || "-"}</TableCell>
                            <TableCell className="min-w-40">{item.clientName || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Ban className="h-4 w-4" />
                    Unmatched References
                    <Badge variant="outline">{lookup.unmatched.length}</Badge>
                  </CardTitle>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleReject}
                    disabled={rejectLoading || selectedRejectRefs.size === 0}
                  >
                    <XCircle className="h-4 w-4" />
                    {rejectLoading ? "Rejecting..." : "Reject Loans"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-auto max-h-[420px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allRejectableSelected}
                            onCheckedChange={(checked) =>
                              toggleAllRejectable(Boolean(checked))
                            }
                            aria-label="Select all rejectable loans"
                          />
                        </TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Loan ID</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lookup.unmatched.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            No unmatched references
                          </TableCell>
                        </TableRow>
                      ) : (
                        lookup.unmatched.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedRejectRefs.has(item.paymentReference)}
                                disabled={!item.fineractLoanId}
                                onCheckedChange={(checked) =>
                                  toggleRejectRef(
                                    item.paymentReference,
                                    Boolean(checked)
                                  )
                                }
                                aria-label={`Select ${item.paymentReference}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium whitespace-nowrap">
                              {item.paymentReference}
                            </TableCell>
                            <TableCell>
                              {item.fineractLoanId || (
                                <Badge variant="outline">Missing loan ID</Badge>
                              )}
                            </TableCell>
                            <TableCell className="min-w-40">{item.clientName || "-"}</TableCell>
                            <TableCell>
                              <StatusBadge status={item.actionStatus} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </TabsContent>

      <TabsContent value="confirmed">
        <div className="mb-3 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={loadConfirmed}
            disabled={confirmedLoading}
            aria-label="Refresh confirmed payments"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <AuditTable
          page={confirmedPage}
          loading={confirmedLoading}
          error={confirmedError}
          onPageChange={setConfirmedPageNumber}
        />
      </TabsContent>

      <TabsContent value="unconfirmed">
        <div className="mb-3 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUnconfirmed}
            disabled={unconfirmedLoading}
            aria-label="Refresh unconfirmed payments"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <AuditTable
          page={unconfirmedPage}
          loading={unconfirmedLoading}
          error={unconfirmedError}
          onPageChange={setUnconfirmedPageNumber}
        />
      </TabsContent>
    </Tabs>
  );
}
