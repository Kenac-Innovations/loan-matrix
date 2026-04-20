"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BookOpen, CircleDollarSign, BookMarked, Layers, Plus, Pencil, Trash2 } from "lucide-react";
import type {
  FineractEnumOption,
  FineractGLAccount,
  FineractPaymentType,
  FineractCharge,
  LoanProductFormData,
  LoanProductTemplate,
  PaymentChannelMapping,
  FeeIncomeMapping,
  ChargeOffReasonMapping,
} from "@/shared/types/loan-product";

interface StepAccountingProps {
  form: LoanProductFormData;
  template: LoanProductTemplate;
  onChange: (updates: Partial<LoanProductFormData>) => void;
}

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
      <span
        className={cn(
          "absolute right-4 top-4 flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all",
          selected
            ? "border-primary"
            : "border-muted-foreground/40 group-hover:border-primary/50"
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          selected ? "bg-primary/10" : "bg-muted",
          meta.color
        )}
      >
        {meta.icon}
      </span>
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

// ── Generic 2-column mapping table ──────────────────────────────────────────

interface MappingOption {
  id: number;
  label: string;
}

interface MappingTableProps<T> {
  title: string;
  col1Label: string;
  col2Label: string;
  col1Options: MappingOption[];
  col2Options: MappingOption[];
  items: T[];
  getCol1: (item: T) => number;
  getCol2: (item: T) => number;
  makeItem: (col1: number, col2: number) => T;
  setCol1: (item: T, v: number) => T;
  setCol2: (item: T, v: number) => T;
  onChange: (items: T[]) => void;
  /** IDs already used in col1 so duplicates are prevented */
  usedCol1Ids?: number[];
}

