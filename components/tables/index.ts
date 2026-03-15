// Export the main generic data table component
export { GenericDataTable, exportToCSV, exportToPDF } from "./generic-data-table";

// Export existing table components
export { LoansDataTable } from "./loans-data-table";

// Re-export types for convenience
export type {
  DataTableColumn,
  DataTableFilter,
  DataTableProps,
  ExportOptions,
  DataTableState,
  AdvancedFilter,
} from "@/shared/types/data-table";
