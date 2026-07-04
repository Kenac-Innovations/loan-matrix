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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
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
import { Progress } from "@/components/ui/progress";
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
  amount?: number | string | null;
  currency?: string | null;
  phoneNumber?: string | null;
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
  rawRow?: CsvRow | null;
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
  phoneNumber?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  paymentInternalReference?: string | null;
  paymentUserReference?: string | null;
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

function formatPaymentAmount(
  currency?: string | null,
  amount?: number | string | null
): string {
  if (amount === null || amount === undefined || amount === "") return "-";

  const numericAmount =
    typeof amount === "number" ? amount : Number.parseFloat(String(amount));
  const amountText = Number.isFinite(numericAmount)
    ? new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numericAmount)
    : String(amount);

  return [currency, amountText].filter(Boolean).join(" ") || "-";
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
  return (
    <Card aria-busy="true">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid w-full max-w-md grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            <Skeleton className="h-7 rounded-md" />
            <Skeleton className="h-7 rounded-md" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-auto max-h-[420px]">
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "",
                  "Phone",
                  "Amount",
                  "Payment Ref Number",
                  "Loan Ref",
                  "Status",
                ].map((column, columnIndex) => (
                  <TableHead key={`${column}-${columnIndex}`}>
                    {column || <span className="sr-only">Select</span>}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <PaymentConfirmationTableSkeleton columns={6} />
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
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
  const idleClasses = isDragging
    ? "border-primary bg-primary/5"
    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30";

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
        className={`flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center transition-colors ${idleClasses}`}
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
                <TableHead>Phone</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Ref Number</TableHead>
                <TableHead>Loan Ref</TableHead>
                <TableHead>Status</TableHead>
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
                    <TableCell className="whitespace-nowrap">
                      {item.phoneNumber || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatPaymentAmount(item.currency, item.amount)}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {item.paymentInternalReference || item.paymentReference}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {item.paymentUserReference || "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.paymentStatus || item.actionStatus} />
                    </TableCell>
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
  const [lookupResultsTab, setLookupResultsTab] = useState("matched");
  const [file, setFile] = useState<File | null>(null);
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<CsvRow[]>([]);
  const [allRows, setAllRows] = useState<CsvRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
  const [csvUploadAccordionValue, setCsvUploadAccordionValue] = useState<
    string[]
  >(["csv-upload"]);
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
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectProgress, setRejectProgress] = useState(0);
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
    () => lookup?.unmatched || [],
    [lookup]
  );
  const unmatchedCsvHeaders = useMemo(
    () =>
      headers.length > 0
        ? headers
        : [mapping.referenceColumn || "Payment reference"],
    [headers, mapping.referenceColumn]
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
    setCsvUploadAccordionValue(["csv-upload"]);
    setReferenceColumnDialogOpen(false);
    setLookup(null);
    setLookupResultsTab("matched");
    setSelectedConfirmRefs(new Set());
    setSelectedRejectRefs(new Set());
    setConfirmDialogOpen(false);
    setRejectDialogOpen(false);
    setRejectProgress(0);
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
          setCsvUploadAccordionValue(["csv-upload"]);
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
      setLookupResultsTab(data.matched.length > 0 ? "matched" : "unmatched");
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
      setCsvUploadAccordionValue([]);
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
      setConfirmDialogOpen(false);
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
    setRejectProgress(5);
    setError(null);
    setNotice(null);

    const items = lookup.unmatched
      .filter((item) => selectedRejectRefs.has(item.paymentReference))
      .map((item) => ({
        paymentReference: item.paymentReference,
        loanExternalId:
          item.payment?.userReferenceNumber || item.paymentReference,
        fineractLoanId: item.fineractLoanId,
        fineractClientId: item.fineractClientId,
        loanAccountNo: item.loanAccountNo,
        clientName: item.clientName,
      }));

    const totalSyntheticSteps = Math.max(items.length * 4, 1);
    let completedSyntheticSteps = 0;
    const progressTimer = window.setInterval(() => {
      completedSyntheticSteps = Math.min(
        completedSyntheticSteps + 1,
        totalSyntheticSteps - 1
      );
      setRejectProgress(
        Math.max(
          5,
          Math.round((completedSyntheticSteps / totalSyntheticSteps) * 100)
        )
      );
    }, 700);

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
      setRejectProgress(100);
      setNotice(`${data.rejectedReferences.length} loans rejected`);
      setRefreshKey((key) => key + 1);
      window.setTimeout(() => setRejectDialogOpen(false), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
      setRejectProgress(0);
    } finally {
      window.clearInterval(progressTimer);
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

        <Accordion
          type="multiple"
          value={csvUploadAccordionValue}
          onValueChange={setCsvUploadAccordionValue}
        >
          <AccordionItem
            value="csv-upload"
            className="rounded-md border bg-card text-card-foreground shadow-sm"
          >
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex min-w-0 flex-col gap-1 text-left">
                <span className="flex items-center gap-2 text-base font-semibold">
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV Upload
                </span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {file
                    ? `${file.name} - ${allRows.length} rows - ${
                        mapping.referenceColumn || "No reference column"
                      }`
                    : "Upload a CSV and select the reference column"}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-5">
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

                    <div className="overflow-auto rounded-md border max-h-[320px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            {headers.map((header) => {
                              const mappedLabel = getMappedLabel(header);
                              return (
                                <TableHead
                                  key={header}
                                  className="whitespace-nowrap"
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{header}</span>
                                    {mappedLabel && (
                                      <Badge variant="secondary">
                                        {mappedLabel}
                                      </Badge>
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
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

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
          <Tabs
            value={lookupResultsTab}
            onValueChange={setLookupResultsTab}
            className="space-y-3"
          >
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="matched" className="gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Matched
                      <Badge variant="secondary">{lookup.matched.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="unmatched" className="gap-2">
                      <Ban className="h-4 w-4" />
                      Unmatched
                      <Badge variant="outline">{lookup.unmatched.length}</Badge>
                    </TabsTrigger>
                  </TabsList>

                  {lookupResultsTab === "matched" ? (
                    <Button
                      type="button"
                      onClick={() => setConfirmDialogOpen(true)}
                      disabled={
                        confirmLoading || selectedConfirmRefs.size === 0
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {confirmLoading ? "Confirming..." : "Confirm"}
                    </Button>
                  ) : null}
                  {/*
                    Keep this action available for a future reject-loans flow.
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setRejectDialogOpen(true)}
                      disabled={rejectLoading || selectedRejectRefs.size === 0}
                    >
                      <XCircle className="h-4 w-4" />
                      {rejectLoading ? "Rejecting..." : "Reject Loans"}
                    </Button>
                  */}
                </div>
              </CardHeader>
              <CardContent>
                <TabsContent value="matched" className="m-0">
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
                          <TableHead>Phone</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Payment Ref Number</TableHead>
                          <TableHead>Loan Ref</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lookup.matched.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="h-24 text-center text-muted-foreground"
                            >
                              No matched payments
                            </TableCell>
                          </TableRow>
                        ) : (
                          lookup.matched.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedConfirmRefs.has(
                                    item.paymentReference
                                  )}
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
                              <TableCell className="whitespace-nowrap">
                                {item.payment?.phoneNumber || "-"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {formatPaymentAmount(
                                  item.payment?.currency,
                                  item.payment?.amount
                                )}
                              </TableCell>
                              <TableCell className="font-medium whitespace-nowrap">
                                {item.payment?.internalReferenceNumber ||
                                  item.paymentReference}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {item.payment?.userReferenceNumber || "-"}
                              </TableCell>
                              <TableCell>
                                <StatusBadge
                                  status={
                                    item.payment?.status || item.actionStatus
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="unmatched" className="m-0">
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
                          {unmatchedCsvHeaders.map((header, index) => (
                            <TableHead
                              key={`unmatched-csv-header-${header}-${index}`}
                              className="whitespace-nowrap"
                            >
                              {header}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lookup.unmatched.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={unmatchedCsvHeaders.length + 1}
                              className="h-24 text-center text-muted-foreground"
                            >
                              No unmatched references
                            </TableCell>
                          </TableRow>
                        ) : (
                          lookup.unmatched.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedRejectRefs.has(
                                    item.paymentReference
                                  )}
                                  onCheckedChange={(checked) =>
                                    toggleRejectRef(
                                      item.paymentReference,
                                      Boolean(checked)
                                    )
                                  }
                                  aria-label={`Select ${item.paymentReference}`}
                                />
                              </TableCell>
                              {unmatchedCsvHeaders.map((header, index) => {
                                const value =
                                  item.rawRow?.[header] ||
                                  (header === mapping.referenceColumn
                                    ? item.paymentReference
                                    : "");

                                return (
                                  <TableCell
                                    key={`${item.id}-${header}-${index}`}
                                    className="max-w-52 truncate whitespace-nowrap"
                                  >
                                    {value || "-"}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </CardContent>
            </Card>
          </Tabs>
        )}

        <Dialog
          open={confirmDialogOpen}
          onOpenChange={(open) => {
            if (!confirmLoading) setConfirmDialogOpen(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm selected payments</DialogTitle>
              <DialogDescription>
                You are about to confirm {selectedConfirmRefs.size} payment
                {selectedConfirmRefs.size === 1 ? "" : "s"}. This action is
                not reversible from this page.
              </DialogDescription>
            </DialogHeader>
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Review before continuing</AlertTitle>
              <AlertDescription>
                Only proceed after verifying the payment reference, loan ref,
                amount, phone, and status are correct.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDialogOpen(false)}
                disabled={confirmLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={confirmLoading || selectedConfirmRefs.size === 0}
              >
                <CheckCircle2 className="h-4 w-4" />
                {confirmLoading ? "Confirming..." : "Confirm Payments"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={rejectDialogOpen}
          onOpenChange={(open) => {
            if (!rejectLoading) setRejectDialogOpen(open);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject selected loans</DialogTitle>
              <DialogDescription>
                Review selected loans before continuing.
              </DialogDescription>
            </DialogHeader>
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Reject loans in Fineract</AlertTitle>
              <AlertDescription>
                You are about to reject {selectedRejectRefs.size} loan
                {selectedRejectRefs.size === 1 ? "" : "s"}. This action is
                not reversible from this page.
              </AlertDescription>
            </Alert>
            {rejectLoading && (
              <div className="space-y-2" aria-busy="true">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Rejecting selected loans
                  </span>
                  <span className="font-medium">{rejectProgress}%</span>
                </div>
                <Progress value={rejectProgress} className="h-2" />
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectDialogOpen(false)}
                disabled={rejectLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleReject}
                disabled={rejectLoading || selectedRejectRefs.size === 0}
              >
                <XCircle className="h-4 w-4" />
                {rejectLoading ? "Rejecting..." : "Reject Loans"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
