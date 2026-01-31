"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CalendarIcon,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  AlertCircle,
  FileEdit,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { GenericDataTable, DataTableColumn } from "@/components/tables/generic-data-table";
import { formatCurrency } from "@/lib/format-currency";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DateRange {
  from: Date;
  to: Date;
}

interface ReportData {
  report: string;
  reportName: string;
  startDate: string;
  endDate: string;
  count: number;
  data: any[];
  rawColumnHeaders?: string[];
  error?: string;
}

interface TabConfig {
  id: string;
  label: string;
  report: string;
  bgColor: string;
  activeBg: string;
  inactiveText: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  {
    id: "drafts",
    label: "Drafts",
    report: "drafts",
    bgColor: "bg-gray-500 dark:bg-gray-600",
    activeBg: "data-[state=active]:bg-gray-500 dark:data-[state=active]:bg-gray-600",
    inactiveText: "text-gray-700 dark:text-gray-400",
    icon: <FileEdit className="h-4 w-4" />,
  },
  {
    id: "pending",
    label: "Pending Approval",
    report: "pending",
    bgColor: "bg-yellow-500 dark:bg-yellow-600",
    activeBg: "data-[state=active]:bg-yellow-500 dark:data-[state=active]:bg-yellow-600",
    inactiveText: "text-yellow-700 dark:text-yellow-400",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    id: "approved",
    label: "Approved",
    report: "approved",
    bgColor: "bg-blue-500 dark:bg-blue-600",
    activeBg: "data-[state=active]:bg-blue-500 dark:data-[state=active]:bg-blue-600",
    inactiveText: "text-blue-700 dark:text-blue-400",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  {
    id: "rejected",
    label: "Rejected",
    report: "rejected",
    bgColor: "bg-red-500 dark:bg-red-600",
    activeBg: "data-[state=active]:bg-red-500 dark:data-[state=active]:bg-red-600",
    inactiveText: "text-red-700 dark:text-red-400",
    icon: <XCircle className="h-4 w-4" />,
  },
];

// Auto-refresh interval (10 seconds)
const REFRESH_INTERVAL = 10000;

// Helper component for date range label
function DateRangeLabel({ dateRange }: { dateRange: DateRange }) {
  if (!dateRange.to) {
    return <>{format(dateRange.from, "MMM d, yyyy")}</>;
  }
  
  return (
    <>
      {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
    </>
  );
}

export function LeadsStatusTabs() {
  const [activeTab, setActiveTab] = useState("drafts");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [tabData, setTabData] = useState<Record<string, ReportData | null>>({
    drafts: null,
    pending: null,
    approved: null,
    rejected: null,
  });
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({
    drafts: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({
    drafts: false,
    pending: false,
    approved: false,
    rejected: false,
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({
    drafts: null,
    pending: null,
    approved: null,
    rejected: null,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Filter states for each tab
  const [filters, setFilters] = useState<Record<string, { branch: string; loanProduct: string; submittedBy: string }>>({
    drafts: { branch: "all", loanProduct: "all", submittedBy: "all" },
    pending: { branch: "all", loanProduct: "all", submittedBy: "all" },
    approved: { branch: "all", loanProduct: "all", submittedBy: "all" },
    rejected: { branch: "all", loanProduct: "all", submittedBy: "all" },
  });

  // Extract unique filter options from data
  const getFilterOptions = useCallback((data: any[], key: string): string[] => {
    if (!data || data.length === 0) return [];
    const values = new Set<string>();
    for (const row of data) {
      // Try different column name variations
      const value = row[key] || row[key.toLowerCase()] || row[key.replaceAll(" ", "_").toLowerCase()];
      if (value && value !== "-" && value !== "") {
        values.add(String(value));
      }
    }
    return Array.from(values).sort();
  }, []);

  // Get filter options for each tab
  const tabFilterOptions = useMemo(() => {
    const options: Record<string, { branches: string[]; loanProducts: string[]; submittedBy: string[] }> = {};
    for (const tab of TABS) {
      const data = tabData[tab.report]?.data || [];
      options[tab.report] = {
        branches: getFilterOptions(data, "branch"),
        loanProducts: getFilterOptions(data, "loan_product"),
        submittedBy: getFilterOptions(data, "submitted_by") || getFilterOptions(data, "created_by"),
      };
    }
    return options;
  }, [tabData, getFilterOptions]);

  // Filter data based on selected filters
  const getFilteredData = useCallback((report: string, data: any[]): any[] => {
    if (!data) return [];
    const tabFilters = filters[report];
    
    return data.filter((row) => {
      // Branch filter
      if (tabFilters.branch !== "all") {
        const branch = row.branch || row.Branch || "";
        if (String(branch).toLowerCase() !== tabFilters.branch.toLowerCase()) return false;
      }
      
      // Loan product filter
      if (tabFilters.loanProduct !== "all") {
        const product = row.loan_product || row["Loan Product"] || row.loanProduct || "";
        if (String(product).toLowerCase() !== tabFilters.loanProduct.toLowerCase()) return false;
      }
      
      // Submitted by filter
      if (tabFilters.submittedBy !== "all") {
        const submitter = row.submitted_by || row.created_by || row["Submitted By"] || row["Created By"] || "";
        if (String(submitter).toLowerCase() !== tabFilters.submittedBy.toLowerCase()) return false;
      }
      
      return true;
    });
  }, [filters]);

  // Update filter for a specific tab
  const updateFilter = useCallback((report: string, filterKey: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [report]: {
        ...prev[report],
        [filterKey]: value,
      },
    }));
  }, []);

  // Format date for API
  const formatDateForAPI = (date: Date) => format(date, "yyyy-MM-dd");

  // Fetch report data
  const fetchReport = useCallback(
    async (report: string, showLoader = true) => {
      if (showLoader) {
        setLoading((prev) => ({ ...prev, [report]: true }));
      }
      setErrors((prev) => ({ ...prev, [report]: null }));

      try {
        const params = new URLSearchParams({
          report,
          startDate: formatDateForAPI(dateRange.from),
          endDate: formatDateForAPI(dateRange.to),
        });

        const response = await fetch(`/api/leads/reports?${params}`);
        const data: ReportData = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch report");
        }

        console.log(`Tab ${report} received:`, data.count, "rows, columns:", data.rawColumnHeaders);
        
        setTabData((prev) => ({ ...prev, [report]: data }));
        setTabCounts((prev) => ({ ...prev, [report]: data.count }));
        setLastUpdated(new Date());
      } catch (error) {
        console.error(`Error fetching ${report} report:`, error);
        setErrors((prev) => ({ 
          ...prev, 
          [report]: error instanceof Error ? error.message : "Failed to fetch data" 
        }));
      } finally {
        setLoading((prev) => ({ ...prev, [report]: false }));
      }
    },
    [dateRange]
  );

  // Fetch all counts on mount and when date range changes
  useEffect(() => {
    TABS.forEach((tab) => fetchReport(tab.report));
  }, [dateRange, fetchReport]);

  // Auto-refresh active tab
  useEffect(() => {
    const interval = setInterval(() => {
      fetchReport(activeTab, false); // Silent refresh without loader
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [activeTab, fetchReport]);

  // Handle tab change
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    // Fetch fresh data when tab is opened
    fetchReport(tabId);
  };

  // Manual refresh
  const handleRefresh = () => {
    fetchReport(activeTab);
  };

  // Columns to hide from display
  const HIDDEN_COLUMNS = new Set(["lead_id", "loan_id", "client_id", "id", "external_id", "client_external_id"]);

  // Generate columns for the data table
  const generateColumns = useCallback((data: any[]): DataTableColumn<any>[] => {
    if (!data || data.length === 0) return [];
    
    // Filter out hidden columns and internal columns
    const columnKeys = Object.keys(data[0]).filter(
      (col) => !col.startsWith("_") && !HIDDEN_COLUMNS.has(col.toLowerCase())
    );
    
    const columns: DataTableColumn<any>[] = [];

    // Add row number column first
    columns.push({
      id: "rowNumber",
      header: "#",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-xs">
          {row.index + 1}
        </span>
      ),
    });

    // Add data columns
    for (const col of columnKeys) {
      columns.push({
        id: col,
        header: formatColumnHeader(col),
        accessorKey: col as keyof any,
        cell: ({ getValue }) => formatCellValue(col, getValue()),
        enableSorting: true,
      });
    }

    // Add action column
    columns.push({
      id: "actions",
      header: "Action",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => {
        const rowData = row.original;
        if (rowData.loan_account || rowData.lead_id) {
          return (
            <Link
              href={rowData.lead_id ? `/leads/new?id=${rowData.lead_id}` : `/leads?search=${rowData.loan_account}`}
              className="text-primary hover:text-primary/80 transition-colors inline-flex"
              title={rowData.lead_id ? "Continue draft" : `View loan ${rowData.loan_account}`}
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          );
        }
        return null;
      },
    });

    return columns;
  }, []);

  // Memoize columns for each tab
  const tabColumns = useMemo(() => {
    const columns: Record<string, DataTableColumn<any>[]> = {};
    for (const tab of TABS) {
      const data = tabData[tab.report];
      columns[tab.report] = data?.data ? generateColumns(data.data) : [];
    }
    return columns;
  }, [tabData, generateColumns]);

  // Render data table for a tab
  const renderTable = (report: string) => {
    const data = tabData[report];
    const isLoading = loading[report];
    const error = errors[report];
    const columns = tabColumns[report];

    if (isLoading && !data) {
      return (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-destructive">
          <AlertCircle className="h-12 w-12 mb-4" />
          <p className="font-medium">Error loading data</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => fetchReport(report)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      );
    }

    if (!data || data.data.length === 0) {
      return (
        <div className="text-center py-16 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No records found for the selected date range.</p>
          <p className="text-sm mt-2">
            {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
          </p>
        </div>
      );
    }

    const filteredData = getFilteredData(report, data.data);
    const filterOpts = tabFilterOptions[report];
    const tabFilters = filters[report];

    return (
      <div className="space-y-4">
        {/* Smart Filters */}
        <div className="flex flex-wrap gap-3 p-3 bg-muted/30 dark:bg-muted/10 rounded-lg border dark:border-border">
          {/* Branch Filter */}
          {filterOpts.branches.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Branch:</span>
              <Select
                value={tabFilters.branch}
                onValueChange={(value) => updateFilter(report, "branch", value)}
              >
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {filterOpts.branches.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Loan Product Filter */}
          {filterOpts.loanProducts.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Product:</span>
              <Select
                value={tabFilters.loanProduct}
                onValueChange={(value) => updateFilter(report, "loanProduct", value)}
              >
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {filterOpts.loanProducts.map((product) => (
                    <SelectItem key={product} value={product}>
                      {product}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Submitted By Filter */}
          {filterOpts.submittedBy.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Submitted By:</span>
              <Select
                value={tabFilters.submittedBy}
                onValueChange={(value) => updateFilter(report, "submittedBy", value)}
              >
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {filterOpts.submittedBy.map((user) => (
                    <SelectItem key={user} value={user}>
                      {user}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Filter count indicator */}
          {(tabFilters.branch !== "all" || tabFilters.loanProduct !== "all" || tabFilters.submittedBy !== "all") && (
            <div className="flex items-center gap-2 ml-auto">
              <Badge variant="secondary" className="text-xs">
                {filteredData.length} of {data.data.length} records
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setFilters((prev) => ({
                  ...prev,
                  [report]: { branch: "all", loanProduct: "all", submittedBy: "all" },
                }))}
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>

        <GenericDataTable
          data={filteredData}
          columns={columns}
          tableId={`leads-${report}-table`}
          searchPlaceholder="Search records..."
          enablePagination={true}
          enableColumnVisibility={true}
          enableExport={true}
          pageSize={20}
          exportFileName={`leads-${report}-${format(dateRange.from, "yyyy-MM-dd")}`}
          emptyMessage="No records found for the selected filters."
          isLoading={isLoading}
        />
      </div>
    );
  };

  return (
    <Card className="border dark:border-border">
      <CardHeader className="border-b dark:border-border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>Loan Applications</CardTitle>
            <CardDescription>
              View loan applications by status for the selected period
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Date Range Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal min-w-[240px]",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  <DateRangeLabel dateRange={dateRange} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => {
                    if (range?.from) {
                      setDateRange({
                        from: range.from,
                        to: range.to || range.from,
                      });
                    }
                  }}
                  numberOfMonths={2}
                />
                {/* Quick date presets */}
                <div className="border-t dark:border-border p-3 flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      setDateRange({
                        from: startOfDay(today),
                        to: endOfDay(today),
                      });
                    }}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const weekAgo = new Date(today);
                      weekAgo.setDate(today.getDate() - 7);
                      setDateRange({
                        from: startOfDay(weekAgo),
                        to: endOfDay(today),
                      });
                    }}
                  >
                    Last 7 days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                      setDateRange({
                        from: startOfDay(monthStart),
                        to: endOfDay(today),
                      });
                    }}
                  >
                    This month
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={loading[activeTab]}
            >
              <RefreshCw
                className={cn("h-4 w-4", loading[activeTab] && "animate-spin")}
              />
            </Button>
          </div>
        </div>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground mt-2">
            Last updated: {format(lastUpdated, "HH:mm:ss")} • Auto-refreshes every 10s
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-4 mb-4 h-auto bg-muted/50 dark:bg-muted/30 p-1 rounded-lg">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={cn(
                  "py-3 px-4 rounded-md transition-all duration-200",
                  "data-[state=active]:text-white data-[state=active]:shadow-md",
                  "data-[state=inactive]:hover:bg-muted dark:data-[state=inactive]:hover:bg-muted/50",
                  tab.activeBg,
                  activeTab !== tab.id && tab.inactiveText
                )}
              >
                <div className="flex items-center gap-2">
                  {tab.icon}
                  <span className="hidden sm:inline font-medium">{tab.label}</span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-1 transition-colors min-w-[28px] justify-center",
                      activeTab === tab.id
                        ? "bg-white/25 text-white border-white/20"
                        : "bg-background dark:bg-background/50 text-foreground"
                    )}
                  >
                    {loading[tab.id] && !tabData[tab.id] ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      String(tabCounts[tab.id])
                    )}
                  </Badge>
                </div>
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-0">
              {renderTable(tab.report)}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Helper to format column headers (snake_case to Title Case)
function formatColumnHeader(col: string): string {
  return col
    .replaceAll("_", " ")
    .replaceAll(/\b\w/g, (l) => l.toUpperCase());
}

// Number formatters for international format
const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// Column patterns for different formatting
const CURRENCY_PATTERNS = [
  "amount", 
  "principal", 
  "balance", 
  "fee", 
  "charge", 
  "disbursed", 
  "repaid", 
  "outstanding",
  "total",
  "payment",
  "arrears",
  "due",
  "paid",
  "penalty",
  "waived",
  "written_off",
  "overdue",
];
const PERCENTAGE_PATTERNS = ["interest_rate", "rate_", "_rate", "percent", "%"];
const SKIP_NUMBER_FORMAT_PATTERNS = ["id", "account", "phone", "mobile"];
const PHONE_PATTERNS = ["phone", "mobile", "cell", "tel"];

function isCurrencyColumn(colLower: string): boolean {
  // If it has "amount" anywhere, it's currency (even interest_amount)
  if (colLower.includes("amount")) return true;
  // Check for currency patterns but exclude percentage columns
  if (isPercentageColumn(colLower)) return false;
  return CURRENCY_PATTERNS.some(pattern => colLower.includes(pattern));
}

function isPercentageColumn(colLower: string): boolean {
  // If it has "amount", it's not a percentage
  if (colLower.includes("amount")) return false;
  return PERCENTAGE_PATTERNS.some(pattern => colLower.includes(pattern));
}

function shouldSkipNumberFormat(colLower: string): boolean {
  return SKIP_NUMBER_FORMAT_PATTERNS.some(pattern => colLower.includes(pattern));
}

function isPhoneColumn(colLower: string): boolean {
  return PHONE_PATTERNS.some(pattern => colLower.includes(pattern));
}

function formatPhoneNumber(value: any): string {
  if (!value) return "-";
  
  let phone = String(value).replaceAll(/\D/g, ""); // Remove non-digits
  
  // Already has country code
  if (phone.startsWith("260")) {
    return `+${phone.slice(0, 3)} ${phone.slice(3, 5)} ${phone.slice(5)}`;
  }
  
  // Local number starting with 0
  if (phone.startsWith("0") && phone.length >= 10) {
    phone = "260" + phone.slice(1);
    return `+${phone.slice(0, 3)} ${phone.slice(3, 5)} ${phone.slice(5)}`;
  }
  
  // 9-digit number without leading 0
  if (phone.length === 9) {
    phone = "260" + phone;
    return `+${phone.slice(0, 3)} ${phone.slice(3, 5)} ${phone.slice(5)}`;
  }
  
  // Return as-is if format is unclear
  return String(value);
}

function formatDate(value: any): React.ReactNode | null {
  // Handle Fineract date arrays [year, month, day]
  if (Array.isArray(value) && value.length === 3) {
    const [year, month, day] = value;
    return <span className="text-muted-foreground">{format(new Date(year, month - 1, day), "MMM d, yyyy")}</span>;
  }
  // Handle ISO date strings
  if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
    return <span className="text-muted-foreground">{format(new Date(value), "MMM d, yyyy")}</span>;
  }
  return null;
}

