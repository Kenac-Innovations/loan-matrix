"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useCurrency } from "@/contexts/currency-context";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle, RefreshCw, RotateCcw } from "lucide-react";
import { GenericDataTable, DataTableColumn } from "@/components/tables/generic-data-table";
import { formatCurrency } from "@/lib/format-currency";
import { UploadDashboard } from "./upload-dashboard";
import { format } from "date-fns";

interface FailedItem {
  id: string;
  rowNumber: number;
  loanId: number;
  loanAccountNo: string | null;
  clientName: string | null;
  amount: string;
  paymentTypeName: string | null;
  errorMessage: string | null;
  reversalErrorMessage: string | null;
  processedAt: string | null;
  status: string;
  reversalStatus: string | null;
}

interface FailedTabProps {
  selectedUploadId: string;
  onCountChange: (count: number) => void;
}

const POLL_INTERVAL = 5000;

export function FailedTab({ selectedUploadId, onCountChange }: FailedTabProps) {
  const { currencyCode } = useCurrency();
  const [items, setItems] = useState<FailedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  const fetchItems = useCallback(async (showLoader = true) => {
    if (!selectedUploadId) return;
    if (showLoader) setLoading(true);
    try {
      const res = await fetch(
        `/api/collections/uploads/${selectedUploadId}/items?status=FAILED&reversalStatus=FAILED&mode=or`
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

  const handleRetryAll = async () => {
    if (!selectedUploadId) return;
    setRetrying(true);
    try {
      const res = await fetch(
        `/api/collections/uploads/${selectedUploadId}/retry`,
        { method: "POST" }
      );
      if (res.ok) {
        fetchItems();
      }
    } catch {
      // Silent
    } finally {
      setRetrying(false);
    }
  };

  const handleRetrySingle = useCallback(async (itemId: string) => {
    if (!selectedUploadId) return;
    try {
      await fetch(
        `/api/collections/uploads/${selectedUploadId}/retry`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds: [itemId] }),
        }
      );
      fetchItems();
    } catch {
      // Silent
    }
  }, [selectedUploadId, fetchItems]);

  const columns = useMemo((): DataTableColumn<FailedItem>[] => [
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
      cell: ({ getValue }) => <span className="text-xs font-medium">{String(getValue() || "-")}</span>,
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
      id: "errorMessage",
      header: "Error",
      accessorKey: "errorMessage",
      cell: ({ row, getValue }) => (
        <span
          className="text-xs text-destructive max-w-[300px] truncate block"
          title={String(getValue() || row.original.reversalErrorMessage || "")}
        >
          {String(getValue() || row.original.reversalErrorMessage || "Unknown error")}
        </span>
      ),
    },
    {
      id: "processedAt",
      header: "Failed At",
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
      id: "failureType",
      header: "Failure Type",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.status === "FAILED" ? "Repayment" : "Undo"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Retry",
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            if (row.original.status === "FAILED") {
              handleRetrySingle(row.original.id);
            }
          }}
          disabled={row.original.status !== "FAILED"}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          {row.original.status === "FAILED" ? "Retry" : "Use Undo"}
        </Button>
      ),
    },
  ], [currencyCode, handleRetrySingle]);

  if (!selectedUploadId) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select an upload to view failed repayments</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <UploadDashboard uploadId={selectedUploadId} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} repayments failed
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchItems()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {items.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryAll}
              disabled={retrying}
              className="text-amber-600 hover:text-amber-700"
            >
              {retrying ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-1" />
              )}
              Retry All ({items.length})
            </Button>
          )}
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <GenericDataTable
          data={items}
          columns={columns}
          tableId="failed-repayments-table"
          searchPlaceholder="Search failed items..."
          enablePagination
          enableExport
          exportFileName="failed-repayments"
          pageSize={20}
          emptyMessage="No failed repayments. All items processed successfully!"
          isLoading={loading}
        />
      )}
    </div>
  );
}
