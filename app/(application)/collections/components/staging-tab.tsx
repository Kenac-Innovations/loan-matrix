"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useCurrency } from "@/contexts/currency-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Loader2,
  Play,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { formatCurrency } from "@/lib/format-currency";

interface StagingItem {
  id: string;
  rowNumber: number;
  loanId: number;
  loanAccountNo: string | null;
  clientName: string | null;
  amount: string;
  paymentTypeId: number | null;
  paymentTypeName: string | null;
  accountNumber: string | null;
  chequeNumber: string | null;
  routingCode: string | null;
  receiptNumber: string | null;
  bankNumber: string | null;
  note: string | null;
  transactionDate: string | null;
  status: string;
}

interface PaymentType {
  id: number;
  name: string;
}

interface StagingTabProps {
  selectedUploadId: string;
  onCountChange: (count: number) => void;
  onProcessed: () => void;
}

export function StagingTab({
  selectedUploadId,
  onCountChange,
  onProcessed,
}: StagingTabProps) {
  const { currencyCode } = useCurrency();
  const [items, setItems] = useState<StagingItem[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);

  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  const fetchItems = useCallback(async () => {
    if (!selectedUploadId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/collections/uploads/${selectedUploadId}/items?status=STAGED`
      );
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        onCountChangeRef.current(data.items?.length || 0);
      }
    } catch {
      setError("Failed to load staged items");
    } finally {
      setLoading(false);
    }
  }, [selectedUploadId]);

  const fetchPaymentTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/fineract/payment-types");
      if (res.ok) {
        const data = await res.json();
        setPaymentTypes(data || []);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchPaymentTypes();
  }, [fetchItems, fetchPaymentTypes]);

  const handleUpdateItem = async (
    itemId: string,
    field: string,
    value: string | number | null
  ) => {
    try {
      const res = await fetch(
        `/api/collections/uploads/${selectedUploadId}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        }
      );
      if (res.ok) {
        const updated = await res.json();
        setItems((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, ...updated } : item))
        );
      }
    } catch {
      // Silently fail
    }
    setEditingCell(null);
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      const res = await fetch(
        `/api/collections/uploads/${selectedUploadId}/items/${itemId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== itemId));
        onCountChange(items.length - 1);
      }
    } catch {
      // Silently fail
    }
  };

  const handleProcess = async () => {
    if (!selectedUploadId) return;
    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/collections/uploads/${selectedUploadId}/process`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Processing failed");
      }
      onProcessed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setProcessing(false);
    }
  };

  const totalAmount = items.reduce(
    (sum, item) => sum + (parseFloat(item.amount) || 0),
    0
  );
  const invalidRows = items.filter((item) => !item.loanId || parseFloat(item.amount) <= 0);

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Actions bar */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-4 text-sm">
          <span>
            <strong>{items.length}</strong> records staged
          </span>
          <span>
            Total: <strong>{formatCurrency(totalAmount, currencyCode)}</strong>
          </span>
          {invalidRows.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {invalidRows.length} invalid
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchItems} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={handleProcess}
            disabled={processing || items.length === 0 || invalidRows.length > 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Process {items.length} Repayments
              </>
            )}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No staged items. All records have been processed.</p>
        </div>
      ) : (
        <div className="rounded-md border overflow-auto max-h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="text-xs w-10">#</TableHead>
                <TableHead className="text-xs">Loan ID</TableHead>
                <TableHead className="text-xs">Account No</TableHead>
                <TableHead className="text-xs">Client</TableHead>
                <TableHead className="text-xs">Amount</TableHead>
                <TableHead className="text-xs">Payment Type</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Note</TableHead>
                <TableHead className="text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isInvalid = !item.loanId || parseFloat(item.amount) <= 0;
                return (
                  <TableRow
                    key={item.id}
                    className={isInvalid ? "bg-red-50 dark:bg-red-950/20" : ""}
                  >
                    <TableCell className="text-xs text-muted-foreground">
                      {item.rowNumber}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{item.loanId || "-"}</TableCell>
                    <TableCell className="text-xs">{item.loanAccountNo || "-"}</TableCell>
                    <TableCell className="text-xs font-medium">{item.clientName || "-"}</TableCell>
                    <TableCell className="text-xs">
                      {editingCell?.id === item.id && editingCell?.field === "amount" ? (
                        <Input
                          type="number"
                          defaultValue={item.amount}
                          className="h-7 w-24 text-xs"
                          autoFocus
                          onBlur={(e) =>
                            handleUpdateItem(item.id, "amount", parseFloat(e.target.value) || 0)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleUpdateItem(
                                item.id,
                                "amount",
                                parseFloat((e.target as HTMLInputElement).value) || 0
                              );
                            }
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:underline tabular-nums font-medium"
                          onClick={() => setEditingCell({ id: item.id, field: "amount" })}
                        >
                          {formatCurrency(parseFloat(item.amount) || 0, currencyCode)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Select
                        value={item.paymentTypeId?.toString() || "__none__"}
                        onValueChange={(v) =>
                          handleUpdateItem(
                            item.id,
                            "paymentTypeId",
                            v === "__none__" ? null : parseInt(v, 10)
                          )
                        }
                      >
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {paymentTypes.map((pt) => (
                            <SelectItem key={pt.id} value={pt.id.toString()}>
                              {pt.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {item.transactionDate
                        ? new Date(item.transactionDate).toLocaleDateString()
                        : "Today"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {editingCell?.id === item.id && editingCell?.field === "note" ? (
                        <Input
                          defaultValue={item.note || ""}
                          className="h-7 w-32 text-xs"
                          autoFocus
                          onBlur={(e) => handleUpdateItem(item.id, "note", e.target.value || null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleUpdateItem(
                                item.id,
                                "note",
                                (e.target as HTMLInputElement).value || null
                              );
                            }
                            if (e.key === "Escape") setEditingCell(null);
                          }}
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:underline text-muted-foreground"
                          onClick={() => setEditingCell({ id: item.id, field: "note" })}
                        >
                          {item.note || "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