// Helper to get badge color based on status/stage value
function getBadgeColor(value: string): string {
  // Approved/Success states - Green
  if (value.includes("approved") || value.includes("success") || value.includes("complete") || 
      value.includes("active") || value.includes("disbursed") || value.includes("paid")) {
    return "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400";
  }
  
  // Pending/Warning states - Yellow/Amber
  if (value.includes("pending") || value.includes("waiting") || value.includes("review") ||
      value.includes("submitted") || value.includes("processing")) {
    return "border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400";
  }
  
  // Rejected/Error states - Red
  if (value.includes("rejected") || value.includes("failed") || value.includes("cancelled") ||
      value.includes("declined") || value.includes("overdue") || value.includes("written")) {
    return "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
  }
  
  // Draft/New states - Gray
  if (value.includes("draft") || value.includes("new") || value.includes("created")) {
    return "border-gray-500 bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  }
  
  // In Progress states - Blue
  if (value.includes("progress") || value.includes("ongoing") || value.includes("started") ||
      value.includes("verification") || value.includes("kyc")) {
    return "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
  }
  
  // Default - neutral
  return "border-border";
}

// Helper to strip formatting from number strings (commas, spaces)
function cleanNumberString(value: string): string {
  return value.trim().replaceAll(",", "").replaceAll(" ", "");
}

// Helper to check if value is numeric
function isNumericValue(value: any): boolean {
  if (typeof value === "number") return true;
  if (typeof value === "string") {
    const cleaned = cleanNumberString(value);
    return cleaned !== "" && !Number.isNaN(Number(cleaned));
  }
  return false;
}

// Helper to parse numeric value (handles comma-formatted strings)
function parseNumericValue(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    return Number(cleanNumberString(value));
  }
  return Number.NaN;
}

