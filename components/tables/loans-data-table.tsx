"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronDown, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

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
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = React.useState<string>("all");
  const [minAmount, setMinAmount] = React.useState<string>("");
  const [maxAmount, setMaxAmount] = React.useState<string>("");

  const handleRowClick = (loan: Loan) => {
    // Execute the view action - navigate to client loan detail page
    if (loan.clientId) {
      window.location.href = `/clients/${loan.clientId}/loans/${loan.id}`;
    }
  };

  // Get unique values for filter options
  const uniqueStatuses = React.useMemo(() => {
    const statuses = data
      .map((loan) => loan.status?.value || loan.status)
      .filter(Boolean);
    return Array.from(new Set(statuses));
  }, [data]);

  const uniqueCurrencies = React.useMemo(() => {
    const currencies = data.map((loan) => loan.currency?.code).filter(Boolean);
    return Array.from(new Set(currencies));
  }, [data]);

  // Apply custom filters
  const filteredData = React.useMemo(() => {
    return data.filter((loan) => {
      // Status filter
      if (statusFilter !== "all") {
        const loanStatus = loan.status?.value || loan.status;
        if (loanStatus !== statusFilter) return false;
      }

      // Currency filter
      if (currencyFilter !== "all") {
        if (loan.currency?.code !== currencyFilter) return false;
      }

      // Amount range filter
      if (minAmount) {
        const min = parseFloat(minAmount);
        if (!isNaN(min) && (loan.principal || 0) < min) return false;
      }

      if (maxAmount) {
        const max = parseFloat(maxAmount);
        if (!isNaN(max) && (loan.principal || 0) > max) return false;
      }

      return true;
    });
  }, [data, statusFilter, currencyFilter, minAmount, maxAmount]);

  const columns: ColumnDef<Loan>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            ID
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("id")}</div>
      ),
    },
    {
      accessorKey: "accountNo",
      header: "Account #",
      cell: ({ row }) => (
        <div className="font-mono text-sm">{row.getValue("accountNo")}</div>
      ),
    },
    {
      accessorKey: "clientName",
      header: "Client",
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("clientName")}</div>
      ),
    },
    {
      accessorKey: "productName",
      header: "Product",
      cell: ({ row }) => (
        <div className="max-w-[200px] truncate">
          {row.getValue("productName")}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const statusColor = getStatusColor(status);
        return (
          <Badge variant="outline" className={statusColor}>
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "principal",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Principal
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("principal"));
        const currency = row.original.currency || "USD";
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency,
        }).format(amount);
        return <div className="text-right font-medium">{formatted}</div>;
      },
    },
    {
      accessorKey: "outstandingBalance",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Outstanding
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("outstandingBalance"));
        const currency = row.original.currency || "USD";
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency,
        }).format(amount);
        return <div className="text-right font-medium">{formatted}</div>;
      },
    },
    {
      accessorKey: "daysInArrears",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Days in Arrears
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const days = row.getValue("daysInArrears") as number;
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
      accessorKey: "approvedOnDate",
      header: "Approved",
      cell: ({ row }) => {
        const date = row.getValue("approvedOnDate") as string;
        return <div className="text-sm">{formatDate(date)}</div>;
      },
    },
    {
      accessorKey: "maturityDate",
      header: "Maturity",
      cell: ({ row }) => {
        const date = row.getValue("maturityDate") as string;
        return <div className="text-sm">{formatDate(date)}</div>;
      },
    },
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 py-4 flex-wrap">
        <Input
          placeholder="Filter by client name..."
          value={
            (table.getColumn("clientName")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("clientName")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />

        <div className="flex items-center gap-2">
          <Label htmlFor="status-filter">Status:</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {uniqueStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="currency-filter">Currency:</Label>
          <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="All currencies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All currencies</SelectItem>
              {uniqueCurrencies.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="min-amount">Min:</Label>
          <Input
            id="min-amount"
            type="number"
            placeholder="0"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className="w-24"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="max-amount">Max:</Label>
          <Input
            id="max-amount"
            type="number"
            placeholder="∞"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            className="w-24"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setStatusFilter("all");
            setCurrencyFilter("all");
            setMinAmount("");
            setMaxAmount("");
            table.getColumn("clientName")?.setFilterValue("");
          }}
        >
          <Filter className="mr-2 h-4 w-4" />
          Clear
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      onClick={(e) => {
                        // Prevent row click when clicking on interactive elements
                        if (
                          cell.column.id === "select" ||
                          cell.column.id === "actions"
                        ) {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
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
