"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useCurrency } from "@/contexts/currency-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarIcon,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  DollarSign,
  Users,
  TrendingDown,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { GenericDataTable, DataTableColumn } from "@/components/tables/generic-data-table";
import { formatCurrency } from "@/lib/format-currency";
import Link from "next/link";

interface DateRange {
  from: Date;
  to: Date;
}

interface ExpectedPaymentsTabProps {
  onCountChange: (count: number) => void;
}

function getTenantSlugFromHost(): string {
  if (globalThis.window === undefined) return "goodfellow";
  const host = globalThis.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return "goodfellow";
  if (host.endsWith(".localhost")) return host.replace(".localhost", "") || "goodfellow";
  const parts = host.split(".");
  if (parts.length > 2) return parts[0];
  return "goodfellow";
}

const CURRENCY_PATTERNS = [
  "amount", "principal", "balance", "fee", "charge", "disbursed",
  "repaid", "outstanding", "total", "payment", "arrears", "due",
  "paid", "penalty", "waived", "overdue",
];
const PERCENTAGE_PATTERNS = ["interest_rate", "rate_", "_rate", "percent", "%"];
const SKIP_NUMBER_FORMAT_PATTERNS = ["id", "account", "phone", "mobile"];

const HIDDEN_COLUMNS = new Set(["loan_id", "client_id", "id"]);

const LINK_COLUMNS = new Set(["loan_account"]);

const REFRESH_INTERVAL = 30000;

function parseReportData(reportData: any): any[] {
  if (!reportData) return [];

  if (Array.isArray(reportData) && reportData.length > 0) {
    if (typeof reportData[0] === "object" && !Array.isArray(reportData[0]) && !reportData[0].row) {
      return reportData;
    }
  }

  const { columnHeaders, data } = reportData;

  if (!columnHeaders || !data || !Array.isArray(data)) {
    return [];
  }

  const columns = columnHeaders.map((col: any) => {
    const name = col.columnName || col.name || col;
    return String(name).toLowerCase().replaceAll(" ", "_").replaceAll(/[()%]/g, "");
  });

  return data.map((item: any) => {
    const rowData = item.row || item;
    const obj: Record<string, any> = {};
    columns.forEach((col: string, index: number) => {
      obj[col] = rowData[index];
    });
    return obj;
  });
}

function formatColumnHeader(col: string): string {
  return col.replaceAll("_", " ").replaceAll(/\b\w/g, (l) => l.toUpperCase());
}

function isCurrencyCol(colLower: string): boolean {
  if (colLower.includes("amount")) return true;
  if (PERCENTAGE_PATTERNS.some((p) => colLower.includes(p))) return false;
  return CURRENCY_PATTERNS.some((p) => colLower.includes(p));
}

function isPercentageCol(colLower: string): boolean {
  if (colLower.includes("amount")) return false;
  return PERCENTAGE_PATTERNS.some((p) => colLower.includes(p));
}

function shouldSkipNumberFormat(colLower: string): boolean {
  return SKIP_NUMBER_FORMAT_PATTERNS.some((p) => colLower.includes(p));
}

const currencyFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const integerFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function cleanNumberString(value: string): string {
  return value.trim().replaceAll(",", "").replaceAll(" ", "");
}

function isNumericValue(value: any): boolean {
  if (typeof value === "number") return true;
  if (typeof value === "string") {
    const cleaned = cleanNumberString(value);
    return cleaned !== "" && !Number.isNaN(Number(cleaned));
  }
  return false;
}

function parseNumericValue(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(cleanNumberString(value));
  return Number.NaN;
}