// Format numeric value based on column type
function formatNumericValue(value: any, colLower: string): React.ReactNode | null {
  if (!isNumericValue(value)) return null;
  
  const num = parseNumericValue(value);
  if (Number.isNaN(num)) return null;
  
  // Currency columns
  if (isCurrencyColumn(colLower)) {
    return <span className="font-medium tabular-nums">{formatCurrency(num, "ZMW")}</span>;
  }
  
  // Percentage columns
  if (isPercentageColumn(colLower)) {
    return <span className="tabular-nums">{currencyFormatter.format(num)}%</span>;
  }
  
  // Skip IDs, accounts, phones
  if (shouldSkipNumberFormat(colLower)) return null;
  
  // Decimals
  if (num % 1 !== 0) {
    return <span className="tabular-nums">{currencyFormatter.format(num)}</span>;
  }
  
  // Large integers
  if (Math.abs(num) >= 1000) {
    return <span className="tabular-nums">{integerFormatter.format(num)}</span>;
  }
  
  return null;
}

// Helper to format cell values
function formatCellValue(column: string, value: any): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">-</span>;
  }

  const colLower = column.toLowerCase();

  // Phone numbers
  if (isPhoneColumn(colLower)) {
    return <span className="tabular-nums">{formatPhoneNumber(value)}</span>;
  }

  // Dates (check before numbers as dates can look numeric)
  if (colLower.includes("date")) {
    const formatted = formatDate(value);
    if (formatted) return formatted;
  }

  // Numeric values (currency, percentage, general numbers)
  const numericFormatted = formatNumericValue(value, colLower);
  if (numericFormatted) return numericFormatted;

  // Status and pipeline stage badges with colors
  if (colLower.includes("status") || colLower.includes("stage") || colLower.includes("pipeline")) {
    const badgeColor = getBadgeColor(String(value).toLowerCase());
    return <Badge variant="outline" className={cn("text-xs", badgeColor)}>{value}</Badge>;
  }

  // Bold for names
  if (colLower.includes("name") || colLower.includes("client")) {
    return <span className="font-medium">{String(value)}</span>;
  }

  return String(value);
}
