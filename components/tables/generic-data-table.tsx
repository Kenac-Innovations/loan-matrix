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
  PaginationState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  DataTableColumn,
  DataTableFilter,
  DataTableProps
} from "@/shared/types/data-table";

// Export utility functions
const exportToCSV = <TData,>(data: TData[], columns: DataTableColumn<TData>[], filename: string) => {
  try {
    const headers = columns.map(col => col.header).join(",");
    const rows = data.map(item =>
      columns.map(col => {
        const value = col.accessorKey ? (item as any)[col.accessorKey] : "";
        if (value === null || value === undefined) return "";
        const str = String(value);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    );

    const csvContent = `${headers}\n${rows.join("\n")}`;
    const dataBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting CSV:", error);
    throw new Error("Failed to export CSV");
  }
};

const exportToPDF = async <TData,>(data: TData[], columns: DataTableColumn<TData>[], filename: string) => {
  try {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = await import('jspdf-autotable');

    const pdf = new jsPDF('l', 'mm', 'a4');

    // Add header
    pdf.setFillColor(30, 64, 175);
    pdf.rect(0, 0, 297, 30, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Data Export', 148, 12, { align: 'center' });
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 148, 20, { align: 'center' });

    // Prepare table data
    const headers = columns.map(col => String(col.header));
    const rows = data.map(item =>
      columns.map(col => {
        const value = col.accessorKey ? (item as any)[col.accessorKey] : "";
        return value === null || value === undefined ? "" : String(value);
      })
    );

    // Reset text color
    pdf.setTextColor(0, 0, 0);

    // Add table
    autoTable.default(pdf, {
      head: [headers],
      body: rows,
      startY: 40,
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [30, 64, 175],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    pdf.save(`${filename}-${new Date().toISOString().split("T")[0]}.pdf`);
  } catch (error) {
    console.error("Error exporting PDF:", error);
    throw new Error("Failed to export PDF");
  }
};

export function GenericDataTable<TData>({
  data,
  columns,
  searchPlaceholder = "Search...",
  searchColumn,
  enableSelection = false,
  enablePagination = true,
  enableColumnVisibility = true,
  enableExport = true,
  enableFilters = true,
  pageSize = 10,
  tableId = "generic-table",
  onRowClick,
  onSelectionChange,
  exportFileName = "data-export",
  className = "",
  emptyMessage = "No results found.",
  customFilters = [],
  onFilterChange,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });
  const [isExporting, setIsExporting] = React.useState(false);

  // Apply custom filters to data
  const filteredData = React.useMemo(() => {
    if (!enableFilters || customFilters.length === 0) {
      return data;
    }

    return data.filter((item) => {
      return customFilters.every((filter) => {
        if (!filter.value || filter.value === "" || filter.value === "all") {
          return true;
        }

        const column = columns.find(col => col.id === filter.columnId);
        if (!column) return true;

        const itemValue = column.accessorKey ? (item as any)[column.accessorKey] : null;
        
        switch (filter.type) {
          case "select":
            if (typeof itemValue === 'object' && itemValue !== null) {
              // Handle complex objects like {value: "active", code: "USD"}
              const objValue = itemValue as any;
              return objValue.value === filter.value || 
                     objValue.code === filter.value ||
                     objValue.id === filter.value ||
                     String(itemValue) === filter.value;
            }
            // Handle string values
            return String(itemValue) === filter.value;
          
          case "number":
            const numValue = parseFloat(String(filter.value));
            const itemNumValue = parseFloat(String(itemValue));
            return !isNaN(numValue) && !isNaN(itemNumValue) && itemNumValue >= numValue;
          
          case "text":
          default:
            if (typeof itemValue === 'object' && itemValue !== null) {
              // For text search in objects, search in common properties
              const objValue = itemValue as any;
              const searchTerm = String(filter.value).toLowerCase();
              return String(objValue.value || objValue.code || objValue.name || objValue).toLowerCase().includes(searchTerm);
            }
            return String(itemValue).toLowerCase().includes(String(filter.value).toLowerCase());
        }
      });
    });
  }, [data, customFilters, columns, enableFilters]);

  const tableColumns: ColumnDef<TData>[] = React.useMemo(() => {
    const cols: ColumnDef<TData>[] = [];

    if (enableSelection) {
      cols.push({
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
      });
    }

    // Add data columns
    columns.forEach((col) => {
      cols.push({
        id: col.id,
        accessorKey: col.accessorKey as string,
        header: ({ column }) => {
          if (col.enableSorting === false) {
            return (
              <span className="text-xs sm:text-sm font-medium">
                {col.header}
              </span>
            );
          }

          return (
            <Button
              variant="ghost"
              className="h-8 px-1 sm:px-2 lg:px-3 w-full justify-start sm:justify-center"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              <span className="text-xs sm:text-sm truncate">{col.header}</span>
              <ArrowUpDown className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            </Button>
          );
        },
        cell: ({ getValue, row, column }) => {
          if (col.cell) {
            return col.cell({ getValue, row, column: { id: column.id } });
          }
          const value = getValue();
          return (
            <span className="text-xs sm:text-sm truncate">
              {String(value || "")}
            </span>
          );
        },
        enableSorting: col.enableSorting !== false,
        enableHiding: col.enableHiding !== false,
        meta: col.meta,
      });
    });

    return cols;
  }, [columns, enableSelection]);

  // Handle row selection changes
  React.useEffect(() => {
    if (onSelectionChange && enableSelection) {
      const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
      onSelectionChange(selectedRows);
    }
  }, [rowSelection, onSelectionChange, enableSelection]);

  // Initialize table
  const table = useReactTable({
    data: filteredData,
    columns: tableColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination: enablePagination ? pagination : undefined,
    },
    enableRowSelection: enableSelection,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
  });

  // Export handlers
  const handleExportCSV = React.useCallback(() => {
    try {
      setIsExporting(true);
      const exportData = table.getFilteredRowModel().rows.map(row => row.original);
      exportToCSV(exportData, columns, exportFileName);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  }, [table, columns, exportFileName]);

  const handleExportPDF = React.useCallback(async () => {
    try {
      setIsExporting(true);
      const exportData = table.getFilteredRowModel().rows.map(row => row.original);
      await exportToPDF(exportData, columns, exportFileName);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  }, [table, columns, exportFileName]);

  // Render filter inputs
  const renderFilters = () => {
    if (!enableFilters || customFilters.length === 0) return null;

    return (
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
        {customFilters.map((filter) => {
          const column = columns.find(col => col.id === filter.columnId);
          if (!column) return null;

          switch (filter.type) {
            case "select":
              return (
                <div key={filter.columnId} className="flex items-center gap-2">
                  <Label htmlFor={filter.columnId} className="text-sm font-medium whitespace-nowrap">
                    {column.header}:
                  </Label>
                  <Select
                    value={String(filter.value)}
                    onValueChange={(value: string) => {
                      const newFilters = customFilters.map(f =>
                        f.columnId === filter.columnId ? { ...f, value } : f
                      );
                      onFilterChange?.(newFilters);
                    }}
                  >
                    <SelectTrigger className="w-40 h-9">
                      <SelectValue placeholder={`All ${column.header}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All {column.header}</SelectItem>
                      {column.filterOptions?.map((option) => (
                        <SelectItem key={String(option.value)} value={String(option.value)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );

            case "number":
              return (
                <div key={filter.columnId} className="flex items-center gap-2">
                  <Label htmlFor={filter.columnId} className="text-sm font-medium whitespace-nowrap">
                    {column.header}:
                  </Label>
                  <Input
                    id={filter.columnId}
                    type="number"
                    placeholder="Filter..."
                    value={String(filter.value)}
                    onChange={(e) => {
                      const newFilters = customFilters.map(f =>
                        f.columnId === filter.columnId ? { ...f, value: e.target.value } : f
                      );
                      onFilterChange?.(newFilters);
                    }}
                    className="w-32 h-9"
                  />
                </div>
              );

            default:
              return (
                <div key={filter.columnId} className="flex items-center gap-2">
                  <Label htmlFor={filter.columnId} className="text-sm font-medium whitespace-nowrap">
                    {column.header}:
                  </Label>
                  <Input
                    id={filter.columnId}
                    placeholder={`Filter ${column.header}...`}
                    value={String(filter.value)}
                    onChange={(e) => {
                      const newFilters = customFilters.map(f => 
                        f.columnId === filter.columnId ? { ...f, value: e.target.value } : f
                      );
                      onFilterChange?.(newFilters);
                    }}
                    className="w-40 h-9"
                  />
                </div>
              );
          }
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const clearedFilters = customFilters.map(f => ({ ...f, value: "" }));
            onFilterChange?.(clearedFilters);
          }}
          className="h-9"
        >
          <X className="mr-2 h-4 w-4" />
          Clear Filters
        </Button>
      </div>
    );
  };

  return (
    <div className={`w-full flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4 lg:flex-1">
            {/* Global search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter ?? ""}
                onChange={(event) => setGlobalFilter(String(event.target.value))}
                className="pl-10 h-9"
              />
            </div>

            {/* Custom filters */}
            <div className="flex-1">
              {renderFilters()}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Export dropdown */}
            {enableExport && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isExporting} className="h-9">
                    <Download className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Export</span>
                    <span className="sm:hidden">Export</span>
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Export Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <FileText className="mr-2 h-4 w-4" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <FileText className="mr-2 h-4 w-4" />
                    Export as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Column visibility */}
            {enableColumnVisibility && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <Filter className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Columns</span>
                    <span className="sm:hidden">Columns</span>
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
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
            )}
          </div>
        </div>
      </div>

      {/* Table Container - Single scroll container */}
      <div className="flex-1 min-h-0 rounded-md border overflow-visible">
        <Table className="min-w-full">
          <TableHeader className="sticky top-0 bg-background z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead
                      key={header.id}
                      className="whitespace-nowrap px-3 py-3 text-sm font-medium bg-muted/50"
                    >
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
                  className={`${onRowClick ? "cursor-pointer hover:bg-muted/50" : ""} transition-colors`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="px-3 py-3 text-sm"
                      onClick={(e) => {
                        // Prevent row click when clicking on interactive elements
                        if (cell.column.id === "select" || cell.column.id === "actions") {
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
                  colSpan={tableColumns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination and selection info */}
      <div className="flex-shrink-0 mt-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm text-muted-foreground">
            {enableSelection && (
              <span>
                {table.getFilteredSelectedRowModel().rows.length} of{" "}
                {table.getFilteredRowModel().rows.length} row(s) selected.
              </span>
            )}
          </div>

          {enablePagination && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Rows per page</p>
                <Select
                  value={`${table.getState().pagination.pageSize}`}
                  onValueChange={(value) => {
                    table.setPageSize(Number(value));
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue placeholder={table.getState().pagination.pageSize} />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 30, 40, 50].map((pageSize) => (
                      <SelectItem key={pageSize} value={`${pageSize}`}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center text-sm font-medium">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Go to first page</span>
                  <ChevronFirst className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Go to previous page</span>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Go to next page</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-8 w-8 p-0"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Go to last page</span>
                  <ChevronLast className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Export the utility functions for external use
export { exportToCSV, exportToPDF };
