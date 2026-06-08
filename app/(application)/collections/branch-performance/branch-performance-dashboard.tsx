"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  DollarSign,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";
import { formatCurrency } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BranchPerformanceRow = {
  officeId: number | null;
  officeName: string;
  currencyCode: string;
  expectedPaymentCount: number;
  expectedLoanCount: number;
  expectedClientCount: number;
  expectedAmount: number;
  collectedTransactionCount: number;
  collectedLoanCount: number;
  collectedClientCount: number;
  collectedAmount: number;
  overdueAmount: number;
  shortfallAmount: number;
  collectionRate: number;
};

type BranchPerformanceSummary = {
  branchCount: number;
  expectedAmount: number;
  collectedAmount: number;
  overdueAmount: number;
  shortfallAmount: number;
  collectionRate: number;
  expectedPaymentCount: number;
  collectedTransactionCount: number;
  expectedClientCount: number;
  collectedClientCount: number;
};

type BranchPerformanceData = {
  fromDate: string;
  toDate: string;
  officeId: number;
  rows: BranchPerformanceRow[];
  summary: BranchPerformanceSummary;
  generatedAt: string;
};

type OfficeOption = {
  id: number;
  name: string;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthStartDate() {
  const today = new Date();
  return isoDate(new Date(today.getFullYear(), today.getMonth(), 1));
}

function todayDate() {
  return isoDate(new Date());
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function rateBadgeClass(value: number) {
  if (value >= 95) return "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300";
  if (value >= 75) return "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
}

function StatCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={`branch-collection-stat-${index}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-3 w-40" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function BranchPerformanceDashboard() {
  const { currencyCode } = useCurrency();
  const [fromDate, setFromDate] = useState(monthStartDate);
  const [toDate, setToDate] = useState(todayDate);
  const [officeId, setOfficeId] = useState("1");
  const [appliedFilters, setAppliedFilters] = useState({
    fromDate: monthStartDate(),
    toDate: todayDate(),
    officeId: "1",
  });
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [officesLoading, setOfficesLoading] = useState(true);
  const [data, setData] = useState<BranchPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = useCallback(async (filters = appliedFilters) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        startDate: filters.fromDate,
        endDate: filters.toDate,
        officeId: filters.officeId || "1",
      });
      const response = await fetch(`/api/collections/branch-performance?${params.toString()}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        const details = typeof result.details === "string" ? result.details : "";
        throw new Error(details || result.error || "Failed to load branch performance");
      }
      setData(result);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load branch performance");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  useEffect(() => {
    let active = true;

    async function fetchOffices() {
      setOfficesLoading(true);
      try {
        const response = await fetch("/api/fineract/offices", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Failed to load offices");

        const officeOptions = Array.isArray(result)
          ? result
              .map((office) => ({
                id: Number(office.id),
                name: String(office.name || `Office ${office.id}`),
              }))
              .filter((office) => Number.isInteger(office.id) && office.id > 0)
          : [];

        if (active) {
          setOffices(officeOptions);
          if (!officeOptions.some((office) => String(office.id) === "1") && officeOptions[0]) {
            const nextOfficeId = String(officeOptions[0].id);
            setOfficeId(nextOfficeId);
            setAppliedFilters((current) => ({ ...current, officeId: nextOfficeId }));
          }
        }
      } catch {
        if (active) setOffices([]);
      } finally {
        if (active) setOfficesLoading(false);
      }
    }

    fetchOffices();

    return () => {
      active = false;
    };
  }, []);

  const displayedCurrency = useMemo(() => {
    return data?.rows.find((row) => row.currencyCode)?.currencyCode || currencyCode;
  }, [data?.rows, currencyCode]);

  const selectedOfficeName = useMemo(() => {
    return offices.find((office) => String(office.id) === appliedFilters.officeId)?.name || "Head Office";
  }, [appliedFilters.officeId, offices]);

  const applyRange = (nextFromDate = fromDate, nextToDate = toDate, nextOfficeId = officeId) => {
    const nextFilters = {
      fromDate: nextFromDate,
      toDate: nextToDate,
      officeId: nextOfficeId || "1",
    };
    setFromDate(nextFromDate);
    setToDate(nextToDate);
    setOfficeId(nextFilters.officeId);
    setAppliedFilters(nextFilters);
  };

  const summary = data?.summary;

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Expected Collections"
            value={formatCurrency(summary.expectedAmount, displayedCurrency)}
            detail={`${summary.expectedPaymentCount} scheduled payments`}
            icon={<CalendarDays className="h-4 w-4" />}
          />
          <StatCard
            title="Actual Collections"
            value={formatCurrency(summary.collectedAmount, displayedCurrency)}
            detail={`${summary.collectedTransactionCount} repayment transactions`}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <StatCard
            title="Collection Rate"
            value={formatPercent(summary.collectionRate)}
            detail={`${summary.collectedClientCount} of ${summary.expectedClientCount} clients paid`}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            title="Shortfall"
            value={formatCurrency(summary.shortfallAmount, displayedCurrency)}
            detail={`${summary.branchCount} branches in range`}
            icon={<TrendingDown className="h-4 w-4" />}
          />
        </div>
      ) : loading ? (
        <StatsSkeleton />
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Branch Performance</CardTitle>
              <p className="text-sm text-muted-foreground">
                {data?.generatedAt
                  ? `Updated ${new Date(data.generatedAt).toLocaleTimeString()} for ${selectedOfficeName}`
                  : `Expected versus actual collections for ${selectedOfficeName}`}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="branch-performance-office" className="text-xs">Office</Label>
                <Select
                  value={officeId}
                  onValueChange={setOfficeId}
                  disabled={officesLoading}
                >
                  <SelectTrigger id="branch-performance-office" className="h-9 w-[190px]">
                    <SelectValue placeholder={officesLoading ? "Loading offices..." : "Select office"} />
                  </SelectTrigger>
                  <SelectContent>
                    {offices.map((office) => (
                      <SelectItem key={office.id} value={String(office.id)}>
                        {office.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="branch-performance-from" className="text-xs">From</Label>
                <Input
                  id="branch-performance-from"
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="h-9 w-[150px]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="branch-performance-to" className="text-xs">To</Label>
                <Input
                  id="branch-performance-to"
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="h-9 w-[150px]"
                />
              </div>
              <Button size="sm" onClick={() => applyRange()} disabled={!fromDate || !toDate || !officeId || loading}>
                Apply
              </Button>
              <Button variant="outline" size="icon" onClick={() => fetchPerformance()} disabled={loading}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {error ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">Branch performance could not be loaded</p>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" variant="outline" onClick={() => fetchPerformance()}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : (
            <BranchPerformanceTable
              rows={data?.rows || []}
              loading={loading}
              currencyCode={displayedCurrency}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BranchPerformanceTable({
  rows,
  loading,
  currencyCode,
}: {
  rows: BranchPerformanceRow[];
  loading: boolean;
  currencyCode: string;
}) {
  if (loading && rows.length === 0) {
    return <BranchPerformanceTableSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <div className="py-14 text-center text-sm text-muted-foreground">
        No branch collection performance found for this date range.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Branch</TableHead>
          <TableHead className="text-right">Expected</TableHead>
          <TableHead className="text-right">Collected</TableHead>
          <TableHead className="text-right">Collection Rate</TableHead>
          <TableHead className="text-right">Shortfall</TableHead>
          <TableHead className="text-right">Overdue</TableHead>
          <TableHead className="text-right">Clients Due</TableHead>
          <TableHead className="text-right">Clients Paid</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.officeId ?? "none"}-${row.officeName}-${row.currencyCode}`}>
            <TableCell>
              <div className="font-medium">{row.officeName}</div>
              <div className="text-xs text-muted-foreground">{row.currencyCode || currencyCode}</div>
            </TableCell>
            <TableCell className="text-right">{formatCurrency(row.expectedAmount, row.currencyCode || currencyCode)}</TableCell>
            <TableCell className="text-right font-medium">{formatCurrency(row.collectedAmount, row.currencyCode || currencyCode)}</TableCell>
            <TableCell className="text-right">
              <Badge variant="outline" className={cn("tabular-nums", rateBadgeClass(row.collectionRate))}>
                {formatPercent(row.collectionRate)}
              </Badge>
            </TableCell>
            <TableCell className="text-right">{formatCurrency(row.shortfallAmount, row.currencyCode || currencyCode)}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.overdueAmount, row.currencyCode || currencyCode)}</TableCell>
            <TableCell className="text-right tabular-nums">{row.expectedClientCount}</TableCell>
            <TableCell className="text-right tabular-nums">{row.collectedClientCount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BranchPerformanceTableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Branch</TableHead>
          <TableHead className="text-right">Expected</TableHead>
          <TableHead className="text-right">Collected</TableHead>
          <TableHead className="text-right">Collection Rate</TableHead>
          <TableHead className="text-right">Shortfall</TableHead>
          <TableHead className="text-right">Overdue</TableHead>
          <TableHead className="text-right">Clients Due</TableHead>
          <TableHead className="text-right">Clients Paid</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 8 }).map((_, index) => (
          <TableRow key={`branch-collection-performance-skeleton-${index}`}>
            <TableCell>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-12" />
            </TableCell>
            <TableCell><Skeleton className="ml-auto h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="ml-auto h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="ml-auto h-6 w-16 rounded-full" /></TableCell>
            <TableCell><Skeleton className="ml-auto h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="ml-auto h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="ml-auto h-4 w-12" /></TableCell>
            <TableCell><Skeleton className="ml-auto h-4 w-12" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
