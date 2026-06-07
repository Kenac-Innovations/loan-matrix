"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadCreated: (uploadId: string) => void;
}

interface ColumnMapping {
  loanId: string;
  amount: string;
  transactionDate: string;
  loanAccountNo: string;
  clientName: string;
  accountNumber: string;
  chequeNumber: string;
  routingCode: string;
  receiptNumber: string;
  bankNumber: string;
  note: string;
}

interface PaymentType {
  id: number;
  name: string;
  description?: string;
  isCashPayment?: boolean;
}

const REQUIRED_FIELDS: (keyof ColumnMapping)[] = ["loanId", "amount"];

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  loanId: "Loan ID *",
  amount: "Amount *",
  transactionDate: "Transaction Date",
  loanAccountNo: "Loan Account No",
  clientName: "Client Name",
  accountNumber: "Account #",
  chequeNumber: "Cheque #",
  routingCode: "Routing Code",
  receiptNumber: "Receipt #",
  bankNumber: "Bank #",
  note: "Note",
};

const AUTO_DETECT_PATTERNS: Record<keyof ColumnMapping, RegExp> = {
  loanId: /^(loan[_\s-]?id|loanid|loan_resource_id)$/i,
  amount: /^(amount|transaction[_\s-]?amount|repayment[_\s-]?amount|total|payment)$/i,
  transactionDate: /^(transaction[_\s-]?date|date|payment[_\s-]?date|repayment[_\s-]?date)$/i,
  loanAccountNo: /^(loan[_\s-]?account[_\s-]?no|account[_\s-]?no|loan[_\s-]?account|account_number)$/i,
  clientName: /^(client[_\s-]?name|name|customer[_\s-]?name|borrower)$/i,
  accountNumber: /^(account[_\s-]?number|acc[_\s-]?no|bank[_\s-]?account)$/i,
  chequeNumber: /^(cheque[_\s-]?number|cheque[_\s-]?no|check[_\s-]?number)$/i,
  routingCode: /^(routing[_\s-]?code|sort[_\s-]?code|branch[_\s-]?code)$/i,
  receiptNumber: /^(receipt[_\s-]?number|receipt[_\s-]?no|receipt)$/i,
  bankNumber: /^(bank[_\s-]?number|bank[_\s-]?no|bank[_\s-]?code)$/i,
  note: /^(note|notes|memo|description|remarks)$/i,
};

type Step = "upload" | "mapping" | "uploading";

