"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { Transaction } from "@/shared/types/transaction";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { getDisplayedTransactionType } from "@/lib/format-transaction";
import { GenericDataTable } from "@/components/tables/generic-data-table";
import { DataTableColumn, DataTableFilter } from "@/shared/types/data-table";

/** Reversed payout info to show one synthetic "Payout Reversed" row in loan transaction history */
export interface ReversedPayoutInfo {
  voidedAt: string;
  voidReason?: string | null;
  amount: number;
  currency: string;
}

interface TransactionsDataTableProps {
  transactions: Transaction[];
  clientId: string | number;
  loanId: string | number;
  currencyCode: string;
  onExport?: () => void;
  /** When payout was reversed, show "Payout Reversed - (reason)" in transaction history */
  reversedPayout?: ReversedPayoutInfo | null;
}

type ChargeItem = {
  amount?: number;
  chargeName?: string;
  name?: string;
  loanChargeName?: string;
  charge?: { name?: string };
};

/** A transaction row with optional charge-split metadata */
type DisplayRow = Transaction & {
  /** 0-based charge index within the group; undefined = not a charge-split row */
  _chargeIndex?: number;
  /** Display name of this specific charge */
  _chargeName?: string;
  /** Amount for this specific charge */
  _chargeAmount?: number;
  /** Total number of charges in this group */
  _groupSize?: number;
  /** 1-based row number of the parent transaction (for display) */
  _parentTxnNumber?: number;
};

