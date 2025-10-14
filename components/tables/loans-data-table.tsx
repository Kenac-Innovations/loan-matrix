"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { GenericDataTable } from "@/components/tables/generic-data-table";
import { DataTableColumn, DataTableFilter } from "@/shared/types/data-table";
import { useState, useMemo } from "react";

export type Loan = {
  id: string;
  accountNo: string;
  clientName: string;
  clientId: string;
  productName: string;
  status: string;
  principal: number;
  currency: string;
  disbursedAmount: number;
  outstandingBalance: number;
  daysInArrears: number;
  approvedOnDate: string;
  disbursedOnDate: string;
  maturityDate: string;
};

interface LoansDataTableProps {
  data: Loan[];
}

export function LoansDataTable({ data }: LoansDataTableProps) {
  const [customFilters, setCustomFilters] = useState<DataTableFilter[]>([
    { columnId: "status", value: "", type: "select" },
    { columnId: "currency", value: "", type: "select" },
  ]);

  const handleRowClick = (loan: Loan) => {
    // Execute the view action - navigate to client loan detail page
    if (loan.clientId) {
      window.location.href = `/clients/${loan.clientId}/loans/${loan.id}`;
    }
  };

  // Get unique values for filter options
  const uniqueStatuses = useMemo(() => {
    const statuses = data
      .map((loan) => {
        if (typeof loan.status === 'object' && loan.status !== null) {
          return (loan.status as any).value || String(loan.status);
        }
        return String(loan.status);
      })
      .filter(Boolean);
    return Array.from(new Set(statuses));
  }, [data]);

  const uniqueCurrencies = useMemo(() => {
    const currencies = data.map((loan) => {
      if (typeof loan.currency === 'object' && loan.currency !== null) {
        return (loan.currency as any).code || String(loan.currency);
      }
      return String(loan.currency || 'USD');
    }).filter(Boolean);
    return Array.from(new Set(currencies));
  }, [data]);

  const columns: DataTableColumn<Loan>[] = [
    {
      id: "accountNo",
      accessorKey: "accountNo",
      header: "Account #",
      cell: ({ getValue }) => (
        <div className="font-mono text-sm">{getValue()}</div>
      ),
    },
    {
      id: "clientName",
      accessorKey: "clientName",
      header: "Client",
      cell: ({ getValue }) => (
        <div className="font-medium">{getValue()}</div>
      ),
    },
    {
      id: "productName",
      accessorKey: "productName",
      header: "Product",
      cell: ({ getValue }) => (
        <div className="max-w-[200px] truncate">
          {getValue()}
        </div>
      ),
    },
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => {
        const status = getValue() as string;
        const statusColor = getStatusColor(status);
        return (
          <Badge variant="outline" className={statusColor}>
            {status}
          </Badge>
        );
      },
      filterOptions: uniqueStatuses.map(status => ({
        label: status,
        value: status,
      })),
    },
    {
      id: "currency",
      accessorKey: "currency",
      header: "Currency",
      cell: ({ getValue }) => {
        const currency = getValue() as any;
        return <div className="text-sm">{currency?.code || currency || "USD"}</div>;
      },
      filterOptions: uniqueCurrencies.map(currency => ({
        label: currency,
        value: currency,
      })),
    },
    {
      id: "principal",
      accessorKey: "principal",
      header: "Principal",
      cell: ({ getValue, row }) => {
        const amount = parseFloat(getValue());
        const currency = row.original.currency || "USD";
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency,
        }).format(amount);
        return <div className="text-right font-medium">{formatted}</div>;
      },
    },
    {
      id: "outstandingBalance",
      accessorKey: "outstandingBalance",
      header: "Outstanding",
      cell: ({ getValue, row }) => {
        const amount = parseFloat(getValue());
        const currency = row.original.currency || "USD";
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency,
        }).format(amount);
        return <div className="text-right font-medium">{formatted}</div>;
      },
    },
    {
      id: "daysInArrears",
      accessorKey: "daysInArrears",
      header: "Days in Arrears",
      cell: ({ getValue }) => {
        const days = getValue() as number;
        if (days === 0) {
          return <div className="text-right text-green-600">Current</div>;
        }
        return (
          <div
            className={`text-right ${
              days > 30 ? "text-red-600" : "text-yellow-600"
            }`}
          >
            {days} days
          </div>
        );
      },
    },
    {
      id: "approvedOnDate",
      accessorKey: "approvedOnDate",
      header: "Approved",
      cell: ({ getValue }) => {
        const date = getValue() as string;
        return <div className="text-sm">{formatDate(date)}</div>;
      },
    },
    {
      id: "maturityDate",
      accessorKey: "maturityDate",
      header: "Maturity",
      cell: ({ getValue }) => {
        const date = getValue() as string;
        return <div className="text-sm">{formatDate(date)}</div>;
      },
    },
  ];

  return (
    <GenericDataTable
      data={data}
      columns={columns}
      searchPlaceholder="Search loans..."
      searchColumn="clientName"
      enableSelection={true}
      enablePagination={true}
      enableColumnVisibility={false}
      enableExport={true}
      enableFilters={true}
      pageSize={10}
      tableId="loans-table"
      onRowClick={handleRowClick}
      exportFileName="loans-export"
      emptyMessage="No loans found."
      customFilters={customFilters}
      onFilterChange={setCustomFilters}
    />
  );
}

// Helper functions
function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "active":
    case "approved":
      return "bg-green-100 text-green-800 border-green-200";
    case "pending":
    case "submitted":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "rejected":
    case "cancelled":
      return "bg-red-100 text-red-800 border-red-200";
    case "disbursed":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "overdue":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function formatDate(dateString: string): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}