export function BulkUploadDialog({ open, onOpenChange, onUploadCreated }: BulkUploadDialogProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [selectedPaymentTypeId, setSelectedPaymentTypeId] = useState("");
  const [loadingPaymentTypes, setLoadingPaymentTypes] = useState(false);
  const [paymentTypesError, setPaymentTypesError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({
    loanId: "",
    amount: "",
    transactionDate: "",
    loanAccountNo: "",
    clientName: "",
    accountNumber: "",
    chequeNumber: "",
    routingCode: "",
    receiptNumber: "",
    bankNumber: "",
    note: "",
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setPreviewRows([]);
    setAllRows([]);
    setWarning(null);
    setSelectedPaymentTypeId("");
    setPaymentTypesError(null);
    setMapping({
      loanId: "", amount: "", transactionDate: "",
      loanAccountNo: "", clientName: "", accountNumber: "", chequeNumber: "",
      routingCode: "", receiptNumber: "", bankNumber: "", note: "",
    });
    setUploading(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const fetchPaymentTypes = async () => {
      setLoadingPaymentTypes(true);
      setPaymentTypesError(null);

      try {
        const response = await fetch("/api/fineract/paymenttypes");
        if (!response.ok) {
          throw new Error("Failed to load payment types");
        }

        const data = await response.json();
        const list: PaymentType[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.pageItems)
            ? data.pageItems
            : [];

        if (!cancelled) {
          setPaymentTypes(list);
        }
      } catch (err) {
        if (!cancelled) {
          setPaymentTypes([]);
          setPaymentTypesError(
            err instanceof Error ? err.message : "Failed to load payment types"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPaymentTypes(false);
        }
      }
    };

    fetchPaymentTypes();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setError(null);

    Papa.parse(selected, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setError("Failed to parse CSV file. Please check the file format.");
          return;
        }

        const parsedHeaders = (results.meta.fields || []).map((header) => header.trim());
        const blankHeaderCount = parsedHeaders.filter((header) => header === "").length;
        const usableHeaders = parsedHeaders.filter((header) => header !== "");
        const parsedData = (results.data as Record<string, unknown>[]).map((row) => {
          const normalizedRow: Record<string, string> = {};
          for (const [key, value] of Object.entries(row)) {
            const normalizedKey = key.trim();
            if (!normalizedKey) continue;
            normalizedRow[normalizedKey] =
              typeof value === "string" ? value : value == null ? "" : String(value);
          }
          return normalizedRow;
        });

        if (usableHeaders.length === 0) {
          setError("No usable CSV headers were found.");
          return;
        }

        setHeaders(usableHeaders);
        setPreviewRows(parsedData.slice(0, 5));
        setAllRows(parsedData);
        setWarning(
          blankHeaderCount > 0
            ? `Ignored ${blankHeaderCount} blank column${blankHeaderCount === 1 ? "" : "s"} from the CSV header row. This usually means the file has trailing commas.`
            : null
        );

        const autoMapping = { ...mapping };
        for (const [field, pattern] of Object.entries(AUTO_DETECT_PATTERNS)) {
          const match = usableHeaders.find((h) => pattern.test(h));
          if (match) {
            autoMapping[field as keyof ColumnMapping] = match;
          }
        }
        setMapping(autoMapping);
        setStep("mapping");
      },
      error: () => {
        setError("Failed to read file. Please ensure it is a valid CSV.");
      },
    });
  }, [mapping]);

  const isValid = useMemo(() => {
    return REQUIRED_FIELDS.every((f) => mapping[f] !== "") && selectedPaymentTypeId !== "";
  }, [mapping, selectedPaymentTypeId]);

  const handleUpload = async () => {
    if (!isValid || allRows.length === 0) return;

    setUploading(true);
    setStep("uploading");
    setError(null);

    try {
      const selectedPaymentType = paymentTypes.find(
        (paymentType) => paymentType.id.toString() === selectedPaymentTypeId
      );
      const paymentTypeId = parseInt(selectedPaymentTypeId, 10);
      if (!selectedPaymentType || Number.isNaN(paymentTypeId)) {
        throw new Error("Please select a valid payment type.");
      }

      const items = allRows.map((row, idx) => ({
        rowNumber: idx + 1,
        loanId: parseInt(row[mapping.loanId], 10) || 0,
        amount: parseFloat(row[mapping.amount]?.replace(/,/g, "")) || 0,
        loanAccountNo: mapping.loanAccountNo ? row[mapping.loanAccountNo] || null : null,
        clientName: mapping.clientName ? row[mapping.clientName] || null : null,
        transactionDate: mapping.transactionDate ? row[mapping.transactionDate] || null : null,
        accountNumber: mapping.accountNumber ? row[mapping.accountNumber] || null : null,
        chequeNumber: mapping.chequeNumber ? row[mapping.chequeNumber] || null : null,
        routingCode: mapping.routingCode ? row[mapping.routingCode] || null : null,
        receiptNumber: mapping.receiptNumber ? row[mapping.receiptNumber] || null : null,
        bankNumber: mapping.bankNumber ? row[mapping.bankNumber] || null : null,
        note: mapping.note ? row[mapping.note] || null : null,
        paymentTypeId,
        paymentTypeName: selectedPaymentType?.name || null,
      }));

      const response = await fetch("/api/collections/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file?.name || "upload.csv",
          columnMapping: mapping,
          items,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      onUploadCreated(result.id);
      onOpenChange(false);
      resetState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setStep("mapping");
    } finally {
      setUploading(false);
    }
  };

  const updateMapping = (field: keyof ColumnMapping, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value === "__none__" ? "" : value }));
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) resetState(); onOpenChange(val); }}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Repayment Upload
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to process multiple loan repayments at once.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {warning && !error && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {warning}
          </div>
        )}

        {step === "upload" && (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Select a CSV file with loan repayment data
            </p>
            <Input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="max-w-xs"
            />
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>
                <strong>{allRows.length}</strong> rows found in <strong>{file?.name}</strong>
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Payment Type *</label>
              <Select
                value={selectedPaymentTypeId}
                onValueChange={setSelectedPaymentTypeId}
                disabled={loadingPaymentTypes || paymentTypes.length === 0}
              >
                <SelectTrigger className="h-9 max-w-md">
                  <SelectValue
                    placeholder={
                      loadingPaymentTypes ? "Loading payment types..." : "Select payment type"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {paymentTypes.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      No payment types available
                    </div>
                  ) : (
                    paymentTypes.map((paymentType) => (
                      <SelectItem key={paymentType.id} value={paymentType.id.toString()}>
                        {paymentType.name}
                        {paymentType.isCashPayment ? " (Cash)" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {!selectedPaymentTypeId && (
                <p className="text-xs text-destructive">Required</p>
              )}
              {paymentTypesError && (
                <p className="text-xs text-destructive">{paymentTypesError}</p>
              )}
            </div>

            {/* Column mapping */}
            <div>
              <h4 className="font-medium mb-3">Map Columns</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map((field) => (
                  <div key={field} className="space-y-1">
                    <label className="text-sm font-medium">
                      {FIELD_LABELS[field]}
                    </label>
                    <Select
                      value={mapping[field] || "__none__"}
                      onValueChange={(v) => updateMapping(field, v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">-- Not mapped --</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {REQUIRED_FIELDS.includes(field) && !mapping[field] && (
                      <p className="text-xs text-destructive">Required</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Preview table */}
            <div>
              <h4 className="font-medium mb-3">
                Preview (first {previewRows.length} rows)
              </h4>
              <div className="rounded-md border overflow-auto max-h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap text-xs">#</TableHead>
                      {headers.map((h) => {
                        const mappedTo = Object.entries(mapping).find(([, v]) => v === h);
                        return (
                          <TableHead key={h} className="whitespace-nowrap text-xs">
                            {h}
                            {mappedTo && (
                              <Badge variant="secondary" className="ml-1 text-[10px]">
                                {FIELD_LABELS[mappedTo[0] as keyof ColumnMapping]?.replace(" *", "")}
                              </Badge>
                            )}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        {headers.map((h) => (
                          <TableCell key={h} className="text-xs whitespace-nowrap">
                            {row[h] || "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {step === "uploading" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
            <p className="text-sm text-muted-foreground">
              Uploading {allRows.length} repayment records...
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetState(); onOpenChange(false); }}>
            Cancel
          </Button>
          {step === "mapping" && (
            <Button onClick={handleUpload} disabled={!isValid || uploading || loadingPaymentTypes} className="bg-blue-500 hover:bg-blue-600">
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload {allRows.length} Records
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
