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
import { GenericDataTable } from "@/components/tables/generic-data-table";
import { DataTableColumn, DataTableFilter } from "@/shared/types/data-table";

interface TransactionsDataTableProps {
  transactions: Transaction[];
  clientId: string | number;
  loanId: string | number;
  currencyCode: string;
  onExport?: () => void;
}

export function TransactionsDataTable({
  transactions,
  clientId,
  loanId,
  currencyCode,
  onExport,
}: TransactionsDataTableProps) {
  const router = useRouter();
  const [customFilters, setCustomFilters] = useState<DataTableFilter[]>([
    {
      columnId: "type",
      value: "all",
      type: "select"
    }
  ]);

  // Get unique transaction types for filter options
  const transactionTypes = useMemo(() => {
    const types = Array.from(
      new Set(transactions.map((t) => t.type?.value).filter(Boolean))
    );
    return types.sort().map(type => ({ label: type || '', value: type || '' }));
  }, [transactions]);

  const getTransactionRef = (transaction: Transaction): string | undefined => {
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
  const columns: DataTableColumn<Transaction>[] = [
    {
      id: "rowNumber",
      header: "#",
      cell: ({ row }) => {
        const index = transactions.findIndex(t => t.id === row.original.id);
        return <span className="font-medium">{index + 1}</span>;
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "officeName",
      header: "Office",
      accessorKey: "officeName",
    },
    {
      id: "date",
      header: "Transaction Date",
      accessorKey: "date",
      cell: ({ getValue }) => formatDate(getValue()),
    },
    {
      id: "type",
      header: "Transaction Type",
      accessorKey: "type",
      cell: ({ getValue }) => {
        const type = getValue() as Transaction["type"];
        return type?.value || "";
      },
      filterType: "select",
      filterOptions: [
        { label: "All Types", value: "all" },
        { label: "Disbursement", value: "disbursement" },
        { label: "Repayment", value: "repayment" },
        { label: "Repayment (at disbursement)", value: "repaymentAtDisbursement" },
        { label: "Accrual", value: "accrual" },
        ...transactionTypes,
      ],
    },
    {
      id: "amount",
      header: "Amount",
      accessorKey: "amount",
      cell: ({ getValue }) => formatCurrency(getValue(), currencyCode),
    },
    {
      id: "principalPortion",
      header: "Principal",
      accessorKey: "principalPortion",
      cell: ({ getValue }) => formatCurrency(getValue(), currencyCode),
    },
    {
      id: "interestPortion",
      header: "Interest",
      accessorKey: "interestPortion",
      cell: ({ getValue }) => formatCurrency(getValue(), currencyCode),
    },
    {
      id: "feeChargesPortion",
      header: "Fees",
      accessorKey: "feeChargesPortion",
      cell: ({ getValue }) => formatCurrency(getValue(), currencyCode),
    },
    {
      id: "penaltyChargesPortion",
      header: "Penalties",
      accessorKey: "penaltyChargesPortion",
      cell: ({ getValue }) => formatCurrency(getValue(), currencyCode),
    },
    {
      id: "outstandingLoanBalance",
      header: "Loan Balance",
      accessorKey: "outstandingLoanBalance",
      cell: ({ getValue }) => formatCurrency(getValue(), currencyCode),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const transaction = row.original;
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
                  const txId = transaction.id;
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
                    fetch(`/api/fineract/loans/${loanId}/transactions/${transaction.id}?command=undo`, {
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
                    const url = `/api/fineract/reports?name=Loan%20Transaction%20Receipt&output-type=PDF&R_transactionId=${encodeURIComponent(String(transaction.id))}`;
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
    <GenericDataTable<Transaction>
      data={transactions}
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
