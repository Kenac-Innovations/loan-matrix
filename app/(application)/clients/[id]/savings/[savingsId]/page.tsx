"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  TrendingDown,
  TrendingUp,
  List,
  BarChart3,
  RefreshCw,
  Clock,
  FileText,
  ExternalLink,
  MoreVertical,
  Wallet,
  CreditCard,
  Activity,
} from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";
import Link from "next/link";

interface Repayment {
  id: string;
  amount: number;
  repaidAt: string;
  note: string | null;
  recordedByUserName: string | null;
  fineractTransactionId: string | null;
}

interface Drawdown {
  id: string;
  requestedAmount: number;
  disbursedAmount: number | null;
  status: string;
  disbursedAt: string | null;
  note: string | null;
  disbursedByUserName: string | null;
  fineractTransactionId: string | null;
  repayments: Repayment[];
}

interface Facility {
  id: string;
  creditLimit: number;
  availableBalance: number;
  utilizedAmount: number;
  tenorMonths: number | null;
  nominalInterestRate: number | null;
  maxDrawdowns: number;
  drawdownCount: number;
  activatedAt: string;
  leadId: string;
}

interface FineractTransaction {
  id: number;
  transactionType: { value: string };
  date: number[];
  amount: number;
  runningBalance: number;
  reversed: boolean;
}

