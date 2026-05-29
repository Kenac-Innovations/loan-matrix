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
  reversalStatus: string | null;
  reversalErrorMessage: string | null;
  reversedAt: string | null;
}

interface SuccessfulTabProps {
  selectedUploadId: string;
  onCountChange: (count: number) => void;
}

const POLL_INTERVAL = 5000;

async function readErrorResponse(response: Response): Promise<string> {
  const text = await response.text();
  if (!text.trim()) {
    return response.statusText || "Request failed";
  }

  try {
    const data = JSON.parse(text) as { error?: string };
    return data.error || response.statusText || "Request failed";
  } catch {
    return text;
  }
}

function getUndoState(item: SuccessItem): {
  tone: "default" | "secondary" | "outline";
  className: string;
  label: string;
  title?: string;
} {
  switch (item.reversalStatus) {
    case "QUEUED":
      return {
        tone: "secondary",
        className: "bg-amber-100 text-amber-900 border-amber-200",
        label: "Undo queued",
      };
    case "PROCESSING":
      return {
        tone: "secondary",
        className: "bg-blue-100 text-blue-900 border-blue-200",
        label: "Undoing",
      };
    case "REVERSED":
      return {
        tone: "secondary",
        className: "bg-slate-100 text-slate-900 border-slate-200",
        label: "Undone",
      };
    case "FAILED":
      return {
        tone: "secondary",
        className: "bg-red-100 text-red-900 border-red-200",
        label: "Undo failed",
        title: item.reversalErrorMessage || undefined,
      };
    default:
      return {
        tone: "outline",
        className: "text-green-800 border-green-200",
        label: "Posted",
      };
  }
}

export function SuccessfulTab({ selectedUploadId, onCountChange }: SuccessfulTabProps) {
  const { currencyCode } = useCurrency();
  const [items, setItems] = useState<SuccessItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [undoItem, setUndoItem] = useState<SuccessItem | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err" | "warn";
    text: string;
  } | null>(null);

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
      if (!res.ok) {
        setFeedback({ type: "err", text: await readErrorResponse(res) });
        return;
      }
      setFeedback({ type: "ok", text: "Undo queued. This row will update when the background worker finishes." });
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
      if (!res.ok) {
        setFeedback({ type: "err", text: await readErrorResponse(res) });
        return;
      }
      const data = (await res.json()) as {
        queuedCount?: number;
        queued?: string[];
        failed?: Array<{ itemId: string; loanId?: number; error: string }>;
        failedCount?: number;
      };
      const n = data.queuedCount ?? data.queued?.length ?? 0;
      const failures: { itemId: string; loanId?: number; error: string }[] =
        Array.isArray(data.failed) ? data.failed : [];
      const fCount = data.failedCount ?? failures.length;

      if (n === 0 && fCount === 0) {
        setFeedback({
          type: "ok",
          text: "No eligible rows to queue for undo.",
        });
      } else if (fCount > 0 && n === 0) {
        const sample = failures[0];
        setFeedback({
          type: "err",
          text: `Could not queue any rows for undo (${fCount} failed). Example: loan ${sample?.loanId ?? "?"} — ${sample?.error ?? "Unknown error"}`,
        });
      } else if (fCount > 0) {
        const sample = failures[0];
        setFeedback({
          type: "warn",
          text: `Queued ${n} undo(s). ${fCount} row(s) could not be queued (e.g. loan ${sample?.loanId ?? "?"}: ${sample?.error ?? "error"}).`,
        });
      } else {
        setFeedback({
          type: "ok",
          text: `Queued ${n} undo(s). This page will update as reversals complete.`,
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
        id: "undoStatus",
        header: "Undo Status",
        enableSorting: false,
        cell: ({ row }) => {
          const state = getUndoState(row.original);
          return (
            <Badge variant={state.tone} className={`text-xs ${state.className}`} title={state.title}>
              {state.label}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const canUndo =
            !!row.original.fineractTxnId?.trim() &&
            row.original.reversalStatus !== "QUEUED" &&
            row.original.reversalStatus !== "PROCESSING" &&
            row.original.reversalStatus !== "REVERSED";
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
              {row.original.reversalStatus === "FAILED" ? "Retry undo" : "Undo"}
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
              : feedback.type === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-950"
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
          {items.length} repayments currently posted in Fineract
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
                All eligible rows in this upload with a Fineract transaction id will be queued for
                undo <strong>one at a time, newest processed first</strong> (last posted in the batch
                first). That order matches how Fineract usually requires reversals when other
                activity exists on the same loan.
              </p>
              <p>
                The browser request returns quickly, then the background worker keeps processing.
                If Fineract refuses an undo on a row, that row is marked failed and you can retry it
                later.
              </p>
              <p className="font-medium text-foreground">
                Rows to process: {items.filter((i) =>
                  i.fineractTxnId?.trim() &&
                  i.reversalStatus !== "QUEUED" &&
                  i.reversalStatus !== "PROCESSING" &&
                  i.reversalStatus !== "REVERSED"
                ).length}
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
