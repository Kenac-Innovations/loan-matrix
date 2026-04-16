"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrency } from "@/contexts/currency-context";
import { useToast } from "@/hooks/use-toast";

type InvoiceStatus = "APPROVED" | "PENDING" | "VERIFIED" | "REJECTED" | "FINANCED";

interface InvoiceRowForm {
  id?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  grossAmount: string;
  currencyCode: string;
  fineractDocumentId?: string;
  documentFile?: File | null;
}

interface InvoiceDiscountingFormProps {
  leadId?: string;
  onBack: () => void;
  onNext: () => void;
  onComplete?: () => void;
  onRegisterSave?: (saveFn: (() => Promise<boolean>) | null) => void;
  /** When true, hides Previous/Next navigation buttons and shows a standalone Save button */
  embedded?: boolean;
}

interface InvoiceDiscountingCaseResponse {
  debtorName: string;
  debtorRegistrationNumber?: string | null;
  debtorTaxId?: string | null;
  debtorContactName?: string | null;
  debtorContactPhone?: string | null;
  debtorContactEmail?: string | null;
  advanceRate: number;
  debtorTermsDays?: number | null;
  notes?: string | null;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    grossAmount: number;
    eligibleAmount?: number | null;
    financedAmount: number;
    reserveAmount: number;
    currencyCode?: string | null;
    status: InvoiceStatus;
    fineractDocumentId?: string | null;
  }>;
}

const defaultInvoiceRow = (currencyCode: string): InvoiceRowForm => ({
  invoiceNumber: "",
  invoiceDate: "",
  dueDate: "",
  grossAmount: "",
  currencyCode,
  fineractDocumentId: "",
  documentFile: null,
});

