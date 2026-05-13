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

type DisplayTransaction = Transaction;

export function TransactionsDataTable({
  transactions,
  clientId,
  loanId,
  currencyCode,
  reversedPayout,
}: TransactionsDataTableProps) {
  const router = useRouter();

  const isReversedTransaction = (transaction: DisplayTransaction) =>
    !!transaction?.manuallyReversed;

  const getReversedTextClass = (transaction: DisplayTransaction) =>
    isReversedTransaction(transaction) ? "text-red-600 line-through" : "";

  const getChargeName = (
    charge: DisplayTransaction["loanChargePaidByList"] extends Array<infer T>
      ? T
      : never
  ) => {
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
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const displayTransactions = useMemo(() => {
    const expandedTransactions = transactions as DisplayTransaction[];

    if (!reversedPayout?.voidedAt) return expandedTransactions;
    const d = new Date(reversedPayout.voidedAt);
    const reversalRow: DisplayTransaction = {
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
    return [reversalRow, ...expandedTransactions];
  }, [transactions, reversedPayout]);

  const [customFilters, setCustomFilters] = useState<DataTableFilter[]>([
    {
      columnId: "type",
      value: "all",
      type: "select"
    }
  ]);

  // Get unique transaction types for filter options (show "Admin Fee" for repayment at disbursement)
  const transactionTypes = useMemo(() => {
    const types = Array.from(
      new Set(displayTransactions.map((t) => getDisplayedTransactionType(t)).filter(Boolean))
    );
    return types.sort().map((displayLabel) => {
      // Use actual type.value for filtering; "Admin Fee" maps to "Repayment (at time of disbursement)"
      const filterValue = displayLabel === "Admin Fee"
        ? "Repayment (at time of disbursement)"
        : displayLabel;
      return { label: displayLabel, value: filterValue };
    }).filter((t) => t.label !== "Admin Fee"); // Admin Fee is in hardcoded filterOptions
  }, [displayTransactions]);

  const getTransactionRef = (transaction: DisplayTransaction): string | undefined => {
    if (!transaction) return undefined;
    if (typeof transaction.transactionId === 'string' && /^L\d+$/.test(transaction.transactionId)) {
      return transaction.transactionId;
    }
    if (typeof transaction.id === 'number') return `L${transaction.id}`;
    if (typeof transaction.externalId === 'string' && /^L\d+$/.test(transaction.externalId)) {
      return transaction.externalId;
    }
    return undefined;
  };

  // Define columns for the generic data table
  const columns: DataTableColumn<DisplayTransaction>[] = [
    {
      id: "rowNumber",
      header: "#",
      cell: ({ row }) => {
        const index = displayTransactions.findIndex(t => t.id === row.original.id);
        return (
          <span className={`font-medium ${getReversedTextClass(row.original)}`}>
            {index + 1}
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
        const transaction = row.original;
        const paidCharges = transaction.loanChargePaidByList;
        const isMultiCharge =
          transaction.type?.repaymentAtDisbursement &&
          Array.isArray(paidCharges) &&
          paidCharges.length > 1;

        if (isMultiCharge) {
          return (
            <div className={`space-y-0.5 ${getReversedTextClass(transaction)}`}>
              {paidCharges!.map((charge, i) => (
                <div key={i} className="text-sm">
                  {getChargeName(charge)}: {formatCurrency(Number(charge.amount ?? 0), currencyCode)}
                </div>
              ))}
              {isReversedTransaction(transaction) && <div className="text-xs">(Reversed)</div>}
            </div>
          );
        }

        return (
          <span className={getReversedTextClass(transaction)}>
            {getDisplayedTransactionType(transaction)}
            {isReversedTransaction(transaction) ? " (Reversed)" : ""}
          </span>
        );
      },
      getExportValue: (row) => {
        const paidCharges = row.loanChargePaidByList;
        const isMultiCharge =
          row.type?.repaymentAtDisbursement &&
          Array.isArray(paidCharges) &&
          paidCharges.length > 1;
        if (isMultiCharge) {
          return paidCharges!
            .map((c) => `${getChargeName(c)}: ${formatCurrency(Number(c.amount ?? 0), currencyCode)}`)
            .join(", ");
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
      cell: ({ row, getValue }) => (
        <span className={getReversedTextClass(row.original)}>
          {formatCurrency(getValue(), currencyCode)}
        </span>
      ),
    },
    {
      id: "principalPortion",
      header: "Principal",
      accessorKey: "principalPortion",
      cell: ({ row, getValue }) => (
        <span className={getReversedTextClass(row.original)}>
          {formatCurrency(getValue(), currencyCode)}
        </span>
      ),
    },
    {
      id: "interestPortion",
      header: "Interest",
      accessorKey: "interestPortion",
      cell: ({ row, getValue }) => (
        <span className={getReversedTextClass(row.original)}>
          {formatCurrency(getValue(), currencyCode)}
        </span>
      ),
    },
    {
      id: "feeChargesPortion",
      header: "Fees",
      accessorKey: "feeChargesPortion",
      cell: ({ row, getValue }) => (
        <span className={getReversedTextClass(row.original)}>
          {formatCurrency(getValue(), currencyCode)}
        </span>
      ),
    },
    {
      id: "penaltyChargesPortion",
      header: "Penalties",
      accessorKey: "penaltyChargesPortion",
      cell: ({ row, getValue }) => (
        <span className={getReversedTextClass(row.original)}>
          {formatCurrency(getValue(), currencyCode)}
        </span>
      ),
    },
    {
      id: "outstandingLoanBalance",
      header: "Loan Balance",
      accessorKey: "outstandingLoanBalance",
      cell: ({ row, getValue }) => (
        <span className={getReversedTextClass(row.original)}>
          {formatCurrency(getValue(), currencyCode)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const transaction = row.original;
        if (transaction.id === -1) return <span className="text-muted-foreground text-xs">—</span>;
        const actionTransactionId = transaction.id;
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
                  const txId = actionTransactionId;
                  if (!txId) {
                    alert('No transaction id found for this row');
                    return;
                  }
                  router.push(`/clients/${clientId}/loans/${loanId}/transactions/${encodeURIComponent(String(txId))}`);
                }}
              >
                View Transaction
              </DropdownMenuItem>
              {(transaction?.type?.repaymentAtDisbursement || transaction?.type?.accrual) && (
                <DropdownMenuItem
                  onClick={() => {
                    const df = "dd MMMM yyyy";
                    const date = transaction?.date;
                    const formatDateForAPI = (a?: number[]) => {
                      if (!a || a.length !== 3) return "";
                      const [y, m, d] = a;
                      const month = new Date(y, m - 1, d).toLocaleString('en-US', { month: 'long' });
                      return `${d} ${month} ${y}`;
                    };
                    fetch(`/api/fineract/loans/${loanId}/transactions/${actionTransactionId}?command=undo`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        dateFormat: df,
                        locale: 'en',
                        transactionAmount: 0,
                        transactionDate: formatDateForAPI(date)
                      })
                    }).then(res => {
                      if (!res.ok) throw new Error('Undo failed');
                      router.refresh();
                    }).catch(() => alert('Undo failed'));
                  }}
                >
                  Undo Transaction
                </DropdownMenuItem>
              )}
              {(transaction?.type?.repaymentAtDisbursement || transaction?.type?.accrual) && (
                <DropdownMenuItem
                  onClick={() => {
                    const url = `/api/fineract/reports?name=Loan%20Transaction%20Receipt&output-type=PDF&R_transactionId=${encodeURIComponent(String(actionTransactionId))}`;
                    window.open(url, '_blank');
                  }}
                >
                  View Receipts
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => {
                  const ref = getTransactionRef(transaction);
                  if (!ref) {
                    alert('No valid transaction reference found for this row');
                    return;
                  }
                  router.push(`/clients/${clientId}/loans/${loanId}/journal-entries?transactionId=${encodeURIComponent(ref)}`);
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
    <GenericDataTable<DisplayTransaction>
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
    />
  );
}