function formatCellValue(column: string, value: any, currencyCode?: string): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">-</span>;
  }

  const colLower = column.toLowerCase();

  if (colLower.includes("date")) {
    if (Array.isArray(value) && value.length === 3) {
      const [year, month, day] = value;
      return <span className="text-muted-foreground">{format(new Date(year, month - 1, day), "MMM d, yyyy")}</span>;
    }
    if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return <span className="text-muted-foreground">{format(new Date(value), "MMM d, yyyy")}</span>;
    }
  }

  if (isNumericValue(value) && !shouldSkipNumberFormat(colLower)) {
    const num = parseNumericValue(value);
    if (!Number.isNaN(num)) {
      if (isCurrencyCol(colLower)) {
        return <span className="font-medium tabular-nums">{formatCurrency(num, currencyCode)}</span>;
      }
      if (isPercentageCol(colLower)) {
        return <span className="tabular-nums">{currencyFormatter.format(num)}%</span>;
      }
      if (num % 1 !== 0) {
        return <span className="tabular-nums">{currencyFormatter.format(num)}</span>;
      }
      if (Math.abs(num) >= 1000) {
        return <span className="tabular-nums">{integerFormatter.format(num)}</span>;
      }
    }
  }

  if (colLower.includes("status") || colLower.includes("stage")) {
    const valStr = String(value).toLowerCase();
    let badgeClass = "border-border";
    if (valStr.includes("active") || valStr.includes("approved") || valStr.includes("paid")) {
      badgeClass = "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400";
    } else if (valStr.includes("pending") || valStr.includes("submitted")) {
      badgeClass = "border-yellow-500 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400";
    } else if (valStr.includes("overdue") || valStr.includes("arrears")) {
      badgeClass = "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
    }
    return <Badge variant="outline" className={cn("text-xs", badgeClass)}>{value}</Badge>;
  }

  if (colLower.includes("name") || colLower.includes("client")) {
    return <span className="font-medium">{String(value)}</span>;
  }

  return String(value);
}

