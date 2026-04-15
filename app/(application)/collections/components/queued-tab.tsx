"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useCurrency } from "@/contexts/currency-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, RefreshCw } from "lucide-react";
import { GenericDataTable, DataTableColumn } from "@/components/tables/generic-data-table";
import { formatCurrency } from "@/lib/format-currency";
import { UploadDashboard } from "./upload-dashboard";

interface QueuedItem {
  id: string;
  rowNumber: number;
  loanId: number;
  loanAccountNo: string | null;
  clientName: string | null;
  amount: string;
  paymentTypeName: string | null;
  status: string;
  reversalStatus: string | null;
  createdAt: string;
}

interface QueuedTabProps {
  selectedUploadId: string;
  onCountChange: (count: number) => void;
}

const POLL_INTERVAL = 5000;

export function QueuedTab({ selectedUploadId, onCountChange }: QueuedTabProps) {
  const { currencyCode } = useCurrency();
  const [items, setItems] = useState<QueuedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  const fetchItems = useCallback(async (showLoader = true) => {
    if (!selectedUploadId) return;
    if (showLoader) setLoading(true);
    try {
      const res = await fetch(
        `/api/collections/uploads/${selectedUploadId}/items?status=QUEUED,PROCESSING&reversalStatus=QUEUED,PROCESSING&mode=or`
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

  const columns = useMemo((): DataTableColumn<QueuedItem>[] => [
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
      id: "paymentTypeName",
      header: "Payment Type",
      accessorKey: "paymentTypeName",
      cell: ({ getValue }) => <span className="text-xs">{String(getValue() || "Default")}</span>,
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: ({ row, getValue }) => {
        const status = String(getValue());
        const reversalStatus = row.original.reversalStatus;
        const displayStatus =
          status === "SUCCESS" && reversalStatus
            ? `UNDO_${reversalStatus}`
            : status;
        return (
          <Badge
            variant="secondary"
            className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-400"
          >
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {displayStatus}
          </Badge>
        );
      },
    },
  ], [currencyCode]);

  if (!selectedUploadId) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Select an upload to view queued repayments</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <UploadDashboard uploadId={selectedUploadId} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} repayments queued for processing
        </p>
        <Button variant="outline" size="sm" onClick={() => fetchItems()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <GenericDataTable
          data={items}
          columns={columns}
          tableId="queued-repayments-table"
          searchPlaceholder="Search queued items..."
          enablePagination
          pageSize={20}
          emptyMessage="No queued repayments. Items will appear here when processing starts."
          isLoading={loading}
        />
      )}
    </div>
  );
}