export function TransactionsDataTable({
  transactions,
  clientId,
  loanId,
  currencyCode,
  reversedPayout,
}: TransactionsDataTableProps) {
  const router = useRouter();

  const isReversedTransaction = (row: DisplayRow) => !!row?.manuallyReversed;

  const getReversedTextClass = (row: DisplayRow) =>
    isReversedTransaction(row) ? "text-red-600 line-through" : "";

  const getChargeName = (charge: ChargeItem) => {
    const rawName =
      charge?.chargeName ||
      charge?.name ||
      charge?.loanChargeName ||
      charge?.charge?.name ||
      "Charge";
    return rawName
      .trim()
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());
  };

  const displayTransactions = useMemo(() => {
    const source: Transaction[] = (() => {
      if (!reversedPayout?.voidedAt) return transactions;
      const d = new Date(reversedPayout.voidedAt);
      const reversalRow: Transaction = {
        id: -1,
        officeName: "",
        date: [d.getFullYear(), d.getMonth() + 1, d.getDate()],
        type: { value: `Payout Reversed - ${reversedPayout.voidReason ?? "Cash returned to cashier"}` },
        amount: 0,
        principalPortion: 0,
        interestPortion: 0,
        feeChargesPortion: 0,
        penaltyChargesPortion: 0,
        outstandingLoanBalance: 0,
      };
      return [reversalRow, ...transactions];
    })();

    const rows: DisplayRow[] = [];
    let txnNumber = 0;

    for (const t of source) {
      txnNumber++;
      const paidCharges = t.loanChargePaidByList;
      const isMultiCharge =
        t.type?.repaymentAtDisbursement &&
        Array.isArray(paidCharges) &&
        paidCharges.length > 1;

      if (!isMultiCharge) {
        rows.push({ ...t, _parentTxnNumber: txnNumber });
        continue;
      }

      paidCharges!.forEach((charge, i) => {
        rows.push({
          ...t,
          _chargeIndex: i,
          _chargeName: getChargeName(charge),
          _chargeAmount: Number(charge.amount ?? 0),
          _groupSize: paidCharges!.length,
          _parentTxnNumber: txnNumber,
        });
      });
    }

    return rows;
  }, [transactions, reversedPayout]);

  const [customFilters, setCustomFilters] = useState<DataTableFilter[]>([
    { columnId: "type", value: "all", type: "select" },
  ]);

  // Derive unique transaction types for the filter dropdown from original transactions only
  const transactionTypes = useMemo(() => {
    const types = Array.from(
      new Set(transactions.map((t) => getDisplayedTransactionType(t)).filter(Boolean))
    );
    return types
      .sort()
      .map((displayLabel) => {
        const filterValue =
          displayLabel === "Admin Fee"
            ? "Repayment (at time of disbursement)"
            : displayLabel;
        return { label: displayLabel, value: filterValue };
      })
      .filter((t) => t.label !== "Admin Fee");
  }, [transactions]);

  const getTransactionRef = (row: DisplayRow): string | undefined => {
    if (!row) return undefined;
    if (typeof row.transactionId === "string" && /^L\d+$/.test(row.transactionId))
      return row.transactionId;
    if (typeof row.id === "number") return `L${row.id}`;
    if (typeof row.externalId === "string" && /^L\d+$/.test(row.externalId))
      return row.externalId;
    return undefined;
  };

  const isSubCharge = (row: DisplayRow) =>
    row._chargeIndex !== undefined && row._chargeIndex > 0;

  const isChargeGroup = (row: DisplayRow) => row._groupSize !== undefined;

  const columns: DataTableColumn<DisplayRow>[] = [
    {
      id: "rowNumber",
      header: "#",
      cell: ({ row }) => {
        const tx = row.original;
        // Sub-charge rows (2nd charge onward) don't show a row number
        if (isSubCharge(tx)) return null;
        return (
          <span className={`font-medium ${getReversedTextClass(tx)}`}>
            {tx._parentTxnNumber}
          </span>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "officeName",
      header: "Office",
      accessorKey: "officeName",
      cell: ({ row, getValue }) => (
        <span className={getReversedTextClass(row.original)}>
          {String(getValue() || "")}
        </span>
      ),
    },
    {
      id: "date",
      header: "Transaction Date",
      accessorKey: "date",
      cell: ({ row, getValue }) => (
        <span className={getReversedTextClass(row.original)}>
          {formatDate(getValue())}
        </span>
      ),
    },
    {
      id: "type",
      header: "Transaction Type",
      accessorKey: "type",
      cell: ({ row }) => {
        const tx = row.original;
        const label = tx._chargeName ?? getDisplayedTransactionType(tx);
        return (
          <span className={getReversedTextClass(tx)}>
            {label}
            {isReversedTransaction(tx) && tx._chargeIndex === undefined
              ? " (Reversed)"
              : ""}
          </span>
        );
      },
      getExportValue: (row) => {
        if (row._chargeName) {
          return `${row._chargeName}: ${formatCurrency(row._chargeAmount ?? 0, currencyCode)}`;
        }
        return getDisplayedTransactionType(row);
      },
      filterType: "select",
      filterOptions: [
        { label: "All Types", value: "all" },
        { label: "Disbursement", value: "disbursement" },
        { label: "Repayment", value: "repayment" },
        { label: "Admin Fee", value: "Repayment (at time of disbursement)" },
        { label: "Accrual", value: "accrual" },
        ...transactionTypes,
      ],
    },
    {
      id: "amount",
      header: "Amount",
      accessorKey: "amount",
      cell: ({ row, getValue }) => {
        const tx = row.original;
        const value = tx._chargeAmount !== undefined ? tx._chargeAmount : getValue();
        return (
          <span className={getReversedTextClass(tx)}>
            {formatCurrency(value, currencyCode)}
          </span>
        );
      },
    },
    {
      id: "principalPortion",
      header: "Principal",
      accessorKey: "principalPortion",
      cell: ({ row, getValue }) => {
        const tx = row.original;
        // Charges carry no principal
        const value = isChargeGroup(tx) ? 0 : getValue();
        return (
          <span className={getReversedTextClass(tx)}>
            {formatCurrency(value, currencyCode)}
          </span>
        );
      },
    },
    {
      id: "interestPortion",
      header: "Interest",
      accessorKey: "interestPortion",
      cell: ({ row, getValue }) => {
        const tx = row.original;
        const value = isChargeGroup(tx) ? 0 : getValue();
        return (
          <span className={getReversedTextClass(tx)}>
            {formatCurrency(value, currencyCode)}
          </span>
        );
      },
    },
    {
      id: "feeChargesPortion",
      header: "Fees",
      accessorKey: "feeChargesPortion",
      cell: ({ row, getValue }) => {
        const tx = row.original;
        // Each charge row's fee = its own charge amount
        const value = tx._chargeAmount !== undefined ? tx._chargeAmount : getValue();
        return (
          <span className={getReversedTextClass(tx)}>
            {formatCurrency(value, currencyCode)}
          </span>
        );
      },
    },
    {
      id: "penaltyChargesPortion",
      header: "Penalties",
      accessorKey: "penaltyChargesPortion",
      cell: ({ row, getValue }) => {
        const tx = row.original;
        const value = isChargeGroup(tx) ? 0 : getValue();
        return (
          <span className={getReversedTextClass(tx)}>
            {formatCurrency(value, currencyCode)}
          </span>
        );
      },
    },
    {
      id: "outstandingLoanBalance",
      header: "Loan Balance",
      accessorKey: "outstandingLoanBalance",
      cell: ({ row, getValue }) => {
        const tx = row.original;
        // Show balance only on the first row of a charge group (represents state after full transaction)
        if (isSubCharge(tx)) {
          return <span className={getReversedTextClass(tx)}>{formatCurrency(0, currencyCode)}</span>;
        }
        return (
          <span className={getReversedTextClass(tx)}>
            {formatCurrency(getValue(), currencyCode)}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const tx = row.original;

        // Sub-charge rows share the action of the first row — show nothing
        if (isSubCharge(tx)) return null;
        if (tx.id === -1) return <span className="text-muted-foreground text-xs">—</span>;

        const actionTransactionId = tx.id;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  if (!actionTransactionId) {
                    alert("No transaction id found for this row");
                    return;
                  }
                  router.push(
                    `/clients/${clientId}/loans/${loanId}/transactions/${encodeURIComponent(String(actionTransactionId))}`
                  );
                }}
              >
                View Transaction
              </DropdownMenuItem>
              {(tx?.type?.repaymentAtDisbursement || tx?.type?.accrual) && (
                <DropdownMenuItem
                  onClick={() => {
                    const df = "dd MMMM yyyy";
                    const date = tx?.date;
                    const formatDateForAPI = (a?: number[]) => {
                      if (!a || a.length !== 3) return "";
                      const [y, m, d] = a;
                      const month = new Date(y, m - 1, d).toLocaleString("en-US", { month: "long" });
                      return `${d} ${month} ${y}`;
                    };
                    fetch(
                      `/api/fineract/loans/${loanId}/transactions/${actionTransactionId}?command=undo`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          dateFormat: df,
                          locale: "en",
                          transactionAmount: 0,
                          transactionDate: formatDateForAPI(date),
                        }),
                      }
                    )
                      .then((res) => {
                        if (!res.ok) throw new Error("Undo failed");
                        router.refresh();
                      })
                      .catch(() => alert("Undo failed"));
                  }}
                >
                  Undo Transaction
                </DropdownMenuItem>
              )}
              {(tx?.type?.repaymentAtDisbursement || tx?.type?.accrual) && (
                <DropdownMenuItem
                  onClick={() => {
                    const url = `/api/fineract/reports?name=Loan%20Transaction%20Receipt&output-type=PDF&R_transactionId=${encodeURIComponent(String(actionTransactionId))}`;
                    window.open(url, "_blank");
                  }}
                >
                  View Receipts
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => {
                  const ref = getTransactionRef(tx);
                  if (!ref) {
                    alert("No valid transaction reference found for this row");
                    return;
                  }
                  router.push(
                    `/clients/${clientId}/loans/${loanId}/journal-entries?transactionId=${encodeURIComponent(ref)}`
                  );
                }}
              >
                View Journal Entry
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];

  return (
    <GenericDataTable<DisplayRow>
      data={displayTransactions}
      columns={columns}
      searchPlaceholder="Search Transaction ..."
      enablePagination={true}
      enableColumnVisibility={false}
      enableExport={true}
      enableFilters={true}
      pageSize={10}
      tableId="transactions-table"
      exportFileName="transactions"
      emptyMessage="No transactions found"
      customFilters={customFilters}
      onFilterChange={setCustomFilters}
      className="h-full"
      getRowClassName={(row) =>
        isChargeGroup(row) ? "bg-muted/20 hover:bg-muted/30" : ""
      }
    />
  );
}
