"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrency } from "@/contexts/currency-context";
import { useToast } from "@/hooks/use-toast";

type RecourseType = "WITH_RECOURSE" | "WITHOUT_RECOURSE";
type InvoiceStatus = "APPROVED" | "PENDING" | "VERIFIED" | "REJECTED" | "FINANCED";

interface InvoiceRowForm {
  id?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  grossAmount: string;
  eligibleAmount: string;
  currencyCode: string;
  fineractDocumentId?: string;
  documentFile?: File | null;
}

interface InvoiceDiscountingFormProps {
  leadId?: string;
  onBack: () => void;
  onNext: () => void;
  onComplete?: () => void;
}

interface InvoiceDiscountingCaseResponse {
  debtorName: string;
  debtorRegistrationNumber?: string | null;
  debtorTaxId?: string | null;
  debtorContactName?: string | null;
  debtorContactPhone?: string | null;
  debtorContactEmail?: string | null;
  recourseType: RecourseType;
  advanceRate: number;
  concentrationLimit?: number | null;
  debtorTermsDays?: number | null;
  reservePercent?: number | null;
  notes?: string | null;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    grossAmount: number;
    eligibleAmount: number;
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
  eligibleAmount: "",
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

export function InvoiceDiscountingForm({
  leadId,
  onBack,
  onNext,
  onComplete,
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
  const [recourseType, setRecourseType] = useState<RecourseType>("WITH_RECOURSE");
  const [advanceRate, setAdvanceRate] = useState("70");
  const [concentrationLimit, setConcentrationLimit] = useState("");
  const [debtorTermsDays, setDebtorTermsDays] = useState("");
  const [reservePercent, setReservePercent] = useState("");
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
        setRecourseType(data.recourseType || "WITH_RECOURSE");
        setAdvanceRate(`${data.advanceRate ?? 0}`);
        setConcentrationLimit(
          data.concentrationLimit == null ? "" : `${data.concentrationLimit}`
        );
        setDebtorTermsDays(data.debtorTermsDays == null ? "" : `${data.debtorTermsDays}`);
        setReservePercent(data.reservePercent == null ? "" : `${data.reservePercent}`);
        setNotes(data.notes || "");
        setInvoices(
          data.invoices.length > 0
            ? data.invoices.map((row) => ({
                id: row.id,
                invoiceNumber: row.invoiceNumber,
                invoiceDate: toDateInput(row.invoiceDate),
                dueDate: toDateInput(row.dueDate),
                grossAmount: `${row.grossAmount}`,
                eligibleAmount: `${row.eligibleAmount}`,
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
      const rawEligible = row.eligibleAmount === "" ? gross : Number(row.eligibleAmount) || 0;
      const eligible = round2(Math.max(0, Math.min(rawEligible, gross)));
      const financed = round2((eligible * advanceRateNumber) / 100);
      const reserve = round2(eligible - financed);
      return {
        gross,
        eligible,
        financed,
        reserve,
      };
    });
  }, [invoices, advanceRateNumber]);

  const totals = useMemo(() => {
    return derivedRows.reduce(
      (acc, row) => {
        acc.gross += row.gross;
        acc.eligible += row.eligible;
        acc.financed += row.financed;
        acc.reserve += row.reserve;
        return acc;
      },
      { gross: 0, eligible: 0, financed: 0, reserve: 0 }
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

  const handleSaveAndNext = async () => {
    if (!leadId) {
      toast({
        title: "Missing lead",
        description: "Please complete lead setup first.",
        variant: "destructive",
      });
      return;
    }

    if (!debtorName.trim()) {
      toast({
        title: "Validation error",
        description: "Debtor name is required.",
        variant: "destructive",
      });
      return;
    }

    const hasInvalidInvoice = invoices.some(
      (row) => !row.invoiceNumber.trim() || !row.invoiceDate || !row.dueDate || Number(row.grossAmount) <= 0
    );
    if (hasInvalidInvoice) {
      toast({
        title: "Validation error",
        description: "Each invoice must include number, dates, and gross amount.",
        variant: "destructive",
      });
      return;
    }

    if (invoices.some((row) => !!row.documentFile) && !fineractClientId) {
      toast({
        title: "Missing client",
        description: "Cannot upload invoice files until the lead has a linked Fineract client.",
        variant: "destructive",
      });
      return;
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
        recourseType,
        advanceRate: advanceRateNumber,
        concentrationLimit: concentrationLimit === "" ? undefined : Number(concentrationLimit),
        debtorTermsDays: debtorTermsDays === "" ? undefined : Number(debtorTermsDays),
        reservePercent: reservePercent === "" ? undefined : Number(reservePercent),
        notes: notes || undefined,
        invoices: rowsWithDocumentIds.map((row) => ({
          id: row.id,
          invoiceNumber: row.invoiceNumber.trim(),
          invoiceDate: row.invoiceDate,
          dueDate: row.dueDate,
          grossAmount: Number(row.grossAmount),
          eligibleAmount: row.eligibleAmount === "" ? undefined : Number(row.eligibleAmount),
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
            eligibleAmount: `${row.eligibleAmount}`,
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
      onNext();
    } catch (err) {
      console.error("Error saving invoice discounting data:", err);
      const message = err instanceof Error ? err.message : "Failed to save data";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Loading invoice discounting details...
        </CardContent>
      </Card>
    );
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
            <Label htmlFor="recourseType">Recourse Type</Label>
            <Select value={recourseType} onValueChange={(value: RecourseType) => setRecourseType(value)}>
              <SelectTrigger id="recourseType">
                <SelectValue placeholder="Select recourse type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WITH_RECOURSE">With Recourse</SelectItem>
                <SelectItem value="WITHOUT_RECOURSE">Without Recourse</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="advanceRate">Advance Rate (%)</Label>
            <Input
              id="advanceRate"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={advanceRate}
              onChange={(e) => setAdvanceRate(e.target.value)}
              placeholder="e.g. 70"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="concentrationLimit">Concentration Limit (%)</Label>
            <Input
              id="concentrationLimit"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={concentrationLimit}
              onChange={(e) => setConcentrationLimit(e.target.value)}
              placeholder="Optional"
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
            <Label htmlFor="reservePercent">Reserve Percent (%)</Label>
            <Input
              id="reservePercent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={reservePercent}
              onChange={(e) => setReservePercent(e.target.value)}
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
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Eligible</TableHead>
                  <TableHead>Financed</TableHead>
                  <TableHead>Reserve</TableHead>
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
                          onChange={(e) => updateInvoice(index, "invoiceNumber", e.target.value)}
                          placeholder="INV-001"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={row.invoiceDate}
                          onChange={(e) => updateInvoice(index, "invoiceDate", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={row.dueDate}
                          onChange={(e) => updateInvoice(index, "dueDate", e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="min-w-[210px]">
                        <div className="space-y-2">
                          <Input
                            type="file"
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
                          value={row.grossAmount}
                          onChange={(e) => updateInvoice(index, "grossAmount", e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.eligibleAmount}
                          onChange={(e) => updateInvoice(index, "eligibleAmount", e.target.value)}
                          placeholder="Auto=Gross"
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {currencySymbol}
                        {round2(derived?.financed || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {currencySymbol}
                        {round2(derived?.reserve || 0).toLocaleString()}
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

        <div className="grid grid-cols-1 gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Presented</p>
            <p className="text-sm font-medium">
              {currencyCode} {round2(totals.gross).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Eligible</p>
            <p className="text-sm font-medium">
              {currencyCode} {round2(totals.eligible).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Financed</p>
            <p className="text-sm font-medium">
              {currencyCode} {round2(totals.financed).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Reserve</p>
            <p className="text-sm font-medium">
              {currencyCode} {round2(totals.reserve).toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Previous
        </Button>
        <Button type="button" onClick={handleSaveAndNext} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save & Next"}
        </Button>
      </CardFooter>
    </Card>
  );
}
