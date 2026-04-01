"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useCurrency } from "@/contexts/currency-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle2, RefreshCw, Undo2 } from "lucide-react";
import { GenericDataTable, DataTableColumn } from "@/components/tables/generic-data-table";
import { formatCurrency } from "@/lib/format-currency";
import { UploadDashboard } from "./upload-dashboard";
import { format } from "date-fns";

interface SuccessItem {
  id: string;
  rowNumber: number;
  loanId: number;
  loanAccountNo: string | null;
  clientName: string | null;
  amount: string;
  paymentTypeName: string | null;
  fineractTxnId: string | null;
  processedAt: string | null;
  status: string;
}

interface SuccessfulTabProps {
  selectedUploadId: string;
  onCountChange: (count: number) => void;
}

const POLL_INTERVAL = 5000;

export function SuccessfulTab({ selectedUploadId, onCountChange }: SuccessfulTabProps) {
  const { currencyCode } = useCurrency();
  const [items, setItems] = useState<SuccessItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [undoItem, setUndoItem] = useState<SuccessItem | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  const fetchItems = useCallback(async (showLoader = true) => {
    if (!selectedUploadId) return;
    if (showLoader) setLoading(true);
    try {
      const res = await fetch(
        `/api/collections/uploads/${selectedUploadId}/items?status=SUCCESS`
      );
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        onCountChangeRef.current(data.items?.length || 0);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [selectedUploadId]);

  useEffect(() => {
    fetchItems();
    const interval = setInterval(() => fetchItems(false), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchItems]);

  const runSingleUndo = async () => {
    if (!undoItem || !selectedUploadId) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/collections/uploads/${selectedUploadId}/items/${undoItem.id}/reverse`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: "err", text: data.error || res.statusText });
        return;
      }
      setFeedback({ type: "ok", text: "Repayment undone in Fineract." });
      setUndoItem(null);
      await fetchItems(false);
    } catch (e) {
      setFeedback({
        type: "err",
        text: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const runBatchUndo = async () => {
    if (!selectedUploadId) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/collections/uploads/${selectedUploadId}/reverse-batch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({ type: "err", text: data.error || res.statusText });
        return;
      }
      const n = data.reversedCount ?? data.reversed?.length ?? 0;
      if (data.failed) {
        setFeedback({
          type: "err",
          text: `Undid ${n} item(s), then stopped: ${data.failed.error} (row id ${data.failed.itemId})`,
        });
      } else {
        setFeedback({
          type: "ok",
          text:
            n === 0
              ? "No eligible rows to undo."
              : `Undid ${n} repayment(s) in Fineract (newest processed first).`,
        });
      }
      setBatchOpen(false);
      await fetchItems(false);
    } catch (e) {
      setFeedback({
        type: "err",
        text: e instanceof Error ? e.message : "Request failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo((): DataTableColumn<SuccessItem>[] => {
    return [
      {
        id: "rowNumber",
        header: "#",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs">{row.original.rowNumber}</span>
        ),
      },
      {
        id: "loanId",
        header: "Loan ID",
        accessorKey: "loanId",
        cell: ({ getValue }) => <span className="font-mono text-xs">{String(getValue())}</span>,
      },
      {
        id: "loanAccountNo",
        header: "Account No",
        accessorKey: "loanAccountNo",
        cell: ({ getValue }) => <span className="text-xs">{String(getValue() || "-")}</span>,
      },
      {
        id: "clientName",
        header: "Client",
        accessorKey: "clientName",
        cell: ({ getValue }) => (
          <span className="text-xs font-medium">{String(getValue() || "-")}</span>
        ),
      },
      {
        id: "amount",
        header: "Amount",
        accessorKey: "amount",
        cell: ({ getValue }) => (
          <span className="text-xs font-medium tabular-nums">
            {formatCurrency(parseFloat(String(getValue())) || 0, currencyCode)}
          </span>
        ),
      },
      {
        id: "paymentTypeName",
        header: "Payment Type",
        accessorKey: "paymentTypeName",
        cell: ({ getValue }) => <span className="text-xs">{String(getValue() || "Default")}</span>,
      },
      {
        id: "fineractTxnId",
        header: "Txn ID",
        accessorKey: "fineractTxnId",
        cell: ({ getValue }) => {
          const txnId = getValue();
          return txnId ? (
            <Badge variant="outline" className="text-xs font-mono">
              {String(txnId)}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          );
        },
      },
      {
        id: "processedAt",
        header: "Processed",
        accessorKey: "processedAt",
        cell: ({ getValue }) => {
          const val = getValue();
          return val ? (
            <span className="text-xs text-muted-foreground">
              {format(new Date(String(val)), "MMM d, HH:mm:ss")}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: () => (
          <Badge className="text-xs bg-green-100 text-green-800 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const canUndo = !!row.original.fineractTxnId?.trim();
          return (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={!canUndo}
              onClick={() => setUndoItem(row.original)}
            >
              <Undo2 className="h-3 w-3 mr-1" />
              Undo
            </Button>
          );
        },
      },
    ];
  }, [currencyCode]);

  if (!selectedUploadId) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select an upload to view successful repayments</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <UploadDashboard uploadId={selectedUploadId} />

      {feedback && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            feedback.type === "ok"
              ? "border-green-200 bg-green-50 text-green-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {feedback.text}
          <button
            type="button"
            className="ml-2 underline text-xs"
            onClick={() => setFeedback(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {items.length} repayments successfully processed
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            disabled={loading || items.length === 0}
            onClick={() => setBatchOpen(true)}
          >
            <Undo2 className="h-4 w-4 mr-1" />
            Undo entire batch
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchItems()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Dialog open={!!undoItem} onOpenChange={(o) => !o && setUndoItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Undo this repayment?</DialogTitle>
            <DialogDescription>
              This calls Fineract to reverse the repayment transaction. It only works if that
              transaction is still the latest on the loan (or Fineract allows undo). Loan{" "}
              <span className="font-mono">{undoItem?.loanId}</span>
              {undoItem?.loanAccountNo ? ` (${undoItem.loanAccountNo})` : ""} —{" "}
              {undoItem
                ? formatCurrency(parseFloat(undoItem.amount) || 0, currencyCode)
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setUndoItem(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={runSingleUndo} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm undo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Undo entire batch?</DialogTitle>
            <DialogDescription className="space-y-2 text-left">
              <p>
                All successful rows in this upload with a Fineract transaction id will be undone{" "}
                <strong>one at a time, newest processed first</strong> (last posted in the batch
                first). That order matches how Fineract usually requires reversals when other
                activity exists on the same loan.
              </p>
              <p>
                If Fineract refuses an undo (e.g. not the loan&apos;s latest transaction), the run
                stops and earlier rows stay posted; you can fix the loan in Fineract and retry, or
                use row-level undo.
              </p>
              <p className="font-medium text-foreground">
                Rows to process: {items.filter((i) => i.fineractTxnId?.trim()).length}
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBatchOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={runBatchUndo} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Undo batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <GenericDataTable
          data={items}
          columns={columns}
          tableId="successful-repayments-table"
          searchPlaceholder="Search successful items..."
          enablePagination
          enableExport
          exportFileName="successful-repayments"
          pageSize={20}
          emptyMessage="No successful repayments yet."
          isLoading={loading}
        />
      )}
    </div>
  );
}
