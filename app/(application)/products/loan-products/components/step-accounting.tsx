"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BookOpen, CircleDollarSign, BookMarked, Layers } from "lucide-react";
import type {
  FineractEnumOption,
  FineractGLAccount,
  LoanProductFormData,
  LoanProductTemplate,
} from "@/shared/types/loan-product";

interface StepAccountingProps {
  form: LoanProductFormData;
  template: LoanProductTemplate;
  onChange: (updates: Partial<LoanProductFormData>) => void;
}

// Visual metadata per accounting rule ID
const RULE_META: Record<
  number,
  { icon: React.ReactNode; description: string; color: string }
> = {
  1: {
    icon: <BookOpen className="h-5 w-5" />,
    description: "No double-entry accounting. Suitable for simple tracking only.",
    color: "text-muted-foreground",
  },
  2: {
    icon: <CircleDollarSign className="h-5 w-5" />,
    description: "Records transactions only when cash is received or paid out.",
    color: "text-blue-600 dark:text-blue-400",
  },
  3: {
    icon: <BookMarked className="h-5 w-5" />,
    description: "Partially accrues income — interest is accrued, fees are cash-based.",
    color: "text-violet-600 dark:text-violet-400",
  },
  4: {
    icon: <Layers className="h-5 w-5" />,
    description: "Fully accrues income and expenses regardless of cash movement.",
    color: "text-emerald-600 dark:text-emerald-400",
  },
};

function AccountingRuleCard({
  option,
  selected,
  onSelect,
}: {
  option: FineractEnumOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = RULE_META[option.id] ?? {
    icon: <BookOpen className="h-5 w-5" />,
    description: "",
    color: "text-muted-foreground",
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group relative flex w-full flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all duration-150",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      {/* Radio dot */}
      <span
        className={cn(
          "absolute right-4 top-4 flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all",
          selected
            ? "border-primary"
            : "border-muted-foreground/40 group-hover:border-primary/50"
        )}
      >
        {selected && (
          <span className="h-2 w-2 rounded-full bg-primary" />
        )}
      </span>

      {/* Icon */}
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          selected ? "bg-primary/10" : "bg-muted",
          meta.color
        )}
      >
        {meta.icon}
      </span>

      {/* Text */}
      <div className="pr-6">
        <p className="text-sm font-semibold leading-tight">{option.value}</p>
        {meta.description && (
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            {meta.description}
          </p>
        )}
      </div>
    </button>
  );
}