function toDateInput(value?: string | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function InvoiceDiscountingFormSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-full max-w-md" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`invoice-field-skeleton-${index}`} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-9 w-28" />
          </div>

          <div className="rounded-md border">
            <div className="border-b px-4 py-3">
              <div className="grid grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton
                    key={`invoice-header-skeleton-${index}`}
                    className="h-4 w-full"
                  />
                ))}
              </div>
            </div>
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, rowIndex) => (
                <div
                  key={`invoice-row-skeleton-${rowIndex}`}
                  className="grid grid-cols-1 gap-3 md:grid-cols-6"
                >
                  {Array.from({ length: 6 }).map((_, colIndex) => (
                    <Skeleton
                      key={`invoice-cell-skeleton-${rowIndex}-${colIndex}`}
                      className="h-10 w-full"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`invoice-total-skeleton-${index}`}
              className="space-y-2 rounded-md border p-4"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-32" />
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </CardFooter>
    </Card>
  );
}

export function InvoiceDiscountingForm({
  leadId,
  onBack,
  onNext,
  onComplete,
  onRegisterSave,
  embedded = false,
}: InvoiceDiscountingFormProps) {
  const { currencyCode, currencySymbol } = useCurrency();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fineractClientId, setFineractClientId] = useState<number | null>(null);

  const [debtorName, setDebtorName] = useState("");
  const [debtorRegistrationNumber, setDebtorRegistrationNumber] = useState("");
  const [debtorTaxId, setDebtorTaxId] = useState("");
  const [debtorContactName, setDebtorContactName] = useState("");
  const [debtorContactPhone, setDebtorContactPhone] = useState("");
  const [debtorContactEmail, setDebtorContactEmail] = useState("");
  const [advanceRate, setAdvanceRate] = useState("70");
  const [debtorTermsDays, setDebtorTermsDays] = useState("");
  const [notes, setNotes] = useState("");
  const [invoices, setInvoices] = useState<InvoiceRowForm[]>([
    defaultInvoiceRow(currencyCode),
  ]);

  useEffect(() => {
    const fetchData = async () => {
      if (!leadId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const [invoiceResponse, leadResponse] = await Promise.all([
          fetch(`/api/leads/${leadId}/invoice-discounting`),
          fetch(`/api/leads/${leadId}`),
        ]);

        if (leadResponse.ok) {
          const leadData = await leadResponse.json();
          setFineractClientId(
            leadData?.fineractClientId != null ? Number(leadData.fineractClientId) : null
          );
        }

        if (!invoiceResponse.ok) {
          const body = await invoiceResponse.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load invoice discounting data");
        }

        const result = await invoiceResponse.json();
        const data: InvoiceDiscountingCaseResponse | null = result.data;
        if (!data) {
          setInvoices([defaultInvoiceRow(currencyCode)]);
          return;
        }

        setDebtorName(data.debtorName || "");
        setDebtorRegistrationNumber(data.debtorRegistrationNumber || "");
        setDebtorTaxId(data.debtorTaxId || "");
        setDebtorContactName(data.debtorContactName || "");
        setDebtorContactPhone(data.debtorContactPhone || "");
        setDebtorContactEmail(data.debtorContactEmail || "");
        setAdvanceRate(`${data.advanceRate ?? 0}`);
        setDebtorTermsDays(data.debtorTermsDays == null ? "" : `${data.debtorTermsDays}`);
        setNotes(data.notes || "");
        setInvoices(
          data.invoices.length > 0
            ? data.invoices.map((row) => ({
                id: row.id,
                invoiceNumber: row.invoiceNumber,
                invoiceDate: toDateInput(row.invoiceDate),
                dueDate: toDateInput(row.dueDate),
                grossAmount: `${row.grossAmount}`,
                currencyCode: row.currencyCode || currencyCode,
                fineractDocumentId: row.fineractDocumentId || "",
                documentFile: null,
              }))
            : [defaultInvoiceRow(currencyCode)]
        );
      } catch (err) {
        console.error("Error loading invoice discounting data:", err);
        const message = err instanceof Error ? err.message : "Failed to load data";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [leadId, currencyCode]);

  const advanceRateNumber = useMemo(() => {
    const parsed = Number(advanceRate);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(parsed, 100));
  }, [advanceRate]);

  const derivedRows = useMemo(() => {
    return invoices.map((row) => {
      const gross = Number(row.grossAmount) || 0;
      const financed = round2((gross * advanceRateNumber) / 100);
      const reserve = round2(gross - financed);
      return {
        gross,
        financed,
        reserve,
      };
    });
  }, [invoices, advanceRateNumber]);

  const totals = useMemo(() => {
    return derivedRows.reduce(
      (acc, row) => {
        acc.gross += row.gross;
        acc.financed += row.financed;
        acc.reserve += row.reserve;
        return acc;
      },
      { gross: 0, financed: 0, reserve: 0 }
    );
  }, [derivedRows]);

  const updateInvoice = (index: number, key: keyof InvoiceRowForm, value: string) => {
    setInvoices((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    );
  };

  const updateInvoiceFile = (index: number, file: File | null) => {
    setInvoices((prev) =>
      prev.map((row, i) => (i === index ? { ...row, documentFile: file } : row))
    );
  };

  const addInvoice = () => {
    setInvoices((prev) => [...prev, defaultInvoiceRow(currencyCode)]);
  };

  const removeInvoice = (index: number) => {
    setInvoices((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const saveInvoiceDetails = async (shouldAdvance = true): Promise<boolean> => {
    if (!leadId) {
      toast({
        title: "Missing lead",
        description: "Please complete lead setup first.",
        variant: "destructive",
      });
      return false;
    }

    if (!debtorName.trim()) {
      toast({
        title: "Validation error",
        description: "Debtor name is required.",
        variant: "destructive",
      });
      return false;
    }

    if (advanceRate.trim() === "") {
      toast({
        title: "Validation error",
        description: "Advance rate is required.",
        variant: "destructive",
      });
      return false;
    }

    const hasInvalidInvoice = invoices.some(
      (row) =>
        !row.invoiceNumber.trim() ||
        !row.invoiceDate ||
        !row.dueDate ||
        (!row.documentFile && !row.fineractDocumentId) ||
        Number(row.grossAmount) <= 0
    );
    if (hasInvalidInvoice) {
      toast({
        title: "Validation error",
        description: "Each invoice must include number, dates, file, and gross amount.",
        variant: "destructive",
      });
      return false;
    }

    if (invoices.some((row) => !!row.documentFile) && !fineractClientId) {
      toast({
        title: "Missing client",
        description: "Cannot upload invoice files until the lead has a linked Fineract client.",
        variant: "destructive",
      });
      return false;
    }

    try {
      setIsSaving(true);
      setError(null);

      const rowsWithDocumentIds = await Promise.all(
        invoices.map(async (row, index) => {
          if (!row.documentFile) {
            return row;
          }

          const invoiceKey = row.invoiceNumber.trim() || `ROW_${index + 1}`;
          const uploadFormData = new FormData();
          uploadFormData.append(
            "name",
            `INVOICE_${invoiceKey}_${row.documentFile.name}`
          );
          uploadFormData.append(
            "description",
            `Invoice discounting document for invoice ${invoiceKey}`
          );
          uploadFormData.append("file", row.documentFile);

          const uploadResponse = await fetch(
            `/api/fineract/clients/${fineractClientId}/documents`,
            {
              method: "POST",
              body: uploadFormData,
            }
          );

          if (!uploadResponse.ok) {
            const uploadErrorBody = await uploadResponse.json().catch(() => ({}));
            throw new Error(
              uploadErrorBody.error ||
                uploadErrorBody.defaultUserMessage ||
                `Failed to upload document for invoice ${invoiceKey}`
            );
          }

          const uploadResult = await uploadResponse.json();
          const documentId =
            uploadResult?.resourceId ??
            uploadResult?.documentId ??
            uploadResult?.id;
          if (!documentId) {
            throw new Error(
              `Invoice file uploaded for ${invoiceKey} but no document ID was returned.`
            );
          }

          return {
            ...row,
            fineractDocumentId: String(documentId),
            documentFile: null,
          };
        })
      );

      const payload = {
        debtorName: debtorName.trim(),
        debtorRegistrationNumber: debtorRegistrationNumber || undefined,
        debtorTaxId: debtorTaxId || undefined,
        debtorContactName: debtorContactName || undefined,
        debtorContactPhone: debtorContactPhone || undefined,
        debtorContactEmail: debtorContactEmail || undefined,
        advanceRate: advanceRateNumber,
        debtorTermsDays: debtorTermsDays === "" ? undefined : Number(debtorTermsDays),
        notes: notes || undefined,
        invoices: rowsWithDocumentIds.map((row) => ({
          id: row.id,
          invoiceNumber: row.invoiceNumber.trim(),
          invoiceDate: row.invoiceDate,
          dueDate: row.dueDate,
          grossAmount: Number(row.grossAmount),
          currencyCode: row.currencyCode || currencyCode,
          fineractDocumentId: row.fineractDocumentId || undefined,
        })),
      };

      const response = await fetch(`/api/leads/${leadId}/invoice-discounting`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save invoice discounting data");
      }

      const result = await response.json();
      if (result?.data?.invoices) {
        setInvoices(
          result.data.invoices.map(
            (row: InvoiceDiscountingCaseResponse["invoices"][number]) => ({
            id: row.id,
            invoiceNumber: row.invoiceNumber,
            invoiceDate: toDateInput(row.invoiceDate),
            dueDate: toDateInput(row.dueDate),
            grossAmount: `${row.grossAmount}`,
            currencyCode: row.currencyCode || currencyCode,
            fineractDocumentId: row.fineractDocumentId || "",
            documentFile: null,
          })
          )
        );
      }

      toast({
        title: "Saved",
        description: "Invoice discounting details were saved successfully.",
      });

      if (onComplete) {
        onComplete();
      }
      if (shouldAdvance) {
        onNext();
      }
      return true;
    } catch (err) {
      console.error("Error saving invoice discounting data:", err);
      const message = err instanceof Error ? err.message : "Failed to save data";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!onRegisterSave) return;

    onRegisterSave(() => saveInvoiceDetails(false));

    return () => {
      onRegisterSave(null);
    };
  }, [
    advanceRate,
    currencyCode,
    debtorContactEmail,
    debtorContactName,
    debtorContactPhone,
    debtorName,
    debtorRegistrationNumber,
    debtorTaxId,
    debtorTermsDays,
    fineractClientId,
    invoices,
    leadId,
    notes,
    onRegisterSave,
  ]);

  const handleSaveAndNext = async () => {
    await saveInvoiceDetails(true);
  };

  if (isLoading) {
    return <InvoiceDiscountingFormSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Discounting</CardTitle>
        <CardDescription>
          Capture debtor and invoice details. Financed amounts are derived from the advance rate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="debtorName">
              Debtor Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="debtorName"
              value={debtorName}
              onChange={(e) => setDebtorName(e.target.value)}
              placeholder="Enter debtor legal name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="debtorRegistrationNumber">Debtor Registration Number</Label>
            <Input
              id="debtorRegistrationNumber"
              value={debtorRegistrationNumber}
              onChange={(e) => setDebtorRegistrationNumber(e.target.value)}
              placeholder="Registration number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="debtorTaxId">Debtor Tax ID</Label>
            <Input
              id="debtorTaxId"
              value={debtorTaxId}
              onChange={(e) => setDebtorTaxId(e.target.value)}
              placeholder="Tax ID"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="advanceRate">
              Advance Rate (%) <span className="text-red-500">*</span>
            </Label>
            <Input
              id="advanceRate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              required
              value={advanceRate}
              onChange={(e) => setAdvanceRate(e.target.value)}
              placeholder="e.g. 70"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="debtorTermsDays">Debtor Terms (Days)</Label>
            <Input
              id="debtorTermsDays"
              type="number"
              min={0}
              value={debtorTermsDays}
              onChange={(e) => setDebtorTermsDays(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="debtorContactName">Debtor Contact Name</Label>
            <Input
              id="debtorContactName"
              value={debtorContactName}
              onChange={(e) => setDebtorContactName(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="debtorContactPhone">Debtor Contact Phone</Label>
            <Input
              id="debtorContactPhone"
              value={debtorContactPhone}
              onChange={(e) => setDebtorContactPhone(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="debtorContactEmail">Debtor Contact Email</Label>
            <Input
              id="debtorContactEmail"
              type="email"
              value={debtorContactEmail}
              onChange={(e) => setDebtorContactEmail(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Invoices</h3>
            <Button type="button" variant="outline" size="sm" onClick={addInvoice}>
              <Plus className="mr-1 h-4 w-4" />
              Add Invoice
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    Invoice # <span className="text-red-500">*</span>
                  </TableHead>
                  <TableHead>
                    Invoice Date <span className="text-red-500">*</span>
                  </TableHead>
                  <TableHead>
                    Due Date <span className="text-red-500">*</span>
                  </TableHead>
                  <TableHead>
                    File <span className="text-red-500">*</span>
                  </TableHead>
                  <TableHead>
                    Gross <span className="text-red-500">*</span>
                  </TableHead>
                  <TableHead>Financed</TableHead>
                  <TableHead className="w-[60px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((row, index) => {
                  const derived = derivedRows[index];
                  return (
                    <TableRow key={row.id || `invoice-row-${index}`}>
                      <TableCell>
                        <Input
                          value={row.invoiceNumber}
                          required
                          onChange={(e) => updateInvoice(index, "invoiceNumber", e.target.value)}
                          placeholder="INV-001"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          required
                          value={row.invoiceDate}
                          onChange={(e) => updateInvoice(index, "invoiceDate", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          required
                          value={row.dueDate}
                          onChange={(e) => updateInvoice(index, "dueDate", e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="min-w-[210px]">
                        <div className="space-y-2">
                          <Input
                            type="file"
                            required={!row.fineractDocumentId}
                            accept="image/*,.pdf"
                            onChange={(e) =>
                              updateInvoiceFile(index, e.target.files?.[0] || null)
                            }
                          />
                          {row.fineractDocumentId && fineractClientId ? (
                            <a
                              className="inline-flex items-center text-xs text-blue-600 hover:underline"
                              href={`/api/fineract/clients/${fineractClientId}/documents/${row.fineractDocumentId}/attachment`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View Uploaded File
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          required
                          value={row.grossAmount}
                          onChange={(e) => updateInvoice(index, "grossAmount", e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {currencySymbol}
                        {round2(derived?.financed || 0).toLocaleString()}
                      </TableCell>
                      {/* Invoice status is intentionally hidden for now.
                          Backend defaults every invoice row to APPROVED. */}
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeInvoice(index)}
                          disabled={invoices.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Presented</p>
            <p className="text-sm font-medium">
              {currencyCode} {round2(totals.gross).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Financed</p>
            <p className="text-sm font-medium">
              {currencyCode} {round2(totals.financed).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="text-sm font-medium">
              {currencyCode} {round2(totals.reserve).toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
      {!embedded && (
        <CardFooter className="flex justify-between border-t pt-4">
          <Button type="button" variant="outline" onClick={onBack}>
            Previous
          </Button>
          <Button type="button" onClick={handleSaveAndNext} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save & Next"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