// ── Shared format helper ──────────────────────────────────────────────────────
function formatDisplayAmount(raw: string) {
  const digits = raw.replace(/[^0-9.]/g, "");
  const parts = digits.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

// ── Drawdown modal ────────────────────────────────────────────────────────────
function DrawdownModal({
  isOpen, onClose, leadId, availableBalance, onSuccess,
}: {
  isOpen: boolean; onClose: () => void; leadId: string;
  availableBalance: number; onSuccess: () => void;
}) {
  const { formatAmount } = useCurrency();
  const [displayAmount, setDisplayAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rawAmount = displayAmount.replace(/,/g, "");

  const handleClose = () => {
    setDisplayAmount(""); setTransactionDate(new Date().toISOString().split("T")[0]);
    setNote(""); setError(null); onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    const parsed = parseFloat(rawAmount);
    if (!parsed || parsed <= 0) { setError("Please enter a valid amount."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/facility/drawdown`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, transactionDate, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process drawdown");
      onSuccess(); handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-blue-600" />
            Record Drawdown
          </DialogTitle>
          <DialogDescription>Withdraw funds from the revolving credit facility.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Utilized</p>
            <p className="text-xl font-bold text-blue-600">{formatAmount(availableBalance)}</p>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="dd-amount">Amount *</Label>
            <Input id="dd-amount" inputMode="decimal" placeholder="0"
              value={displayAmount} onChange={(e) => setDisplayAmount(formatDisplayAmount(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dd-date">Transaction Date *</Label>
            <Input id="dd-date" type="date" value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dd-note">Note</Label>
            <Textarea id="dd-note" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !rawAmount} className="bg-blue-600 hover:bg-blue-700">
            {submitting ? "Processing..." : "Confirm Drawdown"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Repayment modal ───────────────────────────────────────────────────────────
function RepaymentModal({
  isOpen, onClose, leadId, utilizedAmount, onSuccess,
}: {
  isOpen: boolean; onClose: () => void; leadId: string;
  utilizedAmount: number; onSuccess: () => void;
}) {
  const { formatAmount } = useCurrency();
  const [displayAmount, setDisplayAmount] = useState("");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rawAmount = displayAmount.replace(/,/g, "");

  const handleClose = () => {
    setDisplayAmount(""); setTransactionDate(new Date().toISOString().split("T")[0]);
    setNote(""); setError(null); onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    const parsed = parseFloat(rawAmount);
    if (!parsed || parsed <= 0) { setError("Please enter a valid amount."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/facility/repayment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, transactionDate, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record repayment");
      onSuccess(); handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Record Repayment
          </DialogTitle>
          <DialogDescription>Deposit a repayment into the revolving credit facility.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Outstanding Balance</p>
            <p className="text-xl font-bold text-green-600">{formatAmount(utilizedAmount)}</p>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="rp-amount">Amount *</Label>
            <Input id="rp-amount" inputMode="decimal" placeholder="0"
              value={displayAmount} onChange={(e) => setDisplayAmount(formatDisplayAmount(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-date">Transaction Date *</Label>
            <Input id="rp-date" type="date" value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rp-note">Note</Label>
            <Textarea id="rp-note" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !rawAmount} className="bg-green-600 hover:bg-green-700">
            {submitting ? "Processing..." : "Confirm Repayment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-32" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <Skeleton className="h-16 rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SavingsDetailPage() {
  const params = useParams<{ id: string; savingsId: string }>();
  const router = useRouter();
  const { formatAmount } = useCurrency();

  const [facility, setFacility] = useState<Facility | null>(null);
  const [drawdowns, setDrawdowns] = useState<Drawdown[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [transactions, setTransactions] = useState<FineractTransaction[]>([]);
  const [savingsData, setSavingsData] = useState<any>(null);
  const [savingsActive, setSavingsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDrawdown, setShowDrawdown] = useState(false);
  const [showRepayment, setShowRepayment] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/fineract/savings/${params.savingsId}`);
      if (!res.ok) throw new Error("Savings account not found");
      const savingsData = await res.json();
      setSavingsData(savingsData);
      setSavingsActive(savingsData?.status?.active === true);
      setTransactions(Array.isArray(savingsData.transactions) ? savingsData.transactions : []);

      const facilityRes = await fetch(`/api/rcf/facilities?fineractSavingsAccountId=${params.savingsId}`);
      if (facilityRes.ok) {
        const facilityData = await facilityRes.json();
        if (facilityData) {
          setFacility(facilityData);
          const [ddRes, rpRes] = await Promise.all([
            fetch(`/api/rcf/facilities/${facilityData.id}/drawdowns`),
            fetch(`/api/rcf/facilities/${facilityData.id}/repayments`),
          ]);
          if (ddRes.ok) setDrawdowns(await ddRes.json());
          if (rpRes.ok) setRepayments(await rpRes.json());
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [params.savingsId]);

  useEffect(() => { load(); }, [load]);

  const handleActionSuccess = () => {
    setShowDrawdown(false);
    setShowRepayment(false);
    setLoading(true);
    load();
  };

  if (loading) return <PageSkeleton />;

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const canDrawdown = facility !== null && facility.drawdownCount < facility.maxDrawdowns;

  const canRepay = facility !== null;

  const utilizationPct = facility && facility.creditLimit > 0
    ? Math.round((facility.utilizedAmount / facility.creditLimit) * 100) : 0;

  const interestAccrued = Math.abs(savingsData?.summary?.interestNotPosted ?? 0);
  const totalOutstanding = (facility?.utilizedAmount ?? 0) + interestAccrued;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold">Savings Account #{params.savingsId}</h1>
          <p className="text-xs text-muted-foreground">Revolving Credit Facility</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8"
            onClick={() => { setLoading(true); load(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {facility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <MoreVertical className="h-4 w-4" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Facility Actions</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setShowDrawdown(true)}
                  disabled={!canDrawdown}
                >
                  <TrendingDown className="mr-2 h-4 w-4 text-blue-600" />
                  Record Drawdown
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowRepayment(true)}
                  disabled={!canRepay}
                >
                  <TrendingUp className="mr-2 h-4 w-4 text-green-600" />
                  Record Repayment
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Documents</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href={`/leads/${facility.leadId}/rcf-contract`}>
                    <FileText className="mr-2 h-4 w-4" />
                    View Agreement
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Navigate</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link href={`/leads/${facility.leadId}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Lead
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/clients/${params.id}`}>
                    <Wallet className="mr-2 h-4 w-4" />
                    View Client
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Status banner */}
      <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 px-5 py-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-3 w-3 rounded-full bg-green-500 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-green-700 dark:text-green-300">Active</p>
              <span className="text-xs text-muted-foreground">&middot;</span>
              <p className="text-sm font-medium">Revolving Credit Facility</p>
              {facility && (
                <>
                  <span className="text-xs text-muted-foreground">&middot;</span>
                  <Badge variant="secondary" className="text-[11px]">
                    {facility.drawdownCount}/{facility.maxDrawdowns} drawdowns used
                  </Badge>
                </>
              )}
            </div>
            {facility && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>Account #{params.savingsId}</span>
                <span>&middot;</span>
                <span>Activated {new Date(facility.activatedAt).toLocaleDateString()}</span>
                {facility.tenorMonths && (
                  <>
                    <span>&middot;</span>
                    <span>{facility.tenorMonths}mo tenor</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {facility && (
          <div className="text-xs text-muted-foreground text-right">
            <div>Utilization: <span className="font-medium text-foreground">{utilizationPct}%</span></div>
            {facility.nominalInterestRate && (
              <div>Rate: <span className="font-medium text-foreground">{facility.nominalInterestRate}% p.a.</span></div>
            )}
          </div>
        )}
      </div>

      {/* Stat cards */}
      {facility && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Credit Limit</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {formatAmount(facility.creditLimit)}
                  </p>
                </div>
                <div className="h-11 w-11 rounded-lg bg-blue-500 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-red-500 to-rose-600 dark:from-red-700 dark:to-rose-800 text-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-100/80">Outstanding Balance</p>
                  <p className="text-2xl font-bold mt-0.5 truncate">{formatAmount(totalOutstanding)}</p>
                  <div className="mt-3 border-t border-white/20 pt-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-red-100/70">+ Interest accrued</span>
                      <span className="font-semibold tabular-nums text-yellow-200">{formatAmount(interestAccrued)}</span>
                    </div>
                  </div>
                </div>
                <div className="h-9 w-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <TrendingDown className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">Utilized</p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                    {formatAmount(facility.utilizedAmount)}
                  </p>
                </div>
                <div className="h-11 w-11 rounded-lg bg-orange-500 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">Available</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {formatAmount(facility.availableBalance)}
                  </p>
                </div>
                <div className="h-11 w-11 rounded-lg bg-green-500 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Drawdowns</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {facility.drawdownCount} <span className="text-base font-normal text-purple-600/70">/ {facility.maxDrawdowns}</span>
                  </p>
                </div>
                <div className="h-11 w-11 rounded-lg bg-purple-500 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Details
          </TabsTrigger>
          <TabsTrigger value="drawdowns" className="gap-1.5">
            <TrendingDown className="h-3.5 w-3.5" />
            Drawdowns
          </TabsTrigger>
          <TabsTrigger value="repayments" className="gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Repayments
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5">
            <List className="h-3.5 w-3.5" />
            Transactions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="space-y-4">
            {/* Account Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Account Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  {[
                    { label: "Account No", value: savingsData?.accountNo },
                    { label: "External ID", value: savingsData?.externalId || "—" },
                    { label: "Status", value: savingsData?.status?.value },
                    { label: "Savings Product", value: savingsData?.savingsProductName },
                    { label: "Currency", value: savingsData?.currency ? `${savingsData.currency.name} (${savingsData.currency.displaySymbol})` : null },
                    { label: "Field Officer", value: savingsData?.fieldOfficerName || "—" },
                    { label: "Client", value: savingsData?.clientName },
                  ].map(({ label, value }) => value != null && (
                    <div key={label} className="flex justify-between gap-4 border-b pb-2 last:border-0">
                      <span className="text-muted-foreground shrink-0">{label}</span>
                      <span className="font-medium text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            {savingsData?.timeline && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    {[
                      { label: "Submitted On", arr: savingsData.timeline.submittedOnDate, by: savingsData.timeline.submittedByUsername },
                      { label: "Approved On", arr: savingsData.timeline.approvedOnDate, by: savingsData.timeline.approvedByUsername },
                      { label: "Activated On", arr: savingsData.timeline.activatedOnDate, by: savingsData.timeline.activatedByUsername },
                      { label: "Closed On", arr: savingsData.timeline.closedOnDate, by: savingsData.timeline.closedByUsername },
                    ].map(({ label, arr, by }) => Array.isArray(arr) && arr.length >= 3 && (
                      <div key={label} className="flex justify-between gap-4 border-b pb-2 last:border-0">
                        <span className="text-muted-foreground shrink-0">{label}</span>
                        <span className="font-medium text-right">
                          {new Date(arr[0], arr[1] - 1, arr[2]).toLocaleDateString()}
                          {by && <span className="text-muted-foreground font-normal"> · {by}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Terms */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Terms</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  {[
                    { label: "Nominal Annual Interest Rate", value: savingsData?.nominalAnnualInterestRate != null ? `${savingsData.nominalAnnualInterestRate}%` : null },
                    { label: "Interest Compounding Period", value: savingsData?.interestCompoundingPeriodType?.value },
                    { label: "Interest Posting Period", value: savingsData?.interestPostingPeriodType?.value },
                    { label: "Interest Calculation", value: savingsData?.interestCalculationType?.value },
                    { label: "Days in Year", value: savingsData?.interestCalculationDaysInYearType?.value },
                  ].map(({ label, value }) => value != null && (
                    <div key={label} className="flex justify-between gap-4 border-b pb-2 last:border-0">
                      <span className="text-muted-foreground shrink-0">{label}</span>
                      <span className="font-medium text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  {[
                    { label: "Allow Overdraft", value: savingsData?.allowOverdraft != null ? (savingsData.allowOverdraft ? "Yes" : "No") : null },
                    { label: "Overdraft Limit", value: savingsData?.overdraftLimit != null ? formatAmount(savingsData.overdraftLimit) : null },
                    { label: "Nominal Annual Interest Rate (Overdraft)", value: savingsData?.nominalAnnualInterestRateOverdraft != null ? `${savingsData.nominalAnnualInterestRateOverdraft}%` : null },
                    { label: "Min Required Opening Balance", value: savingsData?.minRequiredOpeningBalance != null ? formatAmount(savingsData.minRequiredOpeningBalance) : null },
                    { label: "Enforce Min Required Balance", value: savingsData?.enforceMinRequiredBalance != null ? (savingsData.enforceMinRequiredBalance ? "Yes" : "No") : null },
                    { label: "Min Required Balance", value: savingsData?.minRequiredBalance != null ? formatAmount(savingsData.minRequiredBalance) : null },
                    { label: "Apply Withdrawal Fee for Transfers", value: savingsData?.withdrawalFeeForTransfers != null ? (savingsData.withdrawalFeeForTransfers ? "Yes" : "No") : null },
                    { label: "Lock-in Period", value: savingsData?.lockinPeriodFrequency != null && savingsData?.lockinPeriodFrequencyType?.value ? `${savingsData.lockinPeriodFrequency} ${savingsData.lockinPeriodFrequencyType.value}` : null },
                  ].map(({ label, value }) => value != null && (
                    <div key={label} className="flex justify-between gap-4 border-b pb-2 last:border-0">
                      <span className="text-muted-foreground shrink-0">{label}</span>
                      <span className="font-medium text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Summary */}
            {savingsData?.summary && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Performance History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                    {[
                      { label: "Account Balance", value: savingsData.summary.accountBalance != null ? formatAmount(savingsData.summary.accountBalance) : null },
                      { label: "Available Balance", value: savingsData.summary.availableBalance != null ? formatAmount(savingsData.summary.availableBalance) : null },
                      { label: "Total Deposits", value: savingsData.summary.totalDeposits != null ? formatAmount(savingsData.summary.totalDeposits) : null },
                      { label: "Total Withdrawals", value: savingsData.summary.totalWithdrawals != null ? formatAmount(savingsData.summary.totalWithdrawals) : null },
                      { label: "Total Interest Posted", value: savingsData.summary.totalInterestPosted != null ? formatAmount(savingsData.summary.totalInterestPosted) : null },
                      { label: "Interest Not Posted", value: savingsData.summary.interestNotPosted != null ? formatAmount(savingsData.summary.interestNotPosted) : null },
                    ].map(({ label, value }) => value != null && (
                      <div key={label} className="flex justify-between gap-4 border-b pb-2 last:border-0">
                        <span className="text-muted-foreground shrink-0">{label}</span>
                        <span className="font-medium text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Link to lead */}
            {facility?.leadId && (
              <Button variant="outline" size="sm" asChild className="w-full gap-2">
                <Link href={`/leads/${facility.leadId}`}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  View Associated Lead
                </Link>
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="drawdowns" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-medium">Drawdown History</CardTitle>
                <CardDescription className="text-xs">{drawdowns.length} drawdown(s) recorded</CardDescription>
              </div>
              {facility && (
                <Button size="sm" onClick={() => setShowDrawdown(true)} disabled={!canDrawdown}
                  className="bg-blue-600 hover:bg-blue-700 gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5" />
                  New Drawdown
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {drawdowns.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingDown className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No drawdowns recorded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {drawdowns.map((d, idx) => (
                    <div key={d.id}>
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">
                              {formatAmount(d.disbursedAmount ?? d.requestedAmount)}
                            </span>
                            <Badge variant="secondary" className="text-xs">{d.status}</Badge>
                          </div>
                          {d.disbursedAt && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(d.disbursedAt).toLocaleDateString()}
                              {d.disbursedByUserName && ` · ${d.disbursedByUserName}`}
                            </p>
                          )}
                          {d.fineractTransactionId && (
                            <p className="text-xs text-muted-foreground font-mono">
                              Txn #{d.fineractTransactionId}
                            </p>
                          )}
                          {d.note && <p className="text-xs text-muted-foreground italic">{d.note}</p>}
                        </div>
                      </div>
                      {idx < drawdowns.length - 1 && <Separator className="mt-3" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="repayments" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-medium">Repayment History</CardTitle>
                <CardDescription className="text-xs">{repayments.length} repayment(s) recorded</CardDescription>
              </div>
              {facility && (
                <Button size="sm" variant="outline" onClick={() => setShowRepayment(true)}
                  disabled={!canRepay}
                  className="border-green-600 text-green-600 hover:bg-green-50 gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  New Repayment
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {repayments.length === 0 ? (
                <div className="text-center py-8">
                  <TrendingUp className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No repayments recorded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {repayments.map((r, idx) => (
                    <div key={r.id}>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-green-600">
                            +{formatAmount(r.amount)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(r.repaidAt).toLocaleDateString()}
                          {r.recordedByUserName && ` · ${r.recordedByUserName}`}
                        </p>
                        {r.fineractTransactionId && (
                          <p className="text-xs text-muted-foreground font-mono">
                            Txn #{r.fineractTransactionId}
                          </p>
                        )}
                        {r.note && <p className="text-xs text-muted-foreground italic">{r.note}</p>}
                      </div>
                      {idx < repayments.length - 1 && <Separator className="mt-3" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Fineract Transactions</CardTitle>
              <CardDescription className="text-xs">Live ledger from savings account</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <List className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No transactions found</p>
                </div>
              ) : (
                <div className="divide-y">
                  {transactions.map((t) => {
                    const date = Array.isArray(t.date) && t.date.length >= 3
                      ? new Date(t.date[0], t.date[1] - 1, t.date[2]).toLocaleDateString() : "—";
                    const isDebit =
                      t.transactionType.value.toLowerCase().includes("withdrawal") ||
                      t.transactionType.value.toLowerCase().includes("debit");
                    return (
                      <div key={t.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-sm font-medium">{t.transactionType.value}</p>
                          <p className="text-xs text-muted-foreground">{date}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${isDebit ? "text-red-600" : "text-green-600"}`}>
                            {isDebit ? "-" : "+"}{formatAmount(t.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Bal: {formatAmount(t.runningBalance)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Modals */}
      {facility && (
        <>
          <DrawdownModal
            isOpen={showDrawdown}
            onClose={() => setShowDrawdown(false)}
            leadId={facility.leadId}
            availableBalance={facility.availableBalance}
            onSuccess={handleActionSuccess}
          />
          <RepaymentModal
            isOpen={showRepayment}
            onClose={() => setShowRepayment(false)}
            leadId={facility.leadId}
            utilizedAmount={facility.utilizedAmount}
            onSuccess={handleActionSuccess}
          />
        </>
      )}
    </div>
  );
}