function MappingTable<T>({
  title,
  col1Label,
  col2Label,
  col1Options,
  col2Options,
  items,
  getCol1,
  getCol2,
  makeItem,
  setCol1,
  setCol2,
  onChange,
}: MappingTableProps<T>) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ col1: number | ""; col2: number | "" }>({
    col1: "",
    col2: "",
  });

  const usedCol1 = items.map(getCol1);
  const availableForAdd = col1Options.filter((o) => !usedCol1.includes(o.id));

  function labelFor(options: MappingOption[], id: number) {
    return options.find((o) => o.id === id)?.label ?? String(id);
  }

  function commitAdd() {
    if (draft.col1 === "" || draft.col2 === "") return;
    onChange([...items, makeItem(draft.col1, draft.col2)]);
    setDraft({ col1: "", col2: "" });
    setAdding(false);
  }

  function commitEdit(index: number) {
    if (draft.col1 === "" || draft.col2 === "") return;
    const next = items.map((item, i) => {
      if (i !== index) return item;
      return setCol2(setCol1(item, draft.col1 as number), draft.col2 as number);
    });
    onChange(next);
    setEditingIndex(null);
  }

  function startEdit(index: number) {
    setAdding(false);
    setDraft({ col1: getCol1(items[index]), col2: getCol2(items[index]) });
    setEditingIndex(index);
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={availableForAdd.length === 0 && !adding}
          onClick={() => {
            setEditingIndex(null);
            setDraft({ col1: "", col2: "" });
            setAdding(true);
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{col1Label}</TableHead>
              <TableHead>{col2Label}</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && !adding && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="text-center text-xs text-muted-foreground py-4"
                >
                  No mappings configured.
                </TableCell>
              </TableRow>
            )}

            {items.map((item, index) =>
              editingIndex === index ? (
                <TableRow key={index}>
                  <TableCell>
                    <Select
                      value={draft.col1 === "" ? "__none__" : String(draft.col1)}
                      onValueChange={(v) =>
                        setDraft((d) => ({ ...d, col1: v === "__none__" ? "" : Number(v) }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {col1Options
                          .filter(
                            (o) =>
                              o.id === draft.col1 ||
                              !items.some((it, i) => i !== index && getCol1(it) === o.id)
                          )
                          .map((o) => (
                            <SelectItem key={o.id} value={String(o.id)}>
                              {o.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={draft.col2 === "" ? "__none__" : String(draft.col2)}
                      onValueChange={(v) =>
                        setDraft((d) => ({ ...d, col2: v === "__none__" ? "" : Number(v) }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {col2Options.map((o) => (
                          <SelectItem key={o.id} value={String(o.id)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => commitEdit(index)}
                        disabled={draft.col1 === "" || draft.col2 === ""}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setEditingIndex(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow key={index}>
                  <TableCell className="text-sm">
                    {labelFor(col1Options, getCol1(item))}
                  </TableCell>
                  <TableCell className="text-sm">
                    {labelFor(col2Options, getCol2(item))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEdit(index)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}

            {adding && (
              <TableRow>
                <TableCell>
                  <Select
                    value={draft.col1 === "" ? "__none__" : String(draft.col1)}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, col1: v === "__none__" ? "" : Number(v) }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableForAdd.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={draft.col2 === "" ? "__none__" : String(draft.col2)}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, col2: v === "__none__" ? "" : Number(v) }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {col2Options.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={commitAdd}
                      disabled={draft.col1 === "" || draft.col2 === ""}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setAdding(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Main step ────────────────────────────────────────────────────────────────

export function StepAccounting({ form, template, onChange }: StepAccountingProps) {
  const accountingRuleOptions = template.accountingRuleOptions ?? [];
  const mappingOptions        = template.accountingMappingOptions ?? {};
  const assetAccounts: FineractGLAccount[]     = mappingOptions.assetAccountOptions ?? [];
  const incomeAccounts: FineractGLAccount[]    = mappingOptions.incomeAccountOptions ?? [];
  const expenseAccounts: FineractGLAccount[]   = mappingOptions.expenseAccountOptions ?? [];
  const liabilityAccounts: FineractGLAccount[] = mappingOptions.liabilityAccountOptions ?? [];
  const fundSourceAccounts: FineractGLAccount[] = [...assetAccounts, ...liabilityAccounts];

  const paymentTypes: FineractPaymentType[]      = template.paymentTypeOptions ?? [];
  const feeCharges: FineractCharge[]             = (template.chargeOptions ?? []).filter((c) => !c.penalty);
  const penaltyCharges: FineractCharge[]         = template.penaltyOptions ?? template.chargeOptions?.filter((c) => c.penalty) ?? [];
  const chargeOffReasons: Array<{ id: number; name: string }> = template.chargeOffReasonOptions ?? [];

  const rule      = Number(form.accountingRule);
  const isCash    = rule === 2;
  const isAccrual = rule === 3 || rule === 4;
  const hasAccounting = isCash || isAccrual;

  // Convert GL accounts to MappingOption shape
  const fundSourceOptions: MappingOption[] = fundSourceAccounts.map((a) => ({
    id: a.id,
    label: `${a.glCode} — ${a.name}`,
  }));
  const incomeOptions: MappingOption[] = incomeAccounts.map((a) => ({
    id: a.id,
    label: `${a.glCode} — ${a.name}`,
  }));
  const expenseOptions: MappingOption[] = expenseAccounts.map((a) => ({
    id: a.id,
    label: `${a.glCode} — ${a.name}`,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Accounting</h2>
        <p className="text-sm text-muted-foreground">
          Choose an accounting rule, then map GL accounts for this loan product.
        </p>
      </div>

      {/* Accounting rule */}
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

          {/* Fund Source */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Fund Source
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GLAccountSelect
                id="fundSourceAccountId"
                label="Fund Source"
                required
                value={form.fundSourceAccountId}
                accounts={fundSourceAccounts}
                onChange={(v) => onChange({ fundSourceAccountId: v })}
              />
            </div>
          </section>

          <Separator />

          {/* Assets */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Assets
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GLAccountSelect
                id="loanPortfolioAccountId"
                label="Loan Portfolio"
                required
                value={form.loanPortfolioAccountId}
                accounts={assetAccounts}
                onChange={(v) => onChange({ loanPortfolioAccountId: v })}
              />
              <GLAccountSelect
                id="transfersInSuspenseAccountId"
                label="Transfer in Suspense"
                required
                value={form.transfersInSuspenseAccountId}
                accounts={assetAccounts}
                onChange={(v) => onChange({ transfersInSuspenseAccountId: v })}
              />
              {isAccrual && (
                <>
                  <GLAccountSelect
                    id="receivableInterestAccountId"
                    label="Interest Receivable"
                    required
                    value={form.receivableInterestAccountId}
                    accounts={assetAccounts}
                    onChange={(v) => onChange({ receivableInterestAccountId: v })}
                  />
                  <GLAccountSelect
                    id="receivableFeeAccountId"
                    label="Fees Receivable"
                    required
                    value={form.receivableFeeAccountId}
                    accounts={assetAccounts}
                    onChange={(v) => onChange({ receivableFeeAccountId: v })}
                  />
                  <GLAccountSelect
                    id="receivablePenaltyAccountId"
                    label="Penalties Receivable"
                    required
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
                required
                value={form.incomeFromRecoveryAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromRecoveryAccountId: v })}
              />
              <GLAccountSelect
                id="incomeFromChargeOffInterestAccountId"
                label="Income from ChargeOff Interest"
                required
                value={form.incomeFromChargeOffInterestAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromChargeOffInterestAccountId: v })}
              />
              <GLAccountSelect
                id="incomeFromChargeOffFeesAccountId"
                label="Income from ChargeOff Fees"
                required
                value={form.incomeFromChargeOffFeesAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromChargeOffFeesAccountId: v })}
              />
              <GLAccountSelect
                id="incomeFromChargeOffPenaltyAccountId"
                label="Income from ChargeOff Penalties"
                required
                value={form.incomeFromChargeOffPenaltyAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromChargeOffPenaltyAccountId: v })}
              />
              <GLAccountSelect
                id="incomeFromGoodwillCreditInterestAccountId"
                label="Income from Goodwill Credit Interest"
                required
                value={form.incomeFromGoodwillCreditInterestAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromGoodwillCreditInterestAccountId: v })}
              />
              <GLAccountSelect
                id="incomeFromGoodwillCreditFeesAccountId"
                label="Income from Goodwill Credit Fees"
                required
                value={form.incomeFromGoodwillCreditFeesAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromGoodwillCreditFeesAccountId: v })}
              />
              <GLAccountSelect
                id="incomeFromGoodwillCreditPenaltyAccountId"
                label="Income from Goodwill Credit Penalties"
                required
                value={form.incomeFromGoodwillCreditPenaltyAccountId}
                accounts={incomeAccounts}
                onChange={(v) => onChange({ incomeFromGoodwillCreditPenaltyAccountId: v })}
              />
            </div>
          </section>

          <Separator />

          {/* Expenses */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Expenses
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GLAccountSelect
                id="writeOffAccountId"
                label="Losses Written Off"
                required
                value={form.writeOffAccountId}
                accounts={expenseAccounts}
                onChange={(v) => onChange({ writeOffAccountId: v })}
              />
              <GLAccountSelect
                id="goodwillCreditAccountId"
                label="Expenses from Goodwill Credit"
                required
                value={form.goodwillCreditAccountId}
                accounts={expenseAccounts}
                onChange={(v) => onChange({ goodwillCreditAccountId: v })}
              />
              <GLAccountSelect
                id="chargeOffExpenseAccountId"
                label="ChargeOff Expense"
                required
                value={form.chargeOffExpenseAccountId}
                accounts={expenseAccounts}
                onChange={(v) => onChange({ chargeOffExpenseAccountId: v })}
              />
              <GLAccountSelect
                id="chargeOffFraudExpenseAccountId"
                label="ChargeOff Fraud Expense"
                required
                value={form.chargeOffFraudExpenseAccountId}
                accounts={expenseAccounts}
                onChange={(v) => onChange({ chargeOffFraudExpenseAccountId: v })}
              />
            </div>
          </section>

          <Separator />

          {/* Liabilities */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Liabilities
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GLAccountSelect
                id="overpaymentLiabilityAccountId"
                label="Overpayment Liability"
                required
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
              onClick={() =>
                onChange({ advancedAccountingRules: !form.advancedAccountingRules })
              }
            >
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Advanced Accounting Rules
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure payment channel → fund source, fee/penalty → income account,
                  and charge-off reason → expense account overrides.
                </p>
              </div>
              <Switch
                checked={form.advancedAccountingRules}
                onCheckedChange={(v) => onChange({ advancedAccountingRules: v })}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {form.advancedAccountingRules && (
              <div className="space-y-6 rounded-lg border bg-muted/20 p-4">

                {/* 1. Payment Channel → Fund Source */}
                <MappingTable<PaymentChannelMapping>
                  title="Payment Channel to Fund Source"
                  col1Label="Payment Type"
                  col2Label="Fund Source"
                  col1Options={paymentTypes.map((pt) => ({ id: pt.id, label: pt.name }))}
                  col2Options={fundSourceOptions}
                  items={form.paymentChannelToFundSourceMappings}
                  getCol1={(item) => item.paymentTypeId}
                  getCol2={(item) => item.fundSourceAccountId}
                  makeItem={(col1, col2) => ({ paymentTypeId: col1, fundSourceAccountId: col2 })}
                  setCol1={(item, v) => ({ ...item, paymentTypeId: v })}
                  setCol2={(item, v) => ({ ...item, fundSourceAccountId: v })}
                  onChange={(items) => onChange({ paymentChannelToFundSourceMappings: items })}
                />

                <Separator />

                {/* 2. Fee → Income Account */}
                <MappingTable<FeeIncomeMapping>
                  title="Fee to Income Account"
                  col1Label="Fee"
                  col2Label="Income Account"
                  col1Options={feeCharges.map((c) => ({ id: c.id, label: c.name }))}
                  col2Options={incomeOptions}
                  items={form.feeToIncomeAccountMappings}
                  getCol1={(item) => item.chargeId}
                  getCol2={(item) => item.incomeAccountId}
                  makeItem={(col1, col2) => ({ chargeId: col1, incomeAccountId: col2 })}
                  setCol1={(item, v) => ({ ...item, chargeId: v })}
                  setCol2={(item, v) => ({ ...item, incomeAccountId: v })}
                  onChange={(items) => onChange({ feeToIncomeAccountMappings: items })}
                />

                <Separator />

                {/* 3. Penalty → Income Account */}
                <MappingTable<FeeIncomeMapping>
                  title="Penalty to Income Account"
                  col1Label="Penalty"
                  col2Label="Income Account"
                  col1Options={penaltyCharges.map((c) => ({ id: c.id, label: c.name }))}
                  col2Options={incomeOptions}
                  items={form.penaltyToIncomeAccountMappings}
                  getCol1={(item) => item.chargeId}
                  getCol2={(item) => item.incomeAccountId}
                  makeItem={(col1, col2) => ({ chargeId: col1, incomeAccountId: col2 })}
                  setCol1={(item, v) => ({ ...item, chargeId: v })}
                  setCol2={(item, v) => ({ ...item, incomeAccountId: v })}
                  onChange={(items) => onChange({ penaltyToIncomeAccountMappings: items })}
                />

                <Separator />

                {/* 4. Charge-Off Reason → Expense Account */}
                <MappingTable<ChargeOffReasonMapping>
                  title="Charge-Off Reason to Expense Account"
                  col1Label="Charge-Off Reason"
                  col2Label="Expense Account"
                  col1Options={chargeOffReasons.map((r) => ({ id: r.id, label: r.name }))}
                  col2Options={expenseOptions}
                  items={form.chargeOffReasonToExpenseAccountMappings}
                  getCol1={(item) => item.chargeOffReasonCodeValueId}
                  getCol2={(item) => item.expenseAccountId}
                  makeItem={(col1, col2) => ({
                    chargeOffReasonCodeValueId: col1,
                    expenseAccountId: col2,
                  })}
                  setCol1={(item, v) => ({ ...item, chargeOffReasonCodeValueId: v })}
                  setCol2={(item, v) => ({ ...item, expenseAccountId: v })}
                  onChange={(items) =>
                    onChange({ chargeOffReasonToExpenseAccountMappings: items })
                  }
                />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
