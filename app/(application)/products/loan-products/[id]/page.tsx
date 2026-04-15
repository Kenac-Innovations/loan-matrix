"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import {
  ArrowLeft,
  Pencil,
  Calendar,
  Percent,
  Repeat2,
  Coins,
  BookOpen,
  ShieldAlert,
  Tag,
  Settings2,
  TrendingDown,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EnumValue { id: number; value: string }
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
  principal?: number;
  minPrincipal?: number;
  maxPrincipal?: number;
  numberOfRepayments?: number;
  minNumberOfRepayments?: number;
  maxNumberOfRepayments?: number;
  repaymentEvery?: number;
  repaymentFrequencyType?: EnumValue;
  interestRatePerPeriod?: number;
  minInterestRatePerPeriod?: number;
  maxInterestRatePerPeriod?: number;
  interestRateFrequencyType?: EnumValue;
  interestType?: EnumValue;
  amortizationType?: EnumValue;
  interestCalculationPeriodType?: EnumValue;
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
  isInterestRecalculationEnabled?: boolean;
  holdGuaranteeFunds?: boolean;
  allowVariableInstallments?: boolean;
  enableDownPayment?: boolean;
  disbursedAmountPercentageForDownPayment?: number;
  isEqualAmortization?: boolean;
  canDefineInstallmentAmount?: boolean;
  canUseForTopup?: boolean;
  includeInBorrowerCycle?: boolean;
  useBorrowerCycle?: boolean;
  accountingRule?: EnumValue;
  fundSourceAccount?: GLAccount;
  loanPortfolioAccount?: GLAccount;
  interestOnLoanAccount?: GLAccount;
  incomeFromFeeAccount?: GLAccount;
  incomeFromPenaltyAccount?: GLAccount;
  writeOffAccount?: GLAccount;
  overpaymentLiabilityAccount?: GLAccount;
  charges?: Charge[];
  startDate?: string;
  closeDate?: string;
  status?: string;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ViewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-36 rounded-md" />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Helper components ───────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          accent ?? "bg-primary/10 text-primary"
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-xl font-bold leading-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function InfoGrid({
  rows,
}: {
  rows: { label: string; value?: string | number | null | boolean }[];
}) {
  const visible = rows.filter(
    (r) => r.value !== undefined && r.value !== null && r.value !== "" && r.value !== 0
  );
  if (visible.length === 0) return (
    <p className="text-sm text-muted-foreground italic">No data configured.</p>
  );
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {visible.map(({ label, value }) => (
        <div key={label}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-foreground">
            {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {icon}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

function GLRow({ label, account }: { label: string; account?: GLAccount }) {
  if (!account) return null;
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold">
        <span className="text-muted-foreground">{account.glCode} · </span>
        {account.name}
      </span>
    </div>
  );
}

function AccountingRuleBadge({ rule }: { rule?: EnumValue }) {
  if (!rule) return <span className="text-muted-foreground">—</span>;
  const colors: Record<number, string> = {
    1: "bg-muted text-muted-foreground",
    2: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    3: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    4: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        colors[rule.id] ?? "bg-muted text-muted-foreground"
      )}
    >
      {rule.value}
    </span>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LoanProductViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-36 rounded-md" />
      </div>
      <ViewSkeleton />
    </div>
  );

  if (loadError) return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/products/loan-products">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Link>
      </Button>
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {loadError}
      </div>
    </div>
  );

  if (!product) return null;

  const sym = product.currency?.displaySymbol ?? product.currency?.code ?? "";
  const charges   = (product.charges ?? []).filter((c) => !c.penalty);
  const penalties = (product.charges ?? []).filter((c) => c.penalty);
  const hasGL     = product.accountingRule && product.accountingRule.id !== 1;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/products/loan-products">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Loan Products
        </Link>
      </Button>

      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <Badge variant="outline" className="text-sm font-mono">
              {product.shortName}
            </Badge>
          </div>
          {product.description && (
            <p className="mt-1 max-w-2xl text-muted-foreground">{product.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AccountingRuleBadge rule={product.accountingRule} />
            {product.includeInBorrowerCycle && (
              <Badge variant="secondary">Borrower Cycle</Badge>
            )}
            {product.canUseForTopup && (
              <Badge variant="secondary">Top-Up Eligible</Badge>
            )}
            {product.multiDisburseLoan && (
              <Badge variant="secondary">Multi-Disbursement</Badge>
            )}
          </div>
        </div>
        <Button asChild>
          <Link href={`/products/loan-products/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Product
          </Link>
        </Button>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Coins className="h-5 w-5" />}
          label="Default Principal"
          value={product.principal != null ? `${sym}${product.principal.toLocaleString()}` : "—"}
          sub={
            product.minPrincipal != null && product.maxPrincipal != null
              ? `Range: ${sym}${product.minPrincipal.toLocaleString()} – ${sym}${product.maxPrincipal.toLocaleString()}`
              : undefined
          }
          accent="bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
        />
        <StatCard
          icon={<Percent className="h-5 w-5" />}
          label="Interest Rate"
          value={
            product.interestRatePerPeriod != null
              ? `${product.interestRatePerPeriod}% / ${product.interestRateFrequencyType?.value ?? "period"}`
              : "—"
          }
          sub={product.interestType?.value}
          accent="bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400"
        />
        <StatCard
          icon={<Repeat2 className="h-5 w-5" />}
          label="Repayment Schedule"
          value={
            product.numberOfRepayments != null
              ? `${product.numberOfRepayments} repayments`
              : "—"
          }
          sub={
            product.repaymentEvery != null && product.repaymentFrequencyType
              ? `Every ${product.repaymentEvery} ${product.repaymentFrequencyType.value}`
              : undefined
          }
          accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
        />
      </div>

      {/* Detail sections grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

        {/* Currency */}
        <Section icon={<Coins className="h-4 w-4" />} title="Currency">
          <InfoGrid
            rows={[
              { label: "Currency", value: product.currency?.displayLabel ?? product.currency?.code },
              { label: "Decimal Places", value: product.digitsAfterDecimal },
              { label: "In Multiples Of", value: product.inMultiplesOf },
            ]}
          />
        </Section>

        {/* Terms */}
        <Section icon={<TrendingDown className="h-4 w-4" />} title="Terms">
          <InfoGrid
            rows={[
              { label: "Amortization", value: product.amortizationType?.value },
              { label: "Interest Type", value: product.interestType?.value },
              { label: "Interest Calculation Period", value: product.interestCalculationPeriodType?.value },
              { label: "Repayment Strategy", value: product.transactionProcessingStrategyName ?? product.transactionProcessingStrategyCode },
              { label: "Days in Year", value: product.daysInYearType?.value },
              { label: "Days in Month", value: product.daysInMonthType?.value },
              { label: "Min Repayments", value: product.minNumberOfRepayments },
              { label: "Max Repayments", value: product.maxNumberOfRepayments },
              { label: "Min Interest Rate", value: product.minInterestRatePerPeriod != null ? `${product.minInterestRatePerPeriod}%` : undefined },
              { label: "Max Interest Rate", value: product.maxInterestRatePerPeriod != null ? `${product.maxInterestRatePerPeriod}%` : undefined },
            ]}
          />
        </Section>

        {/* Settings */}
        <Section icon={<Settings2 className="h-4 w-4" />} title="Settings">
          <InfoGrid
            rows={[
              { label: "Grace on Principal (periods)", value: product.graceOnPrincipalPayment },
              { label: "Grace on Interest (periods)", value: product.graceOnInterestPayment },
              { label: "Grace on Interest Charged (periods)", value: product.graceOnInterestCharged },
              { label: "Arrears Ageing Grace (days)", value: product.graceOnArrearsAgeing },
              { label: "In Arrears Tolerance", value: product.inArrearsTolerance },
              { label: "Overdue Days for NPA", value: product.overdueDaysForNPA },
              { label: "NPA clears only on full arrears", value: product.accountMovesOutOfNPAOnlyOnArrearsCompletion },
              { label: "Equal Amortization", value: product.isEqualAmortization },
              { label: "Interest Recalculation", value: product.isInterestRecalculationEnabled },
              { label: "Hold Guarantee Funds", value: product.holdGuaranteeFunds },
              { label: "Variable Installments", value: product.allowVariableInstallments },
              { label: "Can Define Installment Amount", value: product.canDefineInstallmentAmount },
              { label: "Down Payment Enabled", value: product.enableDownPayment },
              { label: "Down Payment %", value: product.disbursedAmountPercentageForDownPayment != null ? `${product.disbursedAmountPercentageForDownPayment}%` : undefined },
              { label: "Multi-Disbursement", value: product.multiDisburseLoan },
              { label: "Max Tranches", value: product.maxTrancheCount },
              { label: "Max Outstanding Balance", value: product.outstandingLoanBalance != null ? `${sym}${product.outstandingLoanBalance.toLocaleString()}` : undefined },
            ]}
          />
        </Section>

        {/* Availability */}
        <Section icon={<Calendar className="h-4 w-4" />} title="Availability & Metadata">
          <InfoGrid
            rows={[
              { label: "Start Date", value: product.startDate },
              { label: "Close Date", value: product.closeDate },
              { label: "External ID", value: product.externalId },
              { label: "Include in Borrower Cycle", value: product.includeInBorrowerCycle },
              { label: "Use Borrower Cycle", value: product.useBorrowerCycle },
              { label: "Can Use for Top-Up", value: product.canUseForTopup },
            ]}
          />
        </Section>
      </div>

      {/* Charges & Penalties */}
      {(charges.length > 0 || penalties.length > 0) && (
        <Section icon={<Tag className="h-4 w-4" />} title="Charges & Penalties">
          <div className="space-y-4">
            {charges.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Charges
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {charges.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start gap-3 rounded-lg border bg-blue-50/50 p-3 dark:bg-blue-950/20"
                    >
                      <Tag className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.chargeCalculationType?.value} · {c.chargeTimeType?.value}
                        </p>
                        <p className="text-xs font-medium">{sym}{c.amount.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {penalties.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Penalties
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {penalties.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start gap-3 rounded-lg border bg-orange-50/50 p-3 dark:bg-orange-950/20"
                    >
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{c.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.chargeCalculationType?.value} · {c.chargeTimeType?.value}
                        </p>
                        <p className="text-xs font-medium">{sym}{c.amount.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Accounting */}
      <Section icon={<BookOpen className="h-4 w-4" />} title="Accounting">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rule
            </span>
            <AccountingRuleBadge rule={product.accountingRule} />
          </div>

          {hasGL && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                GL Account Mappings
              </p>
              <div className="space-y-1.5">
                <GLRow label="Fund Source"          account={product.fundSourceAccount} />
                <GLRow label="Loan Portfolio"       account={product.loanPortfolioAccount} />
                <GLRow label="Income from Interest" account={product.interestOnLoanAccount} />
                <GLRow label="Income from Fees"     account={product.incomeFromFeeAccount} />
                <GLRow label="Income from Penalties" account={product.incomeFromPenaltyAccount} />
                <GLRow label="Losses Written Off"   account={product.writeOffAccount} />
                <GLRow label="Overpayment Liability" account={product.overpaymentLiabilityAccount} />
              </div>
            </div>
          )}

          {!hasGL && (
            <div className="flex items-start gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              No GL account mappings are required for the selected accounting rule.
            </div>
          )}
        </div>
      </Section>

      {/* Bottom shortcut */}
      <div className="flex items-center justify-between border-t pt-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/products/loan-products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Loan Products
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/products/loan-products/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Product
          </Link>
        </Button>
      </div>

      {/* Extra bottom spacing */}
      <div className="h-4" />
    </div>
  );
}