export function ExpectedPaymentsTab({ onCountChange }: ExpectedPaymentsTabProps) {
  const { currencyCode: orgCurrency } = useCurrency();
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [officeFilter, setOfficeFilter] = useState("all");
  const tenantSlug = getTenantSlugFromHost();

  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  const fetchExpectedPayments = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          reportName: "Expected Payments By Date - Basic",
          R_startDate: format(dateRange.from, "yyyy-MM-dd"),
          R_endDate: format(dateRange.to, "yyyy-MM-dd"),
          R_officeId: "1",
          R_loanOfficerId: "-1",
          locale: "en",
          dateFormat: "yyyy-MM-dd",
        });

        const response = await fetch(`/api/fineract/reports?${params}`, {
          headers: { "x-tenant-slug": tenantSlug },
        });
        const result = await response.json();

        if (!response.ok) throw new Error(result.error || "Failed to fetch report");

        const rows = parseReportData(result);
        setData(rows);
        onCountChangeRef.current(rows.length);
        setLastUpdated(new Date());
      } catch (err) {
        console.error("Error fetching expected payments:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    },
    [dateRange, tenantSlug]
  );

  useEffect(() => {
    fetchExpectedPayments();
  }, [fetchExpectedPayments]);

  useEffect(() => {
    const interval = setInterval(() => fetchExpectedPayments(false), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchExpectedPayments]);

  const columnKeys = useMemo(() => {
    if (data.length === 0) return { amountCol: null, overdueCol: null, clientCol: null, officeCol: null };
    const keys = Object.keys(data[0]);
    const find = (patterns: string[]) =>
      keys.find((k) => {
        const lower = k.toLowerCase();
        return patterns.some((p) => lower.includes(p));
      }) || null;

    return {
      amountCol: find(["total_due", "total_expected", "total", "amount_due", "amount"]),
      overdueCol: find(["total_overdue", "overdue", "arrears", "past_due"]),
      clientCol: find(["client_name", "client", "borrower", "name"]),
      officeCol: find(["office", "branch", "office_name"]),
    };
  }, [data]);

  const offices = useMemo(() => {
    if (!columnKeys.officeCol) return [];
    const set = new Set<string>();
    data.forEach((row) => {
      const office = row[columnKeys.officeCol!];
      if (office) set.add(String(office));
    });
    return Array.from(set).sort();
  }, [data, columnKeys.officeCol]);

  const filteredData = useMemo(() => {
    if (officeFilter === "all" || !columnKeys.officeCol) return data;
    return data.filter((row) => {
      const office = row[columnKeys.officeCol!] || "";
      return String(office).toLowerCase() === officeFilter.toLowerCase();
    });
  }, [data, officeFilter, columnKeys.officeCol]);

  const stats = useMemo(() => {
    let totalAmount = 0;
    let overdueAmount = 0;
    const uniqueClients = new Set<string>();

    filteredData.forEach((row) => {
      if (columnKeys.amountCol) {
        const amount = parseNumericValue(row[columnKeys.amountCol] || 0);
        if (!Number.isNaN(amount)) totalAmount += amount;
      }

      if (columnKeys.overdueCol) {
        const overdue = parseNumericValue(row[columnKeys.overdueCol] || 0);
        if (!Number.isNaN(overdue)) overdueAmount += overdue;
      }

      if (columnKeys.clientCol) {
        const client = row[columnKeys.clientCol];
        if (client) uniqueClients.add(String(client));
      }
    });

    return { totalAmount, overdueAmount, clientCount: uniqueClients.size };
  }, [filteredData, columnKeys]);

  const columns = useMemo((): DataTableColumn<any>[] => {
    if (data.length === 0) return [];
    const keys = Object.keys(data[0]).filter(
      (k) => !k.startsWith("_") && !HIDDEN_COLUMNS.has(k.toLowerCase())
    );

    const cols: DataTableColumn<any>[] = [
      {
        id: "rowNumber",
        header: "#",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs">{row.index + 1}</span>
        ),
      },
    ];

    for (const key of keys) {
      const isLink = LINK_COLUMNS.has(key.toLowerCase());

      cols.push({
        id: key,
        header: formatColumnHeader(key),
        accessorKey: key as keyof any,
        cell: ({ getValue, row }) => {
          const value = getValue();

          if (isLink && value) {
            const clientId = row.original.client_id;
            const loanId = row.original.loan_id;
            if (clientId && loanId) {
              return (
                <Link
                  href={`/clients/${clientId}/loans/${loanId}`}
                  className="text-primary hover:text-primary/80 hover:underline transition-colors font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  {String(value)}
                </Link>
              );
            }
            return <span className="font-medium">{String(value)}</span>;
          }

          return formatCellValue(key, value, orgCurrency);
        },
        enableSorting: true,
      });
    }

    return cols;
  }, [data, orgCurrency]);

  if (loading && data.length === 0) {
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
        <Button variant="outline" className="mt-4" onClick={() => fetchExpectedPayments()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expected</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount, orgCurrency)}</div>
            <p className="text-xs text-muted-foreground mt-1">{filteredData.length} payments</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique Clients</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.clientCount}</div>
            <p className="text-xs text-muted-foreground mt-1">With payments due</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.overdueAmount, orgCurrency)}</div>
            <p className="text-xs text-muted-foreground mt-1">Past due date</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Collection Rate</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalAmount > 0
                ? `${(((stats.totalAmount - stats.overdueAmount) / stats.totalAmount) * 100).toFixed(1)}%`
                : "0%"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">On-time payments</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 dark:bg-muted/10 rounded-lg border dark:border-border">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("justify-start text-left font-normal min-w-[240px]")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange.from}
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => {
                if (range?.from) {
                  setDateRange({ from: range.from, to: range.to || range.from });
                }
              }}
              numberOfMonths={2}
            />
            <div className="border-t dark:border-border p-3 flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => {
                const today = new Date();
                setDateRange({ from: startOfDay(today), to: endOfDay(today) });
              }}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const today = new Date();
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 7);
                setDateRange({ from: startOfDay(weekAgo), to: endOfDay(today) });
              }}>
                Last 7 days
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                const today = new Date();
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                setDateRange({ from: startOfDay(monthStart), to: endOfDay(today) });
              }}>
                This month
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {offices.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Office:</span>
            <Select value={officeFilter} onValueChange={setOfficeFilter}>
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue placeholder="All Offices" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Offices</SelectItem>
                {offices.map((office) => (
                  <SelectItem key={office} value={office}>{office}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="icon" onClick={() => fetchExpectedPayments()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>

        {officeFilter !== "all" && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {filteredData.length} of {data.length} records
            </Badge>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setOfficeFilter("all")}>
              Clear filters
            </Button>
          </div>
        )}
      </div>

      {lastUpdated && (
        <p className="text-xs text-muted-foreground">
          Last updated: {format(lastUpdated, "HH:mm:ss")} &bull; Auto-refreshes every 30s
        </p>
      )}

      {data.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No expected payments found for the selected date range.</p>
        </div>
      ) : (
        <GenericDataTable
          data={filteredData}
          columns={columns}
          tableId="expected-payments-table"
          searchPlaceholder="Search payments..."
          enablePagination
          enableColumnVisibility
          enableExport
          pageSize={20}
          exportFileName={`expected-payments-${format(dateRange.from, "yyyy-MM-dd")}`}
          emptyMessage="No expected payments found."
          isLoading={loading}
        />
      )}

    </div>
  );
}
