"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileX2,
  FileText,
  Gavel,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Scale,
  ShieldAlert,
  StickyNote,
} from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";
import { formatCurrency } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

type BucketTab = "30" | "60" | "90" | "npa" | "court" | "performance";
type RecoveryBucket = "30" | "60" | "90" | "npa" | "all";

type RecoveryLoanRow = {
  loanId: number;
  clientId: number | null;
  accountNo: string;
  clientName: string;
  productName: string;
  officeId: number | null;
  officeName: string;
  bucket: "30" | "60" | "90";
  daysPastDue: number;
  overdueAmount: number;
  outstandingAmount: number;
  principalAmount: number;
  currencyCode: string;
  status: string;
  isNpa: boolean;
  npaStatus: "NPA" | "NPA Candidate" | "Not NPA";
  loanDetailUrl: string;
};

type OfficeRecoveryPerformance = {
  officeId: number | null;
  officeName: string;
  activeLoanCount: number;
  arrearsLoanCount: number;
  par30LoanCount: number;
  par60LoanCount: number;
  par90LoanCount: number;
  npaLoanCount: number;
  outstandingAmount: number;
  overdueAmount: number;
  par30OutstandingAmount: number;
  par60OutstandingAmount: number;
  par90OutstandingAmount: number;
  currentRate: number;
};

type RecoveryDashboardSummary = {
  activeLoanCount: number;
  arrearsLoanCount: number;
  bucketCounts: Record<"30" | "60" | "90", number>;
  npaLoanCount: number;
  totalOutstandingAmount: number;
  totalOverdueAmount: number;
  par30OutstandingAmount: number;
  par60OutstandingAmount: number;
  par90OutstandingAmount: number;
  currentRate: number;
  byOffice: OfficeRecoveryPerformance[];
};

