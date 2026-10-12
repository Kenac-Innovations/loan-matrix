"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
  TrendingDown,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";
import { VarianceEventDetailSheet } from "./components/variance-event-detail-sheet";

interface VarianceEvent {
  id: string;
  type: "SHORTAGE" | "OVERAGE";
  amount: number;
  currency: string;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
  businessDate: string;
  expectedBalance: number;
  countedAmount: number;
  raisedAt: string;
  raisedBy: string;
  resolutionType?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  cashier: {
    id: string;
    staffName: string;
  };
  teller: {
    id: string;
    name: string;
  };
  officeId: string;
  officeName: string;
  sessionId: string;
}

interface VarianceEventSummaryCurrency {
  currency: string;
  openShortageTotal: number;
  openOverageTotal: number;
  openCount: number;
}

interface VarianceEventSummary {
  byCurrency: VarianceEventSummaryCurrency[];
  openCount: number;
}

interface FetchResponse {
  items: VarianceEvent[];
  total: number;
  page: number;
  pageSize: number;
  summary: VarianceEventSummary;
  canAct: boolean;
}

type StatusFilter = "UNRESOLVED" | "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "ALL";
type TypeFilter = "ALL" | "SHORTAGE" | "OVERAGE";

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "Unresolved", value: "UNRESOLVED" },
  { label: "Open", value: "OPEN" },
  { label: "Under review", value: "UNDER_REVIEW" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "All", value: "ALL" },
];

const TYPE_OPTIONS: { label: string; value: TypeFilter }[] = [
  { label: "All", value: "ALL" },
  { label: "Shortage", value: "SHORTAGE" },
  { label: "Overage", value: "OVERAGE" },
];

export default function VarianceEventsPage() {
  const { formatAmount } = useCurrency();
  const [events, setEvents] = useState<VarianceEvent[]>([]);
  const [summary, setSummary] = useState<VarianceEventSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [status, setStatus] = useState<StatusFilter>("UNRESOLVED");
  const [type, setType] = useState<TypeFilter>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);

  // Detail sheet state
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("status", status);
      // Only send type if not "ALL" (no type filter when ALL)
      if (type !== "ALL") {
        params.append("type", type);
      }
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);
      params.append("page", page.toString());
      params.append("pageSize", pageSize.toString());

      const response = await fetch(`/api/tellers/variance-events?${params}`);

      if (response.ok) {
        const data: FetchResponse = await response.json();
        setEvents(data.items);
        setSummary(data.summary);
        setTotal(data.total);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch variance events");
      }
    } catch {
      setError("Failed to fetch variance events");
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- load events when filters or page change */
  useEffect(() => {
    fetchEvents();
  }, [status, type, fromDate, toDate, page, refreshTrigger]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const handleStatusChange = (newStatus: StatusFilter) => {
    setStatus(newStatus);
    setPage(1);
  };

  const handleTypeChange = (newType: TypeFilter) => {
    setType(newType);
    setPage(1);
  };

  const handleDateChange = (field: "from" | "to", value: string) => {
    if (field === "from") {
      setFromDate(value);
    } else {
      setToDate(value);
    }
    setPage(1);
  };

  const handleEventRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
    // Don't clear selectedEventId - keep the sheet open and refresh the list
  };

  const formatCurrency = (amount: number, currency?: string) => {
    // Format amount with the specified currency, falling back to org default
    if (currency) {
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        // Invalid currency code, fall back to plain number + code
        return `${amount.toFixed(2)} ${currency}`;
      }
    }
    return formatAmount(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge variant="outline" className="border-red-200 text-red-700">Open</Badge>;
      case "UNDER_REVIEW":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Under review</Badge>;
      case "RESOLVED":
        return <Badge className="bg-green-600">Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    if (type === "SHORTAGE") {
      return <Badge className="bg-red-600">Shortage</Badge>;
    }
    return <Badge className="bg-amber-600">Overage</Badge>;
  };

  const totalPages = Math.ceil(total / pageSize);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading variance events...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Variance events</h1>
          <p className="text-muted-foreground mt-1">
            Cash shortages and overages raised when a branch manager closed a cashier session. Reconcile them here.
          </p>
        </div>
        <Link href="/tellers/reports/session-reconciliation">
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Reconciliation report
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="space-y-4">
          {summary.byCurrency.map((currencySummary) => (
            <Card key={currencySummary.currency}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {currencySummary.currency} Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Open Shortages</p>
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    </div>
                    <p className="text-lg font-bold text-red-600 mt-1">
                      {formatCurrency(currencySummary.openShortageTotal, currencySummary.currency)}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Open Overages</p>
                      <TrendingUp className="h-4 w-4 text-amber-600" />
                    </div>
                    <p className="text-lg font-bold text-amber-600 mt-1">
                      {formatCurrency(currencySummary.openOverageTotal, currencySummary.currency)}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">Open Events</p>
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                    </div>
                    <p className="text-lg font-bold mt-1">
                      {currencySummary.openCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {summary.openCount === 0 && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center">
                  No open variance events
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={handleStatusChange}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => handleDateChange("from", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => handleDateChange("to", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Table Card */}
      <Card>
        <CardHeader>
          <CardTitle>Variance Events</CardTitle>
          <CardDescription>
            Click on a row to view details and manage the event.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {events.length === 0 && !loading ? (
            <div className="text-center py-8 text-muted-foreground">
              No variance events for these filters.
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business Date</TableHead>
                      <TableHead>Cashier</TableHead>
                      <TableHead>Teller/Branch</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Counted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Raised At</TableHead>
                      <TableHead>Resolution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow
                        key={event.id}
                        onClick={() => setSelectedEventId(event.id)}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell className="text-sm">
                          {event.businessDate
                            ? new Intl.DateTimeFormat("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                timeZone: "UTC",
                              }).format(new Date(event.businessDate + "T00:00:00Z"))
                            : "—"}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {event.cashier?.staffName || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {event.teller?.name || "—"}
                        </TableCell>
                        <TableCell>{getTypeBadge(event.type)}</TableCell>
                        <TableCell className="text-sm font-semibold">
                          {formatCurrency(event.amount, event.currency)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatCurrency(event.expectedBalance, event.currency)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatCurrency(event.countedAmount, event.currency)}
                        </TableCell>
                        <TableCell>{getStatusBadge(event.status)}</TableCell>
                        <TableCell className="text-sm">
                          {event.raisedAt
                            ? new Date(event.raisedAt).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {event.resolutionType || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 px-2">
                <div className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({total} total)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!hasPrevPage || loading}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((p) => (hasNextPage ? p + 1 : p))
                    }
                    disabled={!hasNextPage || loading}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      {selectedEventId && (
        <VarianceEventDetailSheet
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
          onRefresh={handleEventRefresh}
        />
      )}
    </div>
  );
}
