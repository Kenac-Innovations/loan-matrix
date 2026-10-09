"use client";

import { useState, useEffect, useRef } from "react";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertCircle,
  Loader2,
  Download,
  FileText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

type StatusFilter = "ALL" | "CLOSED" | "UNCLOSED" | "PENDING_CLOSURE";

interface Office {
  id: number | string;
  name: string;
}

interface VarianceData {
  type: "SHORTAGE" | "OVERAGE";
  amount: number;
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
  resolutionType?: string | null;
}

interface SessionRow {
  sessionId: string;
  businessDate: string;
  officeId: string;
  officeName: string;
  tellerId: string;
  tellerName: string;
  cashierId: string;
  cashierName: string;
  status: string;
  isClosed: boolean;
  closedState: "CLOSED" | "CLOSED_VERIFIED" | null;
  isOverdueUnclosed: boolean;
  currency: string;
  openingFloat: number;
  cashIn: number;
  cashOut: number;
  expectedBalance: number | null;
  declaredAmount: number | null;
  countedAmount: number | null;
  difference: number | null;
  closureInitiatedBy: string;
  closureInitiatedAt: string;
  closedBy: string;
  closedAt: string;
  variance: VarianceData | null;
}

interface BranchSummary {
  officeId: string;
  officeName: string;
  currency: string;
  sessions: number;
  closed: number;
  overdueUnclosed: number;
  pendingClosure: number;
  shortageTotal: number;
  overageTotal: number;
  openVarianceTotal: number;
}

interface CashierSummary {
  cashierId: string;
  cashierName: string;
  tellerName: string;
  officeName: string;
  currency: string;
  sessions: number;
  closed: number;
  overdueUnclosed: number;
  shortageTotal: number;
  overageTotal: number;
  openVarianceTotal: number;
}

interface AgeingData {
  currency: string;
  bucket: "0-7" | "8-30" | "31+";
  count: number;
  total: number;
}

interface TotalData {
  currency: string;
  sessions: number;
  closed: number;
  overdueUnclosed: number;
  shortageTotal: number;
  overageTotal: number;
  openVarianceTotal: number;
}

interface ReportResponse {
  from: string;
  to: string;
  generatedAt: string;
  filters: Record<string, string>;
  rows: SessionRow[];
  byBranch: BranchSummary[];
  byCashier: CashierSummary[];
  ageing: AgeingData[];
  totals: TotalData[];
}

interface Html2PdfChain {
  set(options: unknown): Html2PdfChain;
  from(element: HTMLElement): Html2PdfChain;
  save(): Promise<void>;
  then(cb: (val: void) => void): Html2PdfChain;
  catch(cb: (err: unknown) => void): Html2PdfChain;
}

interface Html2Pdf {
  (): Html2PdfChain;
}

declare global {
  interface Window {
    html2pdf?: Html2Pdf;
  }
}

const STATUS_OPTIONS = [
  { label: "All", value: "ALL" },
  { label: "Closed", value: "CLOSED" },
  { label: "Unclosed", value: "UNCLOSED" },
  { label: "Pending closure", value: "PENDING_CLOSURE" },
];

function getDefaultDateRange() {
  // Get today in Africa/Harare timezone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const dateMap = Object.fromEntries(
    parts.map((p) => [p.type, p.value])
  );
  const harareToday = `${dateMap.year}-${dateMap.month}-${dateMap.day}`;

  // First day of month in Harare timezone
  const [year, month] = harareToday.split("-");
  const firstDay = `${year}-${month}-01`;

  return {
    from: firstDay,
    to: harareToday,
  };
}

