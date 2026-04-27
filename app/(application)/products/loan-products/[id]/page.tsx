"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import {
  ArrowLeft, Pencil, Calendar, Percent, Repeat2, Coins, BookOpen,
  ShieldAlert, Tag, Settings2, TrendingDown, Info, ChevronDown,
  Banknote, RefreshCw, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EnumValue { id: number; value: string; code?: string }
interface GLAccount  { id: number; name: string; glCode: string }
interface Currency   { code: string; name: string; displayLabel?: string; displaySymbol?: string }
interface Charge     { id: number; name: string; amount: number; penalty: boolean; chargeTimeType?: EnumValue; chargeCalculationType?: EnumValue }

interface LoanProduct {
  id: number;
  name: string;
  shortName: string;
  description?: string;
  externalId?: string;
  currency: Currency;
  digitsAfterDecimal: number;
  inMultiplesOf?: number;
  installmentAmountInMultiplesOf?: number;
  principal?: number;
  minPrincipal?: number;
  maxPrincipal?: number;
  numberOfRepayments?: number;
  minNumberOfRepayments?: number;
  maxNumberOfRepayments?: number;
  repaymentEvery?: number;
  repaymentFrequencyType?: EnumValue;
  minimumDaysBetweenDisbursalAndFirstRepayment?: number;
  repaymentStartDateType?: EnumValue;
  fixedLength?: number;
  interestRatePerPeriod?: number;
  minInterestRatePerPeriod?: number;
  maxInterestRatePerPeriod?: number;
  interestRateFrequencyType?: EnumValue;
  interestType?: EnumValue;
  amortizationType?: EnumValue;
  interestCalculationPeriodType?: EnumValue;
  allowPartialPeriodInterestCalculation?: boolean;
  allowPartialPeriodInterestCalcualtion?: boolean;
  transactionProcessingStrategyName?: string;
  transactionProcessingStrategyCode?: string;
  daysInYearType?: EnumValue;
  daysInMonthType?: EnumValue;
  graceOnPrincipalPayment?: number;
  graceOnInterestPayment?: number;
  graceOnInterestCharged?: number;
  graceOnArrearsAgeing?: number;
  inArrearsTolerance?: number;
  overdueDaysForNPA?: number;
  accountMovesOutOfNPAOnlyOnArrearsCompletion?: boolean;
  multiDisburseLoan?: boolean;
  maxTrancheCount?: number;
  outstandingLoanBalance?: number;
  disallowExpectedDisbursements?: boolean;
  isInterestRecalculationEnabled?: boolean;
  preClosureInterestCalculationStrategy?: EnumValue;
  rescheduleStrategyMethod?: EnumValue;
  interestRecalculationCompoundingMethod?: EnumValue;
  recalculationRestFrequencyType?: EnumValue;
  recalculationRestFrequencyInterval?: number;
  isArrearsBasedOnOriginalSchedule?: boolean;
  holdGuaranteeFunds?: boolean;
  mandatoryGuarantee?: number;
  minimumGuaranteeFromGuarantor?: number;
  minimumGuaranteeFromOwnFunds?: number;
  allowVariableInstallments?: boolean;
  minimumGap?: number;
  maximumGap?: number;
  enableDownPayment?: boolean;
  disbursedAmountPercentageForDownPayment?: number;
  enableAutoRepaymentForDownPayment?: boolean;
  isEqualAmortization?: boolean;
  canDefineInstallmentAmount?: boolean;
  canUseForTopup?: boolean;
  includeInBorrowerCycle?: boolean;
  useBorrowerCycle?: boolean;
  interestRecognitionOnDisbursementDate?: boolean;
  loanScheduleType?: EnumValue;
  loanScheduleProcessingType?: EnumValue;
  enableInstallmentLevelDelinquency?: boolean;
  delinquencyBucket?: { id: number; name: string };
  accountingRule?: EnumValue;
  // Fineract nests all GL account objects under accountingMappings
  accountingMappings?: {
    fundSourceAccount?: GLAccount;
    loanPortfolioAccount?: GLAccount;
    transfersInSuspenseAccount?: GLAccount;
    interestOnLoanAccount?: GLAccount;
    incomeFromFeeAccount?: GLAccount;
    incomeFromPenaltyAccount?: GLAccount;
    incomeFromRecoveryAccount?: GLAccount;
    incomeFromChargeOffInterestAccount?: GLAccount;
    incomeFromChargeOffFeesAccount?: GLAccount;
    incomeFromChargeOffPenaltyAccount?: GLAccount;
    incomeFromGoodwillCreditInterestAccount?: GLAccount;
    incomeFromGoodwillCreditFeesAccount?: GLAccount;
    incomeFromGoodwillCreditPenaltyAccount?: GLAccount;
    writeOffAccount?: GLAccount;
    goodwillCreditAccount?: GLAccount;
    chargeOffExpenseAccount?: GLAccount;
    chargeOffFraudExpenseAccount?: GLAccount;
    overpaymentLiabilityAccount?: GLAccount;
    receivableInterestAccount?: GLAccount;
    receivableFeeAccount?: GLAccount;
    receivablePenaltyAccount?: GLAccount;
  };
  // Advanced accounting mappings (top-level arrays)
  paymentChannelToFundSourceMappings?: Array<{
    paymentType: { id: number; name: string };
    fundSourceAccount: GLAccount;
  }>;
  feeToIncomeAccountMappings?: Array<{
    charge: { id: number; name: string };
    incomeAccount: GLAccount;
  }>;
  penaltyToIncomeAccountMappings?: Array<{
    charge: { id: number; name: string };
    incomeAccount: GLAccount;
  }>;
  chargeOffReasonToExpenseAccountMappings?: Array<{
    chargeOffReasonCodeValue: { id: number; name: string };
    expenseAccount: GLAccount;
  }>;
  charges?: Charge[];
  startDate?: string;
  closeDate?: string;
  status?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function InfoGrid({ rows }: { rows: { label: string; value?: string | number | null | boolean }[] }) {
  const visible = rows.filter((r) => r.value !== undefined && r.value !== null && r.value !== "" && r.value !== 0);
  if (visible.length === 0) return <p className="text-sm text-muted-foreground italic">No data configured.</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {visible.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-foreground">
            {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function GLRow({ label, account }: { label: string; account?: GLAccount }) {
  if (!account) return null;
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold">
        <span className="text-muted-foreground">{account.glCode} · </span>{account.name}
      </span>
    </div>
  );
}

function GLSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function MappingTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (rows.length === 0) return <p className="text-xs text-muted-foreground italic">No mappings configured.</p>;
  return (
    <div className="rounded-md border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountingRuleBadge({ rule }: { rule?: EnumValue }) {
  if (!rule) return <span className="text-muted-foreground">—</span>;
  const colors: Record<number, string> = {
    1: "bg-muted text-muted-foreground",
    2: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    3: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    4: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", colors[rule.id] ?? "bg-muted text-muted-foreground")}>
      {rule.value}
    </span>
  );
}

function AccordionSection({
  value, icon, title, badge, children,
}: {
  value: string;
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/40 [&[data-state=open]]:bg-muted/30">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
            {icon}
          </span>
          <span className="text-sm font-semibold">{title}</span>
          {badge && <span className="ml-1">{badge}</span>}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5 pt-2">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", accent ?? "bg-primary/10 text-primary")}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xl font-bold leading-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LoanProductViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [product, setProduct] = useState<LoanProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/fineract/loanproducts/${id}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error || "Failed to load product");
        setProduct(body);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load product");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  if (isLoading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-36 rounded-md" />
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2"><Skeleton className="h-9 w-72" /><Skeleton className="h-4 w-48" /></div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
    </div>
  );