type RecoveryDashboardData = {
  bucket: RecoveryBucket;
  rows: RecoveryLoanRow[];
  summary: RecoveryDashboardSummary;
  pagination: {
    page: number;
    pageSize: number;
    rowCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  generatedAt: string;
};

type CourtReportRow = {
  id?: number;
  loan_id?: number;
  loan_account_no?: string;
  client_id?: number;
  client_name?: string;
  office_name?: string;
  product_name?: string;
  case_number?: string;
  court_name?: string;
  filing_date?: string;
  lawyer_name?: string;
  court_process_started?: string;
  started_on_date?: string;
  started_by?: string;
  proceeding_date?: string;
  proceeding_type?: string;
  status?: string;
  next_hearing_date?: string;
  outcome?: string;
  recorded_by?: string;
  notes?: string;
};

type CourtCaseRecord = {
  id?: number;
  loan_id?: number;
  case_number?: string;
  court_name?: string;
  filing_date?: string | number[] | null;
  lawyer_name?: string;
  status?: string;
  court_process_started?: string;
  started_on_date?: string | number[] | null;
  started_by?: string;
  next_hearing_date?: string | number[] | null;
  outcome?: string;
  notes?: string;
};

type CourtProceedingRecord = {
  id?: number;
  loan_id?: number;
  case_number?: string;
  proceeding_date?: string | number[] | null;
  proceeding_type?: string;
  status?: string;
  next_hearing_date?: string | number[] | null;
  outcome?: string;
  recorded_by?: string;
  notes?: string;
};

type LoanCourtData = {
  cases: CourtCaseRecord[];
  proceedings: CourtProceedingRecord[];
};

type CourtCaseForm = {
  caseNumber: string;
  courtName: string;
  filingDate: string;
  lawyerName: string;
  status: string;
  startedOnDate: string;
  nextHearingDate: string;
  outcome: string;
  notes: string;
};

type ProceedingForm = {
  caseNumber: string;
  proceedingDate: string;
  proceedingType: string;
  status: string;
  nextHearingDate: string;
  outcome: string;
  notes: string;
};

const TABS: Array<{ value: BucketTab; label: string; icon: ReactNode }> = [
  { value: "30", label: "30 Days", icon: <Bell className="h-4 w-4" /> },
  { value: "60", label: "60 Days", icon: <ShieldAlert className="h-4 w-4" /> },
  { value: "npa", label: "NPA (90+)", icon: <Scale className="h-4 w-4" /> },
  { value: "court", label: "Court", icon: <Gavel className="h-4 w-4" /> },
  { value: "performance", label: "Branches", icon: <Building2 className="h-4 w-4" /> },
];

const PAGE_SIZE = 25;

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

const emptyCourtCaseForm: CourtCaseForm = {
  caseNumber: "",
  courtName: "",
  filingDate: "",
  lawyerName: "",
  status: "STARTED",
  startedOnDate: todayInputDate(),
  nextHearingDate: "",
  outcome: "",
  notes: "",
};

const emptyProceedingForm: ProceedingForm = {
  caseNumber: "",
  proceedingDate: todayInputDate(),
  proceedingType: "",
  status: "RECORDED",
  nextHearingDate: "",
  outcome: "",
  notes: "",
};

function buildCourtCaseForm(row: RecoveryLoanRow): CourtCaseForm {
  return {
    ...emptyCourtCaseForm,
    caseNumber: row.accountNo,
    startedOnDate: todayInputDate(),
  };
}

function buildProceedingForm(row: RecoveryLoanRow, caseNumber?: string): ProceedingForm {
  return {
    ...emptyProceedingForm,
    caseNumber: caseNumber || row.accountNo,
    proceedingDate: todayInputDate(),
  };
}

function isCourtCaseFormValid(form: CourtCaseForm) {
  return Boolean(
    form.caseNumber.trim() &&
    form.courtName.trim() &&
    form.status.trim() &&
    form.startedOnDate.trim()
  );
}

function isProceedingFormValid(form: ProceedingForm) {
  return Boolean(
    form.caseNumber.trim() &&
    form.proceedingDate.trim() &&
    form.proceedingType.trim() &&
    form.status.trim()
  );
}

function toRecoveryBucket(tab: BucketTab): RecoveryBucket {
  if (tab === "performance") return "all";
  if (tab === "court") return "all";
  return tab;
}

function formatDate(value?: string | number[] | null): string {
  if (!value) return "-";
  if (Array.isArray(value) && value.length >= 3) {
    return new Date(value[0], value[1] - 1, value[2]).toLocaleDateString();
  }
  if (typeof value !== "string") return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString();
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function getBucketBadgeClass(bucket: string) {
  if (bucket === "30") return "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  if (bucket === "60") return "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300";
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

function RecoveryStatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={`recovery-stat-skeleton-${index}`}>
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

export function RecoveriesDashboard() {
  const { currencyCode } = useCurrency();
  const dashboardCacheRef = useRef<Partial<Record<BucketTab, Record<number, RecoveryDashboardData>>>>({});
  const courtRowsCacheRef = useRef<CourtReportRow[] | null>(null);
  const [activeTab, setActiveTab] = useState<BucketTab>("30");
  const [dashboard, setDashboard] = useState<RecoveryDashboardData | null>(null);
  const [courtRows, setCourtRows] = useState<CourtReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [courtLoading, setCourtLoading] = useState(false);
  const [caseProceedingsTarget, setCaseProceedingsTarget] = useState<CourtReportRow | null>(null);
  const [caseProceedingsData, setCaseProceedingsData] = useState<LoanCourtData | null>(null);
  const [caseProceedingsLoading, setCaseProceedingsLoading] = useState(false);
  const [pageByTab, setPageByTab] = useState<Partial<Record<BucketTab, number>>>({});
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [noteTarget, setNoteTarget] = useState<RecoveryLoanRow | null>(null);
  const [noteText, setNoteText] = useState("");
  const [writeOffTarget, setWriteOffTarget] = useState<RecoveryLoanRow | null>(null);
  const [writeOffNote, setWriteOffNote] = useState("");
  const [courtCaseTarget, setCourtCaseTarget] = useState<RecoveryLoanRow | null>(null);
  const [courtCaseLoading, setCourtCaseLoading] = useState(false);
  const [courtCaseData, setCourtCaseData] = useState<LoanCourtData | null>(null);
  const [courtCaseForm, setCourtCaseForm] = useState<CourtCaseForm>(emptyCourtCaseForm);
  const [proceedingTarget, setProceedingTarget] = useState<RecoveryLoanRow | null>(null);
  const [proceedingForm, setProceedingForm] = useState<ProceedingForm>(emptyProceedingForm);

  const activePage = pageByTab[activeTab] ?? 1;
  const courtCaseFormValid = isCourtCaseFormValid(courtCaseForm);
  const proceedingFormValid = isProceedingFormValid(proceedingForm);

  const fetchDashboard = useCallback(async (tab: BucketTab, page: number, force = false) => {
    const cached = dashboardCacheRef.current[tab]?.[page];
    if (!force && cached) {
      setDashboard(cached);
      setLoading(false);
      return;
    }

    const bucket = toRecoveryBucket(tab);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        bucket,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      const response = await fetch(`/api/recoveries/arrears?${params.toString()}`, {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load recovery data");
      setDashboard(result);
      dashboardCacheRef.current = {
        ...dashboardCacheRef.current,
        [tab]: {
          ...(dashboardCacheRef.current[tab] || {}),
          [page]: result,
        },
      };
    } catch (error) {
      toast({
        title: "Recoveries",
        description: error instanceof Error ? error.message : "Failed to load recovery data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCourtRows = useCallback(async (force = false) => {
    if (!force && courtRowsCacheRef.current) {
      setCourtRows(courtRowsCacheRef.current);
      setCourtLoading(false);
      return;
    }

    setCourtLoading(true);
    try {
      const response = await fetch("/api/recoveries/reports/court-cases", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to load court cases");
      const rows = Array.isArray(result.rows) ? result.rows : [];
      setCourtRows(rows);
      courtRowsCacheRef.current = rows;
    } catch (error) {
      toast({
        title: "Court cases",
        description: error instanceof Error ? error.message : "Failed to load court cases",
        variant: "destructive",
      });
    } finally {
      setCourtLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "court") {
      fetchCourtRows();
      return;
    }
    fetchDashboard(activeTab, activePage);
  }, [activePage, activeTab, fetchCourtRows, fetchDashboard]);

  const rows = useMemo(() => dashboard?.rows || [], [dashboard]);
  const summary = dashboard?.summary;

  const displayedCurrency = useMemo(() => {
    return rows[0]?.currencyCode || currencyCode;
  }, [rows, currencyCode]);

  const currentRows = activeTab === "performance" ? [] : rows;
  const writeOffActionKey = writeOffTarget ? `${writeOffTarget.loanId}:write-off` : "write-off";

  const refreshCurrentTab = useCallback(() => {
    if (activeTab === "court") {
      fetchCourtRows(true);
      return;
    }
    fetchDashboard(activeTab, activePage, true);
  }, [activePage, activeTab, fetchCourtRows, fetchDashboard]);

  const setActiveTabPage = useCallback((page: number) => {
    setPageByTab((current) => ({
      ...current,
      [activeTab]: Math.max(1, page),
    }));
  }, [activeTab]);

  const loadCourtCaseData = useCallback(async (row: RecoveryLoanRow) => {
    setCourtCaseLoading(true);
    try {
      const response = await fetch(`/api/recoveries/loans/${row.loanId}/court`, {
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({})) as Partial<LoanCourtData> & { error?: string };
      if (!response.ok) throw new Error(result.error || "Failed to load court case");

      const data: LoanCourtData = {
        cases: Array.isArray(result.cases) ? result.cases : [],
        proceedings: Array.isArray(result.proceedings) ? result.proceedings : [],
      };
      setCourtCaseData(data);
      return data;
    } catch (error) {
      toast({
        title: "Court case",
        description: error instanceof Error ? error.message : "Failed to load court case",
        variant: "destructive",
      });
      setCourtCaseData({ cases: [], proceedings: [] });
      return null;
    } finally {
      setCourtCaseLoading(false);
    }
  }, []);

  const handleViewCaseProceedings = async (row: CourtReportRow) => {
    if (!row.loan_id) return;

    setCaseProceedingsTarget(row);
    setCaseProceedingsData(null);
    setCaseProceedingsLoading(true);
    try {
      const response = await fetch(`/api/recoveries/loans/${row.loan_id}/court`, {
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({})) as Partial<LoanCourtData> & { error?: string };
      if (!response.ok) throw new Error(result.error || "Failed to load court proceedings");

      setCaseProceedingsData({
        cases: Array.isArray(result.cases) ? result.cases : [],
        proceedings: Array.isArray(result.proceedings) ? result.proceedings : [],
      });
    } catch (error) {
      toast({
        title: "Court proceedings",
        description: error instanceof Error ? error.message : "Failed to load court proceedings",
        variant: "destructive",
      });
      setCaseProceedingsData({ cases: [], proceedings: [] });
    } finally {
      setCaseProceedingsLoading(false);
    }
  };

  const handleOpenCourtCase = async (row: RecoveryLoanRow) => {
    const key = `${row.loanId}:court-case`;
    setActionKey(key);
    setCourtCaseTarget(row);
    setCourtCaseData(null);
    setCourtCaseForm(buildCourtCaseForm(row));
    try {
      await loadCourtCaseData(row);
    } finally {
      setActionKey(null);
    }
  };

  const handleSendReminder = async (row: RecoveryLoanRow) => {
    const key = `${row.loanId}:reminder`;
    setActionKey(key);
    try {
      const response = await fetch(`/api/recoveries/loans/${row.loanId}/reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: row.bucket }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.message || "Failed to send reminder");

      toast({
        title: "Reminder logged",
        description: result.message || "Reminder action completed.",
      });
      refreshCurrentTab();
    } catch (error) {
      toast({
        title: "Reminder failed",
        description: error instanceof Error ? error.message : "Failed to send reminder",
        variant: "destructive",
      });
    } finally {
      setActionKey(null);
    }
  };

  const handleTriggerBucket = async () => {
    if (activeTab !== "30" && activeTab !== "60" && activeTab !== "90") return;
    const confirmed = window.confirm(`Send ${activeTab === "90" ? "90+" : activeTab}-day reminders for all loans in this bucket?`);
    if (!confirmed) return;

    setActionKey("trigger");
    try {
      const response = await fetch("/api/recoveries/reminders/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket: activeTab }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to trigger reminders");

      toast({
        title: "Reminder trigger completed",
        description: `${result.sent || 0} SMS sent from ${result.processed || 0} processed loans.`,
      });
      refreshCurrentTab();
    } catch (error) {
      toast({
        title: "Reminder trigger failed",
        description: error instanceof Error ? error.message : "Failed to trigger reminders",
        variant: "destructive",
      });
    } finally {
      setActionKey(null);
    }
  };

  const handleSubmitNote = async () => {
    if (!noteTarget || !noteText.trim()) return;
    setActionKey("note");
    try {
      const response = await fetch(`/api/recoveries/loans/${noteTarget.loanId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Failed to add follow-up note");

      toast({ title: "Follow-up note added" });
      setNoteTarget(null);
      setNoteText("");
      refreshCurrentTab();
    } catch (error) {
      toast({
        title: "Note failed",
        description: error instanceof Error ? error.message : "Failed to add note",
        variant: "destructive",
      });
    } finally {
      setActionKey(null);
    }
  };

  const handleSubmitWriteOff = async () => {
    if (!writeOffTarget || !writeOffNote.trim()) return;
    const key = `${writeOffTarget.loanId}:write-off`;
    setActionKey(key);
    try {
      const response = await fetch(`/api/recoveries/loans/${writeOffTarget.loanId}/write-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: writeOffNote.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Failed to write off loan");

      toast({
        title: "Loan written off",
        description: `${writeOffTarget.accountNo} was written off successfully.`,
      });
      setWriteOffTarget(null);
      setWriteOffNote("");
      refreshCurrentTab();
    } catch (error) {
      toast({
        title: "Write-off failed",
        description: error instanceof Error ? error.message : "Failed to write off loan",
        variant: "destructive",
      });
    } finally {
      setActionKey(null);
    }
  };

  const handleSubmitCourtCase = async () => {
    if (!courtCaseTarget || !courtCaseFormValid) return;
    setActionKey("court-case");
    try {
      const response = await fetch(`/api/recoveries/loans/${courtCaseTarget.loanId}/court/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(courtCaseForm),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Failed to create court case");

      toast({ title: "Court case recorded" });
      courtRowsCacheRef.current = null;
      setCourtCaseForm(buildCourtCaseForm(courtCaseTarget));
      await loadCourtCaseData(courtCaseTarget);
      refreshCurrentTab();
    } catch (error) {
      toast({
        title: "Court process failed",
        description: error instanceof Error ? error.message : "Failed to create court case",
        variant: "destructive",
      });
    } finally {
      setActionKey(null);
    }
  };

  const handleSubmitProceeding = async () => {
    if (!proceedingTarget || !proceedingFormValid) return;
    setActionKey("proceeding");
    try {
      const response = await fetch(`/api/recoveries/loans/${proceedingTarget.loanId}/court/proceedings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proceedingForm),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Failed to create court proceeding");

      toast({ title: "Court proceeding recorded" });
      courtRowsCacheRef.current = null;
      setProceedingTarget(null);
      setProceedingForm(emptyProceedingForm);
      refreshCurrentTab();
    } catch (error) {
      toast({
        title: "Proceeding failed",
        description: error instanceof Error ? error.message : "Failed to create proceeding",
        variant: "destructive",
      });
    } finally {
      setActionKey(null);
    }
  };

  const handleAddProceedingFromCase = () => {
    if (!courtCaseTarget || !courtCaseData?.cases.length) return;
    const caseNumber = courtCaseData.cases[0]?.case_number || courtCaseTarget.accountNo;
    setProceedingTarget(courtCaseTarget);
    setProceedingForm(buildProceedingForm(courtCaseTarget, caseNumber));
    setCourtCaseTarget(null);
    setCourtCaseData(null);
  };

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="PAR30 Exposure"
            value={formatCurrency(summary.par30OutstandingAmount, displayedCurrency)}
            detail={`${summary.arrearsLoanCount} loans in arrears`}
            icon={<ShieldAlert className="h-4 w-4" />}
          />
          <StatCard
            title="PAR90 / NPA"
            value={formatCurrency(summary.par90OutstandingAmount, displayedCurrency)}
            detail={`${summary.bucketCounts["90"]} loans at 90+ days, ${summary.npaLoanCount} NPA`}
            icon={<Scale className="h-4 w-4" />}
          />
          <StatCard
            title="Overdue Amount"
            value={formatCurrency(summary.totalOverdueAmount, displayedCurrency)}
            detail="Total amount currently overdue"
            icon={<FileText className="h-4 w-4" />}
          />
          <StatCard
            title="Current Rate"
            value={formatPercent(summary.currentRate)}
            detail={`${summary.activeLoanCount} active loans assessed`}
            icon={<BriefcaseBusiness className="h-4 w-4" />}
          />
        </div>
      ) : loading ? (
        <RecoveryStatsSkeleton />
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Recovery Queue</CardTitle>
              <p className="text-sm text-muted-foreground">
                {dashboard?.generatedAt ? `Updated ${new Date(dashboard.generatedAt).toLocaleTimeString()}` : "Live Fineract recovery data"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(activeTab === "30" || activeTab === "60" || activeTab === "90") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTriggerBucket}
                  disabled={actionKey === "trigger" || loading}
                >
                  {actionKey === "trigger" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                  Trigger Bucket
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={refreshCurrentTab} disabled={loading || courtLoading}>
                <RefreshCw className={cn("h-4 w-4", (loading || courtLoading) && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as BucketTab)}>
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-5">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="h-10 gap-2">
                  {tab.icon}
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="mt-4">
            {activeTab === "court" ? (
              <CourtCasesTable
                rows={courtRows}
                loading={courtLoading}
                onViewProceedings={handleViewCaseProceedings}
              />
            ) : activeTab === "performance" ? (
              <BranchPerformanceTable rows={summary?.byOffice || []} currencyCode={displayedCurrency} loading={loading} />
            ) : (
              <ArrearsTable
                rows={currentRows}
                loading={loading}
                pagination={dashboard?.pagination}
                actionKey={actionKey}
                isNpaView={activeTab === "npa"}
                onPageChange={setActiveTabPage}
                onSendReminder={handleSendReminder}
                onAddNote={(row) => {
                  setNoteTarget(row);
                  setNoteText("");
                }}
                onOpenCourtCase={handleOpenCourtCase}
                onWriteOff={(row) => {
                  setWriteOffTarget(row);
                  setWriteOffNote("");
                }}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(noteTarget)} onOpenChange={(open) => !open && setNoteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Follow-up Note</DialogTitle>
            <DialogDescription>
              {noteTarget ? `${noteTarget.clientName} - ${noteTarget.accountNo}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="follow-up-note">Note</Label>
            <Textarea
              id="follow-up-note"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              rows={5}
              placeholder="Record contact outcome, promise to pay, branch update, or next action."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteTarget(null)}>Cancel</Button>
            <Button onClick={handleSubmitNote} disabled={!noteText.trim() || actionKey === "note"}>
              {actionKey === "note" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(writeOffTarget)}
        onOpenChange={(open) => {
          if (!open && actionKey !== writeOffActionKey) {
            setWriteOffTarget(null);
            setWriteOffNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write Off Loan</DialogTitle>
            <DialogDescription>
              {writeOffTarget ? `${writeOffTarget.clientName} - ${writeOffTarget.accountNo}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="write-off-note">Write-off note</Label>
            <Textarea
              id="write-off-note"
              value={writeOffNote}
              onChange={(event) => setWriteOffNote(event.target.value)}
              rows={5}
              placeholder="Record the write-off reason, approval reference, or recovery outcome."
              required
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setWriteOffTarget(null);
                setWriteOffNote("");
              }}
              disabled={actionKey === writeOffActionKey}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmitWriteOff}
              disabled={!writeOffNote.trim() || actionKey === writeOffActionKey}
            >
              {actionKey === writeOffActionKey && <Loader2 className="h-4 w-4 animate-spin" />}
              Write Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(courtCaseTarget)}
        onOpenChange={(open) => {
          if (!open && !courtCaseLoading) {
            setCourtCaseTarget(null);
            setCourtCaseData(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Court Case</DialogTitle>
            <DialogDescription>
              {courtCaseTarget ? `${courtCaseTarget.clientName} - ${courtCaseTarget.accountNo}` : ""}
            </DialogDescription>
          </DialogHeader>
          {courtCaseLoading || !courtCaseData ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : courtCaseData.cases.length === 0 ? (
            <>
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                No court case has been started for this loan.
              </div>
              <CourtCaseFields form={courtCaseForm} setForm={setCourtCaseForm} />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCourtCaseTarget(null);
                    setCourtCaseData(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmitCourtCase} disabled={!courtCaseFormValid || actionKey === "court-case"}>
                  {actionKey === "court-case" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Case
                </Button>
              </DialogFooter>
            </>
          ) : courtCaseTarget ? (
            <>
              <CourtCaseDetails data={courtCaseData} />
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCourtCaseTarget(null);
                    setCourtCaseData(null);
                  }}
                >
                  Close
                </Button>
                <Button onClick={handleAddProceedingFromCase}>
                  <MessageSquarePlus className="h-4 w-4" />
                  Add Proceeding
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(caseProceedingsTarget)}
        onOpenChange={(open) => {
          if (!open && !caseProceedingsLoading) {
            setCaseProceedingsTarget(null);
            setCaseProceedingsData(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Court Proceedings</DialogTitle>
            <DialogDescription>
              {caseProceedingsTarget
                ? `${caseProceedingsTarget.client_name || "Client"} - ${caseProceedingsTarget.case_number || caseProceedingsTarget.loan_account_no || ""}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {caseProceedingsLoading || !caseProceedingsData ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : (
            <CourtCaseDetails
              data={caseProceedingsData}
              caseNumber={caseProceedingsTarget?.case_number}
              fallbackCase={caseProceedingsTarget ?? undefined}
            />
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCaseProceedingsTarget(null);
                setCaseProceedingsData(null);
              }}
            >
              Close
            </Button>
            {caseProceedingsTarget?.client_id && caseProceedingsTarget.loan_id && (
              <Button asChild>
                <Link href={`/clients/${caseProceedingsTarget.client_id}/loans/${caseProceedingsTarget.loan_id}`}>
                  <ExternalLink className="h-4 w-4" />
                  Open Loan
                </Link>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(proceedingTarget)} onOpenChange={(open) => !open && setProceedingTarget(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Court Proceeding</DialogTitle>
            <DialogDescription>
              {proceedingTarget ? `${proceedingTarget.clientName} - ${proceedingTarget.accountNo}` : ""}
            </DialogDescription>
          </DialogHeader>
          <ProceedingFields form={proceedingForm} setForm={setProceedingForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setProceedingTarget(null)}>Cancel</Button>
            <Button onClick={handleSubmitProceeding} disabled={!proceedingFormValid || actionKey === "proceeding"}>
              {actionKey === "proceeding" && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Proceeding
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ArrearsTable({
  rows,
  loading,
  pagination,
  actionKey,
  isNpaView,
  onPageChange,
  onSendReminder,
  onAddNote,
  onOpenCourtCase,
  onWriteOff,
}: {
  rows: RecoveryLoanRow[];
  loading: boolean;
  pagination?: RecoveryDashboardData["pagination"];
  actionKey: string | null;
  isNpaView: boolean;
  onPageChange: (page: number) => void;
  onSendReminder: (row: RecoveryLoanRow) => void;
  onAddNote: (row: RecoveryLoanRow) => void;
  onOpenCourtCase: (row: RecoveryLoanRow) => void;
  onWriteOff: (row: RecoveryLoanRow) => void;
}) {
  if (loading) {
    return <ArrearsTableSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <div className="py-14 text-center text-sm text-muted-foreground">
        No loans found for this recovery view.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead className="text-right">Days</TableHead>
            <TableHead className="text-right">Overdue</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[120px] text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.loanId}>
            <TableCell>
              <Link
                href={row.loanDetailUrl}
                className="font-mono text-xs font-semibold text-primary underline-offset-4 hover:underline"
              >
                {row.accountNo}
              </Link>
              <div className="mt-1 max-w-[180px] truncate text-xs text-muted-foreground">{row.productName}</div>
            </TableCell>
            <TableCell>
              <div className="font-medium">{row.clientName}</div>
              {row.clientId && <div className="text-xs text-muted-foreground">Client #{row.clientId}</div>}
            </TableCell>
            <TableCell>{row.officeName}</TableCell>
            <TableCell className="text-right">
              <Badge variant="outline" className={cn("tabular-nums", getBucketBadgeClass(row.bucket))}>
                {row.daysPastDue}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatCurrency(row.overdueAmount, row.currencyCode)}
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(row.outstandingAmount, row.currencyCode)}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary">{row.status}</Badge>
                {(row.isNpa || row.daysPastDue >= 90) && (
                  <Badge variant="outline" className="border-red-500 text-red-700 dark:text-red-300">
                    {row.npaStatus}
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-auto flex w-[104px] justify-between gap-2">
                    Action
                    {actionKey?.startsWith(`${row.loanId}:`) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {isNpaView ? (
                    <>
                      <DropdownMenuItem
                        onClick={() => onOpenCourtCase(row)}
                        disabled={actionKey === `${row.loanId}:court-case`}
                      >
                        {actionKey === `${row.loanId}:court-case` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Gavel className="h-4 w-4" />
                        )}
                        Court case
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={row.loanDetailUrl}>
                          <ExternalLink className="h-4 w-4" />
                          Open loan account
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => onWriteOff(row)}>
                        <FileX2 className="h-4 w-4" />
                        Write off loan
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem
                        onClick={() => onSendReminder(row)}
                        disabled={actionKey === `${row.loanId}:reminder`}
                      >
                        {actionKey === `${row.loanId}:reminder` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Bell className="h-4 w-4" />
                        )}
                        Send reminder SMS
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAddNote(row)}>
                        <StickyNote className="h-4 w-4" />
                        Add follow-up note
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href={row.loanDetailUrl}>
                          <ExternalLink className="h-4 w-4" />
                          Open loan account
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pagination && (
        <div className="flex flex-col gap-2 border-t pt-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            Page {pagination.page} · Showing {pagination.rowCount} of up to {pagination.pageSize} rows
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={!pagination.hasPreviousPage}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={!pagination.hasNextPage}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ArrearsTableSkeleton() {
  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead className="text-right">Days</TableHead>
            <TableHead className="text-right">Overdue</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[120px] text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, index) => (
            <TableRow key={`recovery-row-skeleton-${index}`}>
              <TableCell>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2 h-3 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-20" />
              </TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="ml-auto h-6 w-12 rounded-full" /></TableCell>
              <TableCell><Skeleton className="ml-auto h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="ml-auto h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
              <TableCell><Skeleton className="ml-auto h-8 w-[104px]" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-between border-t pt-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </div>
  );
}

function BranchPerformanceTable({
  rows,
  currencyCode,
  loading,
}: {
  rows: OfficeRecoveryPerformance[];
  currencyCode: string;
  loading: boolean;
}) {
  if (loading) {
    return <BranchPerformanceSkeleton />;
  }

  if (rows.length === 0) {
    return <div className="py-14 text-center text-sm text-muted-foreground">No branch performance data found.</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Branch</TableHead>
          <TableHead className="text-right">Active</TableHead>
          <TableHead className="text-right">PAR30</TableHead>
          <TableHead className="text-right">PAR60</TableHead>
          <TableHead className="text-right">PAR90</TableHead>
          <TableHead className="text-right">NPA</TableHead>
          <TableHead className="text-right">Overdue</TableHead>
          <TableHead className="text-right">PAR30 Exposure</TableHead>
          <TableHead className="text-right">Active Loans Not In Arrears</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.officeId ?? "none"}-${row.officeName}`}>
            <TableCell className="font-medium">{row.officeName}</TableCell>
            <TableCell className="text-right tabular-nums">{row.activeLoanCount}</TableCell>
            <TableCell className="text-right tabular-nums">{row.par30LoanCount}</TableCell>
            <TableCell className="text-right tabular-nums">{row.par60LoanCount}</TableCell>
            <TableCell className="text-right tabular-nums">{row.par90LoanCount}</TableCell>
            <TableCell className="text-right tabular-nums">{row.npaLoanCount}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.overdueAmount, currencyCode)}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.par30OutstandingAmount, currencyCode)}</TableCell>
            <TableCell className="text-right">{formatPercent(row.currentRate)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function BranchPerformanceSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Branch</TableHead>
          <TableHead className="text-right">Active</TableHead>
          <TableHead className="text-right">PAR30</TableHead>
          <TableHead className="text-right">PAR60</TableHead>
          <TableHead className="text-right">PAR90</TableHead>
          <TableHead className="text-right">NPA</TableHead>
          <TableHead className="text-right">Active Loans Not In Arrears</TableHead>
          <TableHead className="text-right">PAR30 Exposure</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 8 }).map((_, index) => (
          <TableRow key={`branch-performance-skeleton-${index}`}>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="ml-auto h-4 w-12" /></TableCell>
            <TableCell><Skeleton className="ml-auto h-4 w-12" /></TableCell>
            <TableCell><Skeleton className="ml-auto h-4 w-12" /></TableCell>
            <TableCell><Skeleton className="ml-auto h-4 w-12" /></TableCell>
            <TableCell><Skeleton className="ml-auto h-4 w-12" /></TableCell>
            <TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell>
            <TableCell><Skeleton className="ml-auto h-4 w-24" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CourtCasesTable({
  rows,
  loading,
  onViewProceedings,
}: {
  rows: CourtReportRow[];
  loading: boolean;
  onViewProceedings: (row: CourtReportRow) => void;
}) {
  if (loading) {
    return <CourtCasesSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <div className="py-14 text-center text-sm text-muted-foreground">
        No court cases found. Run the recovery report setup if this is the first time using this module.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Case</TableHead>
          <TableHead>Court</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Next Hearing</TableHead>
          <TableHead>Outcome</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={`${row.id ?? index}-${row.loan_id ?? "loan"}`}>
            <TableCell>
              <div className="font-mono text-xs">{row.loan_account_no || row.loan_id || "-"}</div>
              <div className="mt-1 max-w-[180px] truncate text-xs text-muted-foreground">{row.product_name || "-"}</div>
            </TableCell>
            <TableCell>
              <div className="font-medium">{row.client_name || "-"}</div>
              <div className="text-xs text-muted-foreground">{row.office_name || "Unassigned"}</div>
            </TableCell>
            <TableCell>
              <div className="font-medium">{row.case_number || "-"}</div>
              <div className="text-xs text-muted-foreground">{row.lawyer_name || "No lawyer recorded"}</div>
            </TableCell>
            <TableCell>{row.court_name || "-"}</TableCell>
            <TableCell>{formatDate(row.started_on_date)}</TableCell>
            <TableCell><Badge variant="secondary">{row.status || "Started"}</Badge></TableCell>
            <TableCell>{formatDate(row.next_hearing_date)}</TableCell>
            <TableCell className="max-w-[220px] truncate">{row.outcome || row.notes || "-"}</TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-auto flex w-[104px] justify-between gap-2">
                    Action
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => onViewProceedings(row)} disabled={!row.loan_id}>
                    <MessageSquarePlus className="h-4 w-4" />
                    View proceedings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {row.client_id && row.loan_id ? (
                    <DropdownMenuItem asChild>
                      <Link href={`/clients/${row.client_id}/loans/${row.loan_id}`}>
                        <ExternalLink className="h-4 w-4" />
                        Open loan
                      </Link>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem disabled>
                      <ExternalLink className="h-4 w-4" />
                      Open loan
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CourtCasesSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Account</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Case</TableHead>
          <TableHead>Court</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Next Hearing</TableHead>
          <TableHead>Outcome</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 8 }).map((_, index) => (
          <TableRow key={`court-case-skeleton-${index}`}>
            <TableCell>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-3 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-3 w-20" />
            </TableCell>
            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
            <TableCell><Skeleton className="ml-auto h-8 w-36" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function normalizeCaseNumber(value?: string) {
  return value?.trim().toLowerCase() || "";
}

function CourtCaseDetails({
  data,
  caseNumber,
  fallbackCase,
}: {
  data: LoanCourtData;
  caseNumber?: string;
  fallbackCase?: CourtReportRow;
}) {
  const normalizedCaseNumber = normalizeCaseNumber(caseNumber);
  const fallbackCourtCase: CourtCaseRecord | undefined = fallbackCase
    ? {
        id: fallbackCase.id,
        loan_id: fallbackCase.loan_id,
        case_number: fallbackCase.case_number,
        court_name: fallbackCase.court_name,
        filing_date: fallbackCase.filing_date,
        lawyer_name: fallbackCase.lawyer_name,
        status: fallbackCase.status,
        court_process_started: fallbackCase.court_process_started,
        started_on_date: fallbackCase.started_on_date,
        started_by: fallbackCase.started_by,
        next_hearing_date: fallbackCase.next_hearing_date,
        outcome: fallbackCase.outcome,
        notes: fallbackCase.notes,
      }
    : undefined;
  const courtCase = normalizedCaseNumber
    ? data.cases.find((item) => normalizeCaseNumber(item.case_number) === normalizedCaseNumber) || fallbackCourtCase || data.cases[0]
    : data.cases[0] || fallbackCourtCase;
  const proceedings = normalizedCaseNumber
    ? data.proceedings.filter((proceeding) => normalizeCaseNumber(proceeding.case_number) === normalizedCaseNumber)
    : data.proceedings;

  if (!courtCase) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-medium">{courtCase.case_number || "Court case"}</div>
            <div className="text-sm text-muted-foreground">{courtCase.court_name || "Court not recorded"}</div>
          </div>
          <Badge variant="secondary">{courtCase.status || "STARTED"}</Badge>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <CourtDetail label="Started" value={formatDate(courtCase.started_on_date)} />
          <CourtDetail label="Started By" value={courtCase.started_by || "-"} />
          <CourtDetail label="Filing Date" value={formatDate(courtCase.filing_date)} />
          <CourtDetail label="Next Hearing" value={formatDate(courtCase.next_hearing_date)} />
          <CourtDetail label="Lawyer / Agent" value={courtCase.lawyer_name || "-"} />
          <CourtDetail label="Outcome" value={courtCase.outcome || "-"} />
        </div>
        {courtCase.notes && (
          <div className="mt-4 rounded-md bg-muted p-3 text-sm">
            {courtCase.notes}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Proceedings</div>
        {proceedings.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            No proceedings have been recorded for this case.
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {proceedings.map((proceeding, index) => (
              <div key={proceeding.id ?? `${proceeding.proceeding_date}-${index}`} className="rounded-md border p-3 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-medium">{proceeding.proceeding_type || "Proceeding"}</div>
                    <div className="text-muted-foreground">{formatDate(proceeding.proceeding_date)}</div>
                  </div>
                  <Badge variant="outline">{proceeding.status || "RECORDED"}</Badge>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <CourtDetail label="Next Hearing" value={formatDate(proceeding.next_hearing_date)} />
                  <CourtDetail label="Recorded By" value={proceeding.recorded_by || "-"} />
                  <CourtDetail label="Outcome" value={proceeding.outcome || "-"} />
                  <CourtDetail label="Case Number" value={proceeding.case_number || courtCase.case_number || "-"} />
                </div>
                {proceeding.notes && (
                  <div className="mt-3 rounded-md bg-muted p-2 text-muted-foreground">
                    {proceeding.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CourtDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "-"}</div>
    </div>
  );
}

function requiredControlClass(value: string) {
  return value.trim() ? undefined : "border-destructive focus-visible:ring-destructive/30";
}

function CourtCaseFields({
  form,
  setForm,
}: {
  form: CourtCaseForm;
  setForm: (form: CourtCaseForm) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Case Number" id="caseNumber" required>
        <Input
          id="caseNumber"
          value={form.caseNumber}
          onChange={(event) => setForm({ ...form, caseNumber: event.target.value })}
          className={requiredControlClass(form.caseNumber)}
          required
        />
      </Field>
      <Field label="Court Name" id="courtName" required>
        <Input
          id="courtName"
          value={form.courtName}
          onChange={(event) => setForm({ ...form, courtName: event.target.value })}
          className={requiredControlClass(form.courtName)}
          required
        />
      </Field>
      <Field label="Filing Date" id="filingDate">
        <Input id="filingDate" type="date" value={form.filingDate} onChange={(event) => setForm({ ...form, filingDate: event.target.value })} />
      </Field>
      <Field label="Lawyer / Agent" id="lawyerName">
        <Input id="lawyerName" value={form.lawyerName} onChange={(event) => setForm({ ...form, lawyerName: event.target.value })} />
      </Field>
      <Field label="Status" id="caseStatus" required>
        <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
          <SelectTrigger id="caseStatus" className={requiredControlClass(form.status)}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="STARTED">Started</SelectItem>
            <SelectItem value="FILED">Filed</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="JUDGEMENT">Judgement</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Started On" id="startedOnDate" required>
        <Input
          id="startedOnDate"
          type="date"
          value={form.startedOnDate}
          onChange={(event) => setForm({ ...form, startedOnDate: event.target.value })}
          className={requiredControlClass(form.startedOnDate)}
          required
        />
      </Field>
      <Field label="Next Hearing" id="nextHearingDate">
        <Input id="nextHearingDate" type="date" value={form.nextHearingDate} onChange={(event) => setForm({ ...form, nextHearingDate: event.target.value })} />
      </Field>
      <Field label="Outcome" id="caseOutcome">
        <Input id="caseOutcome" value={form.outcome} onChange={(event) => setForm({ ...form, outcome: event.target.value })} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Notes" id="caseNotes">
          <Textarea id="caseNotes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} />
        </Field>
      </div>
    </div>
  );
}

function ProceedingFields({
  form,
  setForm,
}: {
  form: ProceedingForm;
  setForm: (form: ProceedingForm) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Case Number" id="proceedingCaseNumber" required>
        <Input
          id="proceedingCaseNumber"
          value={form.caseNumber}
          onChange={(event) => setForm({ ...form, caseNumber: event.target.value })}
          className={requiredControlClass(form.caseNumber)}
          required
        />
      </Field>
      <Field label="Proceeding Date" id="proceedingDate" required>
        <Input
          id="proceedingDate"
          type="date"
          value={form.proceedingDate}
          onChange={(event) => setForm({ ...form, proceedingDate: event.target.value })}
          className={requiredControlClass(form.proceedingDate)}
          required
        />
      </Field>
      <Field label="Type" id="proceedingType" required>
        <Input
          id="proceedingType"
          value={form.proceedingType}
          onChange={(event) => setForm({ ...form, proceedingType: event.target.value })}
          placeholder="Hearing, filing, judgement..."
          className={requiredControlClass(form.proceedingType)}
          required
        />
      </Field>
      <Field label="Status" id="proceedingStatus" required>
        <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
          <SelectTrigger id="proceedingStatus" className={requiredControlClass(form.status)}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="RECORDED">Recorded</SelectItem>
            <SelectItem value="ADJOURNED">Adjourned</SelectItem>
            <SelectItem value="HEARD">Heard</SelectItem>
            <SelectItem value="JUDGEMENT">Judgement</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Next Hearing" id="proceedingNextHearing">
        <Input id="proceedingNextHearing" type="date" value={form.nextHearingDate} onChange={(event) => setForm({ ...form, nextHearingDate: event.target.value })} />
      </Field>
      <Field label="Outcome" id="proceedingOutcome">
        <Input id="proceedingOutcome" value={form.outcome} onChange={(event) => setForm({ ...form, outcome: event.target.value })} />
      </Field>
      <div className="md:col-span-2">
        <Field label="Notes" id="proceedingNotes">
          <Textarea id="proceedingNotes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={4} />
        </Field>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  required = false,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