function formatCurrency(amount: number, currency?: string) {
  if (currency) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currency}`;
    }
  }
  return amount.toFixed(2);
}

function formatDateDisplay(dateStr: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(dateStr + "T00:00:00Z"));
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function getStatusBadge(status: string, isOverdueUnclosed: boolean) {
  if (isOverdueUnclosed) {
    return <Badge className="bg-red-600">Overdue</Badge>;
  }
  switch (status) {
    case "ACTIVE":
      return <Badge variant="outline">Active</Badge>;
    case "PENDING_CLOSURE":
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Pending closure</Badge>;
    case "CLOSED":
      return <Badge className="bg-green-600">Closed</Badge>;
    case "CLOSED_VERIFIED":
      return <Badge className="bg-green-700">Verified</Badge>;
    default:
      return <Badge variant="outline">Unclosed</Badge>;
  }
}

function getVarianceBadge(variance: VarianceData | null) {
  if (!variance) return "—";
  const typeLabel = variance.type === "SHORTAGE" ? "Shortage" : "Overage";
  const statusLabel = variance.status === "OPEN" ? "Open" : variance.status === "UNDER_REVIEW" ? "Under review" : "Resolved";
  return `${typeLabel} (${statusLabel})${variance.resolutionType ? ` - ${variance.resolutionType}` : ""}`;
}

function getDifferenceColor(difference: number | null) {
  if (difference === null || difference === 0) return "";
  if (difference < 0) return "text-red-600 font-semibold";
  return "text-amber-600 font-semibold";
}

export default function SessionReconciliationPage() {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Filter state
  const defaultDates = getDefaultDateRange();
  const [fromDate, setFromDate] = useState(defaultDates.from);
  const [toDate, setToDate] = useState(defaultDates.to);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [officeId, setOfficeId] = useState("ALL");

  // Report container ref for PDF export
  const reportContainerRef = useRef<HTMLDivElement>(null);
  // Cache for PDF library script loading promise
  const pdfLoadPromiseRef = useRef<Promise<void> | null>(null);

  // Fetch offices on mount
  useEffect(() => {
    const fetchOffices = async () => {
      try {
        const response = await fetch("/api/fineract/offices");
        if (response.ok) {
          const officesData: Office[] = await response.json();
          setOffices(officesData);
        }
      } catch {
        // Silently fail, offices are optional for filtering
      }
    };
    fetchOffices();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("from", fromDate);
      params.append("to", toDate);
      params.append("status", status);
      if (officeId !== "ALL") params.append("officeId", officeId);

      const response = await fetch(`/api/tellers/reports/session-reconciliation?${params}`);

      if (response.ok) {
        const responseData: ReportResponse = await response.json();
        setData(responseData);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch reconciliation report");
      }
    } catch {
      setError("Failed to fetch reconciliation report");
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- fetch report on mount and when filters change */
  useEffect(() => {
    fetchReport();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      params.append("from", fromDate);
      params.append("to", toDate);
      params.append("status", status);
      params.append("format", "csv");
      if (officeId !== "ALL") params.append("officeId", officeId);

      const response = await fetch(`/api/tellers/reports/session-reconciliation?${params}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        // Extract filename from Content-Disposition header or create one
        const contentDisposition = response.headers.get("content-disposition");
        let filename = "session-reconciliation.csv";
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^"]+)"?/);
          if (match) filename = match[1];
        } else {
          filename = `session-reconciliation-${fromDate}-to-${toDate}.csv`;
        }

        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        setError("Failed to export CSV");
      }
    } catch {
      setError("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExporting(true);

      // Dynamically load html2pdf with caching
      if (typeof window.html2pdf === "undefined") {
        if (!pdfLoadPromiseRef.current) {
          pdfLoadPromiseRef.current = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "/html2pdf.bundle.min.js";
            script.async = true;
            script.onload = () => {
              resolve();
            };
            script.onerror = () => {
              // Remove script tag and reset cache on error
              document.head.removeChild(script);
              pdfLoadPromiseRef.current = null;
              reject(new Error("Failed to load PDF library"));
            };
            document.head.appendChild(script);
          });
        }

        try {
          await pdfLoadPromiseRef.current;
          generatePDF();
        } catch {
          setError("Failed to load PDF library");
          setExporting(false);
        }
      } else {
        generatePDF();
      }
    } catch {
      setError("Failed to export PDF");
      setExporting(false);
    }
  };

  const generatePDF = () => {
    try {
      if (!reportContainerRef.current || !window.html2pdf) {
        setError("PDF generation is unavailable");
        setExporting(false);
        return;
      }

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `session-reconciliation-${fromDate}-to-${toDate}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      };

      // Let scrollable tables expand so wide columns aren't clipped in the PDF.
      const container = reportContainerRef.current;
      const scrollers = Array.from(
        container.querySelectorAll<HTMLElement>(".overflow-x-auto")
      );
      scrollers.forEach((el) => (el.style.overflow = "visible"));
      const restore = () => scrollers.forEach((el) => (el.style.overflow = ""));

      window.html2pdf()
        .set(opt)
        .from(container)
        .save()
        .then(() => {
          restore();
          setExporting(false);
        })
        .catch(() => {
          restore();
          setError("Failed to generate PDF");
          setExporting(false);
        });
    } catch {
      setError("Failed to generate PDF");
      setExporting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading reconciliation report...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Session reconciliation report</h1>
          <p className="text-muted-foreground mt-1">
            Cashier sessions, closures, shortages/overages and open variances for a date range.
          </p>
        </div>
        <Link href="/tellers/variance-events">
          <Button variant="outline" size="sm">
            <TrendingUp className="h-4 w-4 mr-2" />
            Variance events
          </Button>
        </Link>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
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

            {offices.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="office">Branch</Label>
                <Select value={officeId} onValueChange={setOfficeId}>
                  <SelectTrigger id="office">
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All branches</SelectItem>
                    {offices.map((office) => (
                      <SelectItem key={office.id} value={String(office.id)}>
                        {office.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-end">
              <Button onClick={fetchReport} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  "Run report"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data && (
        <>
          {/* Export Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleExportCSV}
              disabled={exporting || (data.rows.length === 0)}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
            <Button
              onClick={handleExportPDF}
              disabled={exporting || (data.rows.length === 0)}
              variant="outline"
              size="sm"
            >
              <FileText className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>

          {/* Report Container for PDF */}
          <div ref={reportContainerRef} className="space-y-6 bg-white p-6">
            {/* Report Header */}
            <div className="border-b pb-4">
              <h2 className="text-2xl font-bold">Session Reconciliation Report</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Period: {formatDateDisplay(data.from)} to {formatDateDisplay(data.to)}
              </p>
              <p className="text-sm text-muted-foreground">
                Generated: {formatDateTime(data.generatedAt)}
              </p>
            </div>

            {/* Ageing Table */}
            {data.ageing.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Open variance ageing</CardTitle>
                  <CardDescription>
                    Variance cases by age and currency
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Currency</TableHead>
                          <TableHead>0-7 days</TableHead>
                          <TableHead>8-30 days</TableHead>
                          <TableHead>31+ days</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from(new Set(data.ageing.map((a) => a.currency))).map((currency) => {
                          const currencyData = data.ageing.filter((a) => a.currency === currency);
                          return (
                            <TableRow key={currency}>
                              <TableCell className="font-medium">{currency}</TableCell>
                              {(["0-7", "8-30", "31+"] as const).map((bucket) => {
                                const row = currencyData.find((a) => a.bucket === bucket);
                                return (
                                  <TableCell key={bucket}>
                                    <div className="text-sm">
                                      <div className="font-semibold">{row?.count ?? 0}</div>
                                      <div className="text-muted-foreground">
                                        {row ? formatCurrency(row.total, currency) : "—"}
                                      </div>
                                    </div>
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {data.rows.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground text-center">
                    No sessions in this period.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Totals Cards */}
                <div className="space-y-4">
                  {data.totals.map((total) => (
                    <Card key={total.currency}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">
                          {total.currency} Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
                          <div>
                            <p className="text-xs text-muted-foreground">Sessions</p>
                            <p className="text-lg font-bold mt-1">{total.sessions}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Closed</p>
                            <p className="text-lg font-bold mt-1">{total.closed}</p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">Overdue unclosed</p>
                              {total.overdueUnclosed > 0 && (
                                <TrendingDown className="h-4 w-4 text-red-600" />
                              )}
                            </div>
                            <p className={`text-lg font-bold mt-1 ${total.overdueUnclosed > 0 ? "text-red-600" : ""}`}>
                              {total.overdueUnclosed}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Shortages</p>
                            <p className="text-lg font-bold text-red-600 mt-1">
                              {formatCurrency(total.shortageTotal, total.currency)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Overages</p>
                            <p className="text-lg font-bold text-amber-600 mt-1">
                              {formatCurrency(total.overageTotal, total.currency)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Open variances</p>
                            <p className="text-lg font-bold mt-1">
                              {formatCurrency(total.openVarianceTotal, total.currency)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>


                {/* Branch and Cashier Tables */}
                {(data.byBranch.length > 0 || data.byCashier.length > 0) && (
                  <Tabs defaultValue="branch" className="w-full">
                    <TabsList>
                      {data.byBranch.length > 0 && <TabsTrigger value="branch">By branch</TabsTrigger>}
                      {data.byCashier.length > 0 && <TabsTrigger value="cashier">By cashier</TabsTrigger>}
                    </TabsList>

                    {data.byBranch.length > 0 && (
                      <TabsContent value="branch">
                        <Card>
                          <CardContent className="pt-6">
                            <div className="rounded-md border overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Branch</TableHead>
                                    <TableHead>Currency</TableHead>
                                    <TableHead>Sessions</TableHead>
                                    <TableHead>Closed</TableHead>
                                    <TableHead>Overdue unclosed</TableHead>
                                    <TableHead>Pending closure</TableHead>
                                    <TableHead>Shortages</TableHead>
                                    <TableHead>Overages</TableHead>
                                    <TableHead>Open variances</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {data.byBranch.map((branch, idx) => (
                                    <TableRow key={`${branch.officeId}-${idx}`}>
                                      <TableCell className="font-medium">{branch.officeName}</TableCell>
                                      <TableCell>{branch.currency}</TableCell>
                                      <TableCell>{branch.sessions}</TableCell>
                                      <TableCell>{branch.closed}</TableCell>
                                      <TableCell className={branch.overdueUnclosed > 0 ? "text-red-600 font-semibold" : ""}>
                                        {branch.overdueUnclosed}
                                      </TableCell>
                                      <TableCell>{branch.pendingClosure}</TableCell>
                                      <TableCell className="text-red-600">
                                        {formatCurrency(branch.shortageTotal, branch.currency)}
                                      </TableCell>
                                      <TableCell className="text-amber-600">
                                        {formatCurrency(branch.overageTotal, branch.currency)}
                                      </TableCell>
                                      <TableCell>
                                        {formatCurrency(branch.openVarianceTotal, branch.currency)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    )}

                    {data.byCashier.length > 0 && (
                      <TabsContent value="cashier">
                        <Card>
                          <CardContent className="pt-6">
                            <div className="rounded-md border overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Cashier</TableHead>
                                    <TableHead>Teller</TableHead>
                                    <TableHead>Branch</TableHead>
                                    <TableHead>Currency</TableHead>
                                    <TableHead>Sessions</TableHead>
                                    <TableHead>Closed</TableHead>
                                    <TableHead>Overdue unclosed</TableHead>
                                    <TableHead>Shortages</TableHead>
                                    <TableHead>Overages</TableHead>
                                    <TableHead>Open variances</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {data.byCashier.map((cashier, idx) => (
                                    <TableRow key={`${cashier.cashierId}-${idx}`}>
                                      <TableCell className="font-medium">{cashier.cashierName}</TableCell>
                                      <TableCell>{cashier.tellerName}</TableCell>
                                      <TableCell>{cashier.officeName}</TableCell>
                                      <TableCell>{cashier.currency}</TableCell>
                                      <TableCell>{cashier.sessions}</TableCell>
                                      <TableCell>{cashier.closed}</TableCell>
                                      <TableCell className={cashier.overdueUnclosed > 0 ? "text-red-600 font-semibold" : ""}>
                                        {cashier.overdueUnclosed}
                                      </TableCell>
                                      <TableCell className="text-red-600">
                                        {formatCurrency(cashier.shortageTotal, cashier.currency)}
                                      </TableCell>
                                      <TableCell className="text-amber-600">
                                        {formatCurrency(cashier.overageTotal, cashier.currency)}
                                      </TableCell>
                                      <TableCell>
                                        {formatCurrency(cashier.openVarianceTotal, cashier.currency)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>
                      </TabsContent>
                    )}
                  </Tabs>
                )}

                {/* Sessions Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Sessions</CardTitle>
                    <CardDescription>
                      All sessions for the selected period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Business date</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Teller</TableHead>
                            <TableHead>Cashier</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Opening float</TableHead>
                            <TableHead>Cash in</TableHead>
                            <TableHead>Cash out</TableHead>
                            <TableHead>Expected</TableHead>
                            <TableHead>Declared</TableHead>
                            <TableHead>Counted</TableHead>
                            <TableHead>Difference</TableHead>
                            <TableHead>Variance</TableHead>
                            <TableHead>Closed by / at</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.rows.map((row) => (
                            <TableRow key={row.sessionId}>
                              <TableCell className="text-sm">
                                {formatDateDisplay(row.businessDate)}
                              </TableCell>
                              <TableCell className="text-sm">{row.officeName}</TableCell>
                              <TableCell className="text-sm">{row.tellerName}</TableCell>
                              <TableCell className="text-sm">{row.cashierName}</TableCell>
                              <TableCell>{getStatusBadge(row.status, row.isOverdueUnclosed)}</TableCell>
                              <TableCell className="text-sm">
                                {formatCurrency(row.openingFloat, row.currency)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatCurrency(row.cashIn, row.currency)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatCurrency(row.cashOut, row.currency)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {row.expectedBalance !== null
                                  ? formatCurrency(row.expectedBalance, row.currency)
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {row.declaredAmount !== null
                                  ? formatCurrency(row.declaredAmount, row.currency)
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {row.countedAmount !== null
                                  ? formatCurrency(row.countedAmount, row.currency)
                                  : "—"}
                              </TableCell>
                              <TableCell className={`text-sm ${getDifferenceColor(row.difference)}`}>
                                {row.difference !== null
                                  ? formatCurrency(row.difference, row.currency)
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {getVarianceBadge(row.variance)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {row.closedBy ? `${row.closedBy} / ${formatDateTime(row.closedAt)}` : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