  if (loadError) return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild><Link href="/products/loan-products"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{loadError}</div>
    </div>
  );

  if (!product) return null;

  const sym      = product.currency?.displaySymbol ?? product.currency?.code ?? "";
  const charges  = (product.charges ?? []).filter((c) => !c.penalty);
  const penalties = (product.charges ?? []).filter((c) => c.penalty);
  const hasGL    = product.accountingRule && product.accountingRule.id !== 1;
  const isAccrual = product.accountingRule && (product.accountingRule.id === 3 || product.accountingRule.id === 4);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/products/loan-products"><ArrowLeft className="mr-2 h-4 w-4" />Back to Loan Products</Link>
      </Button>

      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <Badge variant="outline" className="text-sm font-mono">{product.shortName}</Badge>
          </div>
          {product.description && <p className="mt-1 max-w-2xl text-muted-foreground">{product.description}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AccountingRuleBadge rule={product.accountingRule} />
            {product.includeInBorrowerCycle && <Badge variant="secondary">Borrower Cycle</Badge>}
            {product.canUseForTopup && <Badge variant="secondary">Top-Up Eligible</Badge>}
            {product.multiDisburseLoan && <Badge variant="secondary">Multi-Disbursement</Badge>}
            {product.enableDownPayment && <Badge variant="secondary">Down Payment</Badge>}
          </div>
        </div>
        <Button asChild>
          <Link href={`/products/loan-products/${id}/edit`}><Pencil className="mr-2 h-4 w-4" />Edit Product</Link>
        </Button>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Coins className="h-5 w-5" />}
          label="Default Principal"
          value={product.principal != null ? `${sym}${product.principal.toLocaleString()}` : "—"}
          sub={product.minPrincipal != null && product.maxPrincipal != null ? `Range: ${sym}${product.minPrincipal.toLocaleString()} – ${sym}${product.maxPrincipal.toLocaleString()}` : undefined}
          accent="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
        />
        <StatCard
          icon={<Percent className="h-5 w-5" />}
          label="Interest Rate"
          value={product.interestRatePerPeriod != null ? `${product.interestRatePerPeriod}% / ${product.interestRateFrequencyType?.value ?? "period"}` : "—"}
          sub={product.interestType?.value}
          accent="bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400"
        />
        <StatCard
          icon={<Repeat2 className="h-5 w-5" />}
          label="Repayment Schedule"
          value={product.numberOfRepayments != null ? `${product.numberOfRepayments} repayments` : "—"}
          sub={product.repaymentEvery != null && product.repaymentFrequencyType ? `Every ${product.repaymentEvery} ${product.repaymentFrequencyType.value}` : undefined}
          accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
        />
      </div>

      {/* Accordion sections */}
      <Accordion type="multiple" defaultValue={["details", "currency", "terms", "settings"]} className="space-y-3">

        {/* Details */}
        <AccordionSection value="details" icon={<Info className="h-4 w-4" />} title="Details & Availability">
          <InfoGrid rows={[
            { label: "External ID", value: product.externalId },
            { label: "Start Date", value: product.startDate },
            { label: "Close Date", value: product.closeDate },
            { label: "Include in Borrower Cycle", value: product.includeInBorrowerCycle },
            { label: "Use Borrower Cycle", value: product.useBorrowerCycle },
            { label: "Can Use for Top-Up", value: product.canUseForTopup },
            { label: "Is Invoice Discounting", value: undefined },
          ]} />
        </AccordionSection>

        {/* Currency */}
        <AccordionSection value="currency" icon={<Coins className="h-4 w-4" />} title="Currency">
          <InfoGrid rows={[
            { label: "Currency", value: product.currency?.displayLabel ?? product.currency?.code },
            { label: "Decimal Places", value: product.digitsAfterDecimal },
            { label: "Currency in Multiples Of", value: product.inMultiplesOf },
            { label: "Installment Amount in Multiples Of", value: product.installmentAmountInMultiplesOf },
          ]} />
        </AccordionSection>

        {/* Terms */}
        <AccordionSection value="terms" icon={<TrendingDown className="h-4 w-4" />} title="Terms">
          <InfoGrid rows={[
            { label: "Principal", value: product.principal != null ? `${sym}${product.principal.toLocaleString()}` : undefined },
            { label: "Min Principal", value: product.minPrincipal != null ? `${sym}${product.minPrincipal.toLocaleString()}` : undefined },
            { label: "Max Principal", value: product.maxPrincipal != null ? `${sym}${product.maxPrincipal.toLocaleString()}` : undefined },
            { label: "Number of Repayments", value: product.numberOfRepayments },
            { label: "Min Repayments", value: product.minNumberOfRepayments },
            { label: "Max Repayments", value: product.maxNumberOfRepayments },
            { label: "Repayment Every", value: product.repaymentEvery != null && product.repaymentFrequencyType ? `${product.repaymentEvery} ${product.repaymentFrequencyType.value}` : undefined },
            { label: "Min Days Before First Repayment", value: product.minimumDaysBetweenDisbursalAndFirstRepayment },
            { label: "Repayment Start Date Type", value: product.repaymentStartDateType?.value },
            { label: "Fixed Length", value: product.fixedLength },
            { label: "Interest Rate", value: product.interestRatePerPeriod != null ? `${product.interestRatePerPeriod}% / ${product.interestRateFrequencyType?.value ?? "period"}` : undefined },
            { label: "Min Interest Rate", value: product.minInterestRatePerPeriod != null ? `${product.minInterestRatePerPeriod}%` : undefined },
            { label: "Max Interest Rate", value: product.maxInterestRatePerPeriod != null ? `${product.maxInterestRatePerPeriod}%` : undefined },
            { label: "Interest Type", value: product.interestType?.value },
            { label: "Amortization", value: product.amortizationType?.value },
            { label: "Interest Calculation Period", value: product.interestCalculationPeriodType?.value },
            {
              label: "Allow Partial Period Interest",
              value:
                product.allowPartialPeriodInterestCalculation ??
                product.allowPartialPeriodInterestCalcualtion,
            },
            { label: "Repayment Strategy", value: product.transactionProcessingStrategyName ?? product.transactionProcessingStrategyCode },
            { label: "Loan Schedule Type", value: product.loanScheduleType?.value },
            { label: "Loan Schedule Processing Type", value: product.loanScheduleProcessingType?.value },
            { label: "Days in Year", value: product.daysInYearType?.value },
            { label: "Days in Month", value: product.daysInMonthType?.value },
            { label: "Interest Recognition on Disbursement", value: product.interestRecognitionOnDisbursementDate },
          ]} />
        </AccordionSection>

        {/* Settings */}
        <AccordionSection value="settings" icon={<Settings2 className="h-4 w-4" />} title="Settings">
          <div className="space-y-6">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Grace & Tolerance</p>
              <InfoGrid rows={[
                { label: "Grace on Principal (periods)", value: product.graceOnPrincipalPayment },
                { label: "Grace on Interest (periods)", value: product.graceOnInterestPayment },
                { label: "Grace on Interest Charged (periods)", value: product.graceOnInterestCharged },
                { label: "Arrears Ageing Grace (days)", value: product.graceOnArrearsAgeing },
                { label: "In Arrears Tolerance", value: product.inArrearsTolerance },
                { label: "Overdue Days for NPA", value: product.overdueDaysForNPA },
                { label: "NPA clears only on full arrears", value: product.accountMovesOutOfNPAOnlyOnArrearsCompletion },
              ]} />
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Multi-Disbursement</p>
              <InfoGrid rows={[
                { label: "Multi-Disbursement", value: product.multiDisburseLoan },
                { label: "Max Tranches", value: product.maxTrancheCount },
                { label: "Max Outstanding Balance", value: product.outstandingLoanBalance != null ? `${sym}${product.outstandingLoanBalance.toLocaleString()}` : undefined },
                { label: "Disallow Expected Disbursements", value: product.disallowExpectedDisbursements },
              ]} />
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interest Recalculation</p>
              <InfoGrid rows={[
                { label: "Interest Recalculation Enabled", value: product.isInterestRecalculationEnabled },
                { label: "Pre-Closure Interest Strategy", value: product.preClosureInterestCalculationStrategy?.value },
                { label: "Reschedule Strategy", value: product.rescheduleStrategyMethod?.value },
                { label: "Compounding Method", value: product.interestRecalculationCompoundingMethod?.value },
                { label: "Rest Frequency Type", value: product.recalculationRestFrequencyType?.value },
                { label: "Rest Frequency Interval", value: product.recalculationRestFrequencyInterval },
                { label: "Arrears Based on Original Schedule", value: product.isArrearsBasedOnOriginalSchedule },
              ]} />
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other Settings</p>
              <InfoGrid rows={[
                { label: "Equal Amortization", value: product.isEqualAmortization },
                { label: "Can Define Installment Amount", value: product.canDefineInstallmentAmount },
                { label: "Variable Installments", value: product.allowVariableInstallments },
                { label: "Min Gap (variable installments)", value: product.minimumGap },
                { label: "Max Gap (variable installments)", value: product.maximumGap },
                { label: "Down Payment Enabled", value: product.enableDownPayment },
                { label: "Down Payment %", value: product.disbursedAmountPercentageForDownPayment != null ? `${product.disbursedAmountPercentageForDownPayment}%` : undefined },
                { label: "Auto Repayment for Down Payment", value: product.enableAutoRepaymentForDownPayment },
                { label: "Hold Guarantee Funds", value: product.holdGuaranteeFunds },
                { label: "Mandatory Guarantee", value: product.mandatoryGuarantee },
                { label: "Min Guarantee from Guarantor", value: product.minimumGuaranteeFromGuarantor },
                { label: "Min Guarantee from Own Funds", value: product.minimumGuaranteeFromOwnFunds },
                { label: "Delinquency Bucket", value: product.delinquencyBucket?.name },
                { label: "Installment Level Delinquency", value: product.enableInstallmentLevelDelinquency },
              ]} />
            </div>
          </div>
        </AccordionSection>

        {/* Charges & Penalties */}
        {(charges.length > 0 || penalties.length > 0) && (
          <AccordionSection
            value="charges"
            icon={<Tag className="h-4 w-4" />}
            title="Charges & Penalties"
            badge={<Badge variant="secondary" className="text-xs">{charges.length + penalties.length}</Badge>}
          >
            <div className="space-y-4">
              {charges.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Charges</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {charges.map((c) => (
                      <div key={c.id} className="flex items-start gap-3 rounded-lg border bg-blue-50/50 p-3 dark:bg-blue-950/20">
                        <Tag className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.chargeCalculationType?.value} · {c.chargeTimeType?.value}</p>
                          <p className="text-xs font-medium">{sym}{c.amount.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {penalties.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Penalties</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {penalties.map((c) => (
                      <div key={c.id} className="flex items-start gap-3 rounded-lg border bg-orange-50/50 p-3 dark:bg-orange-950/20">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.chargeCalculationType?.value} · {c.chargeTimeType?.value}</p>
                          <p className="text-xs font-medium">{sym}{c.amount.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AccordionSection>
        )}

        {/* Accounting */}
        <AccordionSection
          value="accounting"
          icon={<BookOpen className="h-4 w-4" />}
          title="Accounting"
          badge={<AccountingRuleBadge rule={product.accountingRule} />}
        >
          <div className="space-y-5">
            {!hasGL && (
              <div className="flex items-start gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                No GL account mappings required for the selected accounting rule.
              </div>
            )}

            {hasGL && (
              <>
                {(() => {
                  const am = product.accountingMappings ?? {};
                  return (
                    <>
                      <GLSection title="Fund Source">
                        <GLRow label="Fund source" account={am.fundSourceAccount} />
                      </GLSection>

                      <GLSection title="Assets">
                        <GLRow label="Loan portfolio" account={am.loanPortfolioAccount} />
                        <GLRow label="Transfer in suspense" account={am.transfersInSuspenseAccount} />
                        {isAccrual && (
                          <>
                            <GLRow label="Interest Receivable" account={am.receivableInterestAccount} />
                            <GLRow label="Fees Receivable" account={am.receivableFeeAccount} />
                            <GLRow label="Penalties Receivable" account={am.receivablePenaltyAccount} />
                          </>
                        )}
                      </GLSection>

                      <GLSection title="Income">
                        <GLRow label="Income from Interest" account={am.interestOnLoanAccount} />
                        <GLRow label="Income from fees" account={am.incomeFromFeeAccount} />
                        <GLRow label="Income from penalties" account={am.incomeFromPenaltyAccount} />
                        <GLRow label="Income from Recovery Repayments" account={am.incomeFromRecoveryAccount} />
                        <GLRow label="Income from ChargeOff Interest" account={am.incomeFromChargeOffInterestAccount} />
                        <GLRow label="Income from ChargeOff Fees" account={am.incomeFromChargeOffFeesAccount} />
                        <GLRow label="Income from ChargeOff Penalty" account={am.incomeFromChargeOffPenaltyAccount} />
                        <GLRow label="Income from Goodwill Credit Interest" account={am.incomeFromGoodwillCreditInterestAccount} />
                        <GLRow label="Income from Goodwill Credit Fees" account={am.incomeFromGoodwillCreditFeesAccount} />
                        <GLRow label="Income from Goodwill Credit Penalties" account={am.incomeFromGoodwillCreditPenaltyAccount} />
                      </GLSection>

                      <GLSection title="Expenses">
                        <GLRow label="Losses written off" account={am.writeOffAccount} />
                        <GLRow label="Expenses from Goodwill Credit" account={am.goodwillCreditAccount} />
                        <GLRow label="ChargeOff Expense" account={am.chargeOffExpenseAccount} />
                        <GLRow label="ChargeOff Fraud Expense" account={am.chargeOffFraudExpenseAccount} />
                      </GLSection>

                      <GLSection title="Liabilities">
                        <GLRow label="Over payment liability" account={am.overpaymentLiabilityAccount} />
                      </GLSection>
                    </>
                  );
                })()}

                {/* Advanced mappings */}
                {(
                  (product.paymentChannelToFundSourceMappings?.length ?? 0) > 0 ||
                  (product.feeToIncomeAccountMappings?.length ?? 0) > 0 ||
                  (product.penaltyToIncomeAccountMappings?.length ?? 0) > 0 ||
                  (product.chargeOffReasonToExpenseAccountMappings?.length ?? 0) > 0
                ) && (
                  <GLSection title="Advanced Accounting Rules">
                    <div className="space-y-4">
                      <div>
                        <p className="mb-2 text-xs text-muted-foreground">Payment Channel → Fund Source</p>
                        <MappingTable
                          headers={["Payment Type", "Fund Source"]}
                          rows={(product.paymentChannelToFundSourceMappings ?? []).map((m) => [
                            m.paymentType.name,
                            `${m.fundSourceAccount.glCode} · ${m.fundSourceAccount.name}`,
                          ])}
                        />
                      </div>
                      <div>
                        <p className="mb-2 text-xs text-muted-foreground">Fee → Income Account</p>
                        <MappingTable
                          headers={["Fee", "Income Account"]}
                          rows={(product.feeToIncomeAccountMappings ?? []).map((m) => [
                            m.charge.name,
                            `${m.incomeAccount.glCode} · ${m.incomeAccount.name}`,
                          ])}
                        />
                      </div>
                      <div>
                        <p className="mb-2 text-xs text-muted-foreground">Penalty → Income Account</p>
                        <MappingTable
                          headers={["Penalty", "Income Account"]}
                          rows={(product.penaltyToIncomeAccountMappings ?? []).map((m) => [
                            m.charge.name,
                            `${m.incomeAccount.glCode} · ${m.incomeAccount.name}`,
                          ])}
                        />
                      </div>
                      <div>
                        <p className="mb-2 text-xs text-muted-foreground">Charge-Off Reason → Expense Account</p>
                        <MappingTable
                          headers={["Charge-Off Reason", "Expense Account"]}
                          rows={(product.chargeOffReasonToExpenseAccountMappings ?? []).map((m) => [
                            m.chargeOffReasonCodeValue.name,
                            `${m.expenseAccount.glCode} · ${m.expenseAccount.name}`,
                          ])}
                        />
                      </div>
                    </div>
                  </GLSection>
                )}
              </>
            )}
          </div>
        </AccordionSection>

      </Accordion>

      {/* Bottom actions */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/products/loan-products"><ArrowLeft className="mr-2 h-4 w-4" />Back to Loan Products</Link>
        </Button>
        <Button asChild>
          <Link href={`/products/loan-products/${id}/edit`}><Pencil className="mr-2 h-4 w-4" />Edit Product</Link>
        </Button>
      </div>
      <div className="h-4" />
    </div>
  );
}