function GLAccountSelect({
  id,
  label,
  required,
  value,
  accounts,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: number | "";
  accounts: FineractGLAccount[];
  onChange: (v: number | "") => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Select
        value={value === "" ? "__none__" : String(value)}
        onValueChange={(v) => onChange(v === "__none__" ? "" : Number(v))}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder="Select GL account…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">None</SelectItem>
          {accounts.map((acc) => (
            <SelectItem key={acc.id} value={String(acc.id)}>
              {acc.glCode} — {acc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function StepAccounting({ form, template, onChange }: StepAccountingProps) {
  const accountingRuleOptions = template.accountingRuleOptions ?? [];
  const mappingOptions        = template.accountingMappingOptions ?? {};
  const assetAccounts: FineractGLAccount[]     = mappingOptions.assetAccountOptions ?? [];
  const incomeAccounts: FineractGLAccount[]    = mappingOptions.incomeAccountOptions ?? [];
  const expenseAccounts: FineractGLAccount[]   = mappingOptions.expenseAccountOptions ?? [];
  const liabilityAccounts: FineractGLAccount[] = mappingOptions.liabilityAccountOptions ?? [];

  const rule      = Number(form.accountingRule);
  const isCash    = rule === 2;
  const isAccrual = rule === 3 || rule === 4;
  const hasAccounting = isCash || isAccrual;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Accounting</h2>
        <p className="text-sm text-muted-foreground">
          Choose an accounting rule, then map GL accounts for this loan product.
        </p>
      </div>

      {/* Accounting rule — radio cards */}
      <div className="space-y-3">
        <Label>
          Accounting Rule <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {accountingRuleOptions.map((opt) => (
            <AccountingRuleCard
              key={opt.id}
              option={opt}
              selected={form.accountingRule === opt.id}
              onSelect={() => onChange({ accountingRule: opt.id })}
            />
          ))}
        </div>
      </div>

      {hasAccounting && (
        <>
          <Separator />

          {/* Assets */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Assets
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GLAccountSelect
                id="fundSourceAccountId"
                label="Fund Source"
                required
                value={form.fundSourceAccountId}
                accounts={assetAccounts}
                onChange={(v) => onChange({ fundSourceAccountId: v })}
              />
              <GLAccountSelect
                id="loanPortfolioAccountId"
                label="Loan Portfolio"
                required
                value={form.loanPortfolioAccountId}
                accounts={assetAccounts}
                onChange={(v) => onChange({ loanPortfolioAccountId: v })}
              />
              {isAccrual && (
                <>
                  <GLAccountSelect
                    id="receivableInterestAccountId"
                    label="Interest Receivable"
                    value={form.receivableInterestAccountId}
                    accounts={assetAccounts}
                    onChange={(v) => onChange({ receivableInterestAccountId: v })}
                  />
                  <GLAccountSelect
                    id="receivableFeeAccountId"
                    label="Fees Receivable"
                    value={form.receivableFeeAccountId}
                    accounts={assetAccounts}
                    onChange={(v) => onChange({ receivableFeeAccountId: v })}
                  />
                  <GLAccountSelect
                    id="receivablePenaltyAccountId"
                    label="Penalties Receivable"
                    value={form.receivablePenaltyAccountId}
                    accounts={assetAccounts}
                    onChange={(v) => onChange({ receivablePenaltyAccountId: v })}
                  />
                </>
              )}
            </div>
          </section>

          <Separator />

          {/* Income */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Income
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GLAccountSelect
                id="interestOnLoanAccountId"
                label="Income from Interest"
                required
                value={form.interestOnLoanAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ interestOnLoanAccountId: v })}
              />
              <GLAccountSelect
                id="incomeFromFeeAccountId"
                label="Income from Fees"
                required
                value={form.incomeFromFeeAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromFeeAccountId: v })}
              />
              <GLAccountSelect
                id="incomeFromPenaltyAccountId"
                label="Income from Penalties"
                required
                value={form.incomeFromPenaltyAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromPenaltyAccountId: v })}
              />
              <GLAccountSelect
                id="incomeFromRecoveryAccountId"
                label="Income from Recovery Repayments"
                value={form.incomeFromRecoveryAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromRecoveryAccountId: v })}
              />
              <GLAccountSelect
                id="incomeFromChargeOffInterestAccountId"
                label="Income from Charge-Off Interest"
                value={form.incomeFromChargeOffInterestAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromChargeOffInterestAccountId: v })}
              />
              <GLAccountSelect
                id="incomeFromChargeOffFeesAccountId"
                label="Income from Charge-Off Fees"
                value={form.incomeFromChargeOffFeesAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromChargeOffFeesAccountId: v })}
              />
              <GLAccountSelect
                id="incomeFromChargeOffPenaltyAccountId"
                label="Income from Charge-Off Penalties"
                value={form.incomeFromChargeOffPenaltyAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromChargeOffPenaltyAccountId: v })}
              />
              <GLAccountSelect
                id="incomeFromGoodwillCreditInterestAccountId"
                label="Income from Goodwill Credit Interest"
                value={form.incomeFromGoodwillCreditInterestAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromGoodwillCreditInterestAccountId: v })}
              />
              <GLAccountSelect
                id="incomeFromGoodwillCreditFeesAccountId"
                label="Income from Goodwill Credit Fees"
                value={form.incomeFromGoodwillCreditFeesAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromGoodwillCreditFeesAccountId: v })}
              />
              <GLAccountSelect
                id="incomeFromGoodwillCreditPenaltyAccountId"
                label="Income from Goodwill Credit Penalties"
                value={form.incomeFromGoodwillCreditPenaltyAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromGoodwillCreditPenaltyAccountId: v })}
              />
            </div>
          </section>

          <Separator />

          {/* Expenses & Liabilities */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Expenses & Liabilities
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GLAccountSelect
                id="writeOffAccountId"
                label="Losses Written Off"
                value={form.writeOffAccountId}
                accounts={expenseAccounts}
                onChange={(v) => onChange({ writeOffAccountId: v })}
              />
              <GLAccountSelect
                id="overpaymentLiabilityAccountId"
                label="Overpayment Liability"
                value={form.overpaymentLiabilityAccountId}
                accounts={liabilityAccounts}
                onChange={(v) => onChange({ overpaymentLiabilityAccountId: v })}
              />
            </div>
          </section>

          <Separator />

          {/* Advanced accounting rules */}
          <section className="space-y-4">
            <div
              className="flex cursor-pointer select-none items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
              onClick={() => onChange({ advancedAccountingRules: !form.advancedAccountingRules })}
            >
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Advanced Accounting Rules
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure payment channel to fund source mappings and fee/penalty income
                  account overrides.
                </p>
              </div>
              <Switch
                checked={form.advancedAccountingRules}
                onCheckedChange={(v) => onChange({ advancedAccountingRules: v })}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            {form.advancedAccountingRules && (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                Advanced account mappings (payment channels → fund source, fees → income
                accounts) can be configured after the product is created.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
