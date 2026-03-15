import { ReactNode } from "react";

/**
 * Base interface for data table columns
 */
export interface DataTableColumn<TData = any> {
  /** Unique identifier for the column */
  id: string;
  
  /** Column header content */
  header: string | ReactNode;
  
  /** Key to access data from the row object */
  accessorKey?: keyof TData;

  /** Optional: return a string/number for CSV/PDF export (avoids [object Object] when value is an object) */
  getExportValue?: (item: TData) => string | number;
  
  /** Custom cell renderer function */
  cell?: (info: {
    getValue: () => any;
    row: { original: TData };
    column: { id: string };
  }) => ReactNode;
  
  /** Whether the column can be sorted */
  enableSorting?: boolean;
  
  /** Whether the column can be hidden */
  enableHiding?: boolean;
  
  /** Type of filter for this column */
  filterType?: "text" | "select" | "date" | "number" | "boolean";
  
  /** Options for select filters */
  filterOptions?: Array<{
    label: string;
    value: string | number | boolean;
  }>;
  
  /** Additional metadata for styling and behavior */
  meta?: {
    className?: string;
    align?: "left" | "center" | "right";
    width?: number | string;
  };
}

/**
 * Interface for custom table filters
 */
export interface DataTableFilter {
  /** Column ID to filter */
  columnId: string;
  
  /** Filter value */
  value: string | number | boolean;
  
  /** Type of filter */
  type: "text" | "select" | "date" | "number" | "boolean";
}

/**
 * Main props interface for the Generic Data Table
 */
export interface DataTableProps<TData = any> {
  /** Array of data to display */
  data: TData[];
  
  /** Column definitions */
  columns: DataTableColumn<TData>[];
  
  /** Placeholder text for global search */
  searchPlaceholder?: string;
  
  /** Specific column to search in */
  searchColumn?: string;
  
  /** Enable row selection */
  enableSelection?: boolean;
  
  /** Enable pagination */
  enablePagination?: boolean;
  
  /** Enable column visibility toggle */
  enableColumnVisibility?: boolean;
  
  /** Enable export functionality */
  enableExport?: boolean;
  
  /** Enable custom filters */
  enableFilters?: boolean;
  
  /** Hide the search bar */
  hideSearch?: boolean;
  
  /** Custom search input to replace the default search */
  customSearchInput?: React.ReactNode;
  
  /** Info text to show below search (e.g., search result count) */
  searchResultInfo?: string;
  
  /** Number of rows per page */
  pageSize?: number;
  
  /** Unique identifier for the table (used for localStorage) */
  tableId?: string;
  
  /** Callback when a row is clicked */
  onRowClick?: (row: TData) => void;
  
  /** Callback when row selection changes */
  onSelectionChange?: (selectedRows: TData[]) => void;
  
  /** Base filename for exports */
  exportFileName?: string;
  
  /** Additional CSS classes */
  className?: string;
  
  /** Message to display when no data is available */
  emptyMessage?: string;
  
  /** Custom filters configuration */
  customFilters?: DataTableFilter[];
  
  /** Callback when filters change */
  onFilterChange?: (filters: DataTableFilter[]) => void;

  /** Default sorting state (column id and direction) */
  defaultSorting?: Array<{
    id: string;
    desc: boolean;
  }>;

  /** External search value (controlled from parent) */
  externalSearch?: string;

  /** Callback when search value changes (for server-side search) */
  onSearchChange?: (value: string) => void;

  /** Loading state for async operations */
  isLoading?: boolean;

  /** Custom actions to render in the table header */
  headerActions?: React.ReactNode;
}

/**
 * Export configuration options
 */
export interface ExportOptions {
  /** Include only selected rows */
  selectedRowsOnly?: boolean;
  
  /** Custom filename */
  filename?: string;
  
  /** Include headers in export */
  includeHeaders?: boolean;
}

/**
 * Table state interface for advanced usage
 */
export interface DataTableState {
  /** Current sorting state */
  sorting: Array<{
    id: string;
    desc: boolean;
  }>;
  
  /** Current column filters */
  columnFilters: Array<{
    id: string;
    value: any;
  }>;
  
  /** Column visibility state */
  columnVisibility: Record<string, boolean>;
  
  /** Row selection state */
  rowSelection: Record<string, boolean>;
  
  /** Global filter value */
  globalFilter: string;
  
  /** Pagination state */
  pagination: {
    pageIndex: number;
    pageSize: number;
  };
}

/**
 * Utility type for extracting data type from columns
 */
export type ExtractDataType<T> = T extends DataTableColumn<infer U>[] ? U : never;

/**
 * Column helper type for creating typed columns
 */
export interface ColumnHelper<TData> {
  accessor: <TKey extends keyof TData>(
    accessor: TKey,
    column?: Partial<DataTableColumn<TData>>
  ) => DataTableColumn<TData>;
  
  display: (
    id: string,
    column?: Partial<DataTableColumn<TData>>
  ) => DataTableColumn<TData>;
}

/**
 * Table action types
 */
export type TableAction = 
  | "sort"
  | "filter" 
  | "select"
  | "export"
  | "paginate"
  | "search"
  | "visibility";

/**
 * Export format types
 */
export type ExportFormat = "csv" | "pdf" | "excel";

/**
 * Sort direction types
 */
export type SortDirection = "asc" | "desc" | false;

/**
 * Filter operator types
 */
export type FilterOperator = 
  | "equals"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "greaterThan"
  | "lessThan"
  | "between"
  | "in";

/**
 * Advanced filter configuration
 */
export interface AdvancedFilter extends DataTableFilter {
  /** Filter operator */
  operator?: FilterOperator;
  
  /** Second value for between operator */
  value2?: string | number;
  
  /** Case sensitivity for text filters */
  caseSensitive?: boolean;
}
