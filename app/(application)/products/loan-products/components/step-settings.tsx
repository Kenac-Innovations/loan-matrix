"use client";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { LoanProductFormData, LoanProductTemplate } from "@/shared/types/loan-product";
import { ADVANCED_PAYMENT_ALLOCATION_STRATEGY } from "@/shared/types/loan-product";
import { FieldLabel, TooltipHelp } from "./field-label";
import { LOAN_PRODUCT_TOOLTIPS as T } from "./loan-product-tooltips";

interface StepSettingsProps {
  form: LoanProductFormData;
  template: LoanProductTemplate;
  onChange: (updates: Partial<LoanProductFormData>) => void;
}

function NumInput({
  id,
  label,
  required,
  hint,
  tooltip,
  value,
  min,
  max,
  step,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  tooltip?: string;
  value: number | "";
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number | "") => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id} label={label} required={required} tooltip={tooltip} />
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step ?? "any"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function EnumSelect({
  id,
  label,
  required,
  value,
  options,
  placeholder,
  disabled,
  tooltip,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: number | "";
  options: { id: number; value: string }[];
  placeholder?: string;
  disabled?: boolean;
  tooltip?: string;
  onChange: (v: number | "") => void;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id} label={label} required={required} tooltip={tooltip} />
      <Select
        value={value === "" ? "" : String(value)}
        disabled={disabled}
        onValueChange={(v) => onChange(v === "" ? "" : Number(v))}
      >
        <SelectTrigger id={id} disabled={disabled}>
          <SelectValue placeholder={placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.id} value={String(opt.id)}>
              {opt.value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CodeSelect({
  id,
  label,
  required,
  value,
  options,
  placeholder,
  tooltip,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  options: { code: string; value: string }[];
  placeholder?: string;
  tooltip?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel htmlFor={id} label={label} required={required} tooltip={tooltip} />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder ?? "Select…"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.code} value={opt.code}>
              {opt.value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SwitchRow({
  id,
  label,
  hint,
  tooltip,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  tooltip?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className={[
        "flex select-none items-center justify-between rounded-lg border p-4 transition-colors",
        disabled
          ? "cursor-not-allowed bg-muted/20 opacity-80"
          : "cursor-pointer hover:bg-muted/40",
      ].join(" ")}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    >
      <div className="space-y-1">
        <FieldLabel
          htmlFor={id}
          label={label}
          tooltip={tooltip}
          labelClassName="pointer-events-none text-sm font-medium"
        />
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function StepSettings({ form, template, onChange }: StepSettingsProps) {
  const amortTypes = template.amortizationTypeOptions ?? [];
  const interestTypes = template.interestTypeOptions ?? [];
  const interestCalcTypes = template.interestCalculationPeriodTypeOptions ?? [];
  const allStrategies = template.transactionProcessingStrategyOptions ?? [];
  const daysInYear = template.daysInYearTypeOptions ?? [];
  const daysInMonth = template.daysInMonthTypeOptions ?? [];
  const compoundingMethods = template.interestRecalculationCompoundingTypeOptions ?? [];
  const rescheduleStrategies = template.rescheduleStrategyTypeOptions ?? [];
  const preClosureStrategies = template.preClosureInterestCalculationStrategyOptions ?? [];
  const recalcFreqTypes = template.interestRecalculationFrequencyTypeOptions ?? [];
  const delinquencyBuckets = template.delinquencyBucketOptions ?? [];
  const loanScheduleTypes = template.loanScheduleTypeOptions ?? [];
  const loanScheduleProcessingTypes = template.loanScheduleProcessingTypeOptions ?? [];
  const dailyInterestCalculationTypeId =
    interestCalcTypes.find((opt) => opt.code === "interestCalculationPeriodType.daily")?.id ?? 0;
  const isDailyInterestCalculation = form.interestCalculationPeriodType === dailyInterestCalculationTypeId;

  const isProgressive = form.loanScheduleType === "PROGRESSIVE";

  const rescheduleStrategyOptions = isProgressive
    ? rescheduleStrategies.filter((option) => option.id > 3)
    : rescheduleStrategies.filter((option) => option.id < 4);
  const progressiveRescheduleStrategy = rescheduleStrategies.find((option) => option.id > 3);

  const rescheduleStrategyForSchedule = (scheduleType: string) => {
    const options = scheduleType === "PROGRESSIVE"
      ? rescheduleStrategies.filter((option) => option.id > 3)
      : rescheduleStrategies.filter((option) => option.id < 4);
    return options[0]?.id;
  };

  // PROGRESSIVE: only the advanced strategy; CUMULATIVE: exclude it
  const strategies = isProgressive
    ? allStrategies.filter((s) => s.code === ADVANCED_PAYMENT_ALLOCATION_STRATEGY)
    : allStrategies.filter((s) => s.code !== ADVANCED_PAYMENT_ALLOCATION_STRATEGY);

  const handleScheduleTypeChange = (v: string) => {
    if (v === "PROGRESSIVE") {
      const advancedStrategy = allStrategies.find(
        (s) => s.code === ADVANCED_PAYMENT_ALLOCATION_STRATEGY
      );
      onChange({
        loanScheduleType: v,
        transactionProcessingStrategyCode: advancedStrategy?.code ?? ADVANCED_PAYMENT_ALLOCATION_STRATEGY,
        loanScheduleProcessingType: loanScheduleProcessingTypes[0]?.code ?? "",
        ...(form.isInterestRecalculationEnabled && progressiveRescheduleStrategy
          ? { rescheduleStrategyMethod: progressiveRescheduleStrategy.id }
          : {}),
      });
    } else {
      const firstNonAdvanced = allStrategies.find(
        (s) => s.code !== ADVANCED_PAYMENT_ALLOCATION_STRATEGY
      );
      onChange({
        loanScheduleType: v,
        transactionProcessingStrategyCode: firstNonAdvanced?.code ?? "",
        loanScheduleProcessingType: "",
        ...(form.isInterestRecalculationEnabled
          ? { rescheduleStrategyMethod: rescheduleStrategyForSchedule(v) ?? "" }
          : {}),
      });
    }
  };

  const handleInterestRecalculationChange = (enabled: boolean) => {
    onChange({
      isInterestRecalculationEnabled: enabled,
      ...(enabled
        ? { rescheduleStrategyMethod: rescheduleStrategyForSchedule(form.loanScheduleType) ?? "" }
        : {}),
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure amortization, interest calculation, grace periods, and advanced features.
        </p>
      </div>

      {/* Core settings */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Core Configuration
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <EnumSelect
            id="amortizationType"
            label="Amortization"
            required
            tooltip={T.amortizationType}
            value={form.amortizationType}
            options={amortTypes}
            placeholder="Select amortization type"
            onChange={(v) => onChange({ amortizationType: v })}
          />
          <EnumSelect
            id="interestType"
            label="Interest Type"
            required
            tooltip={T.interestType}
            value={form.interestType}
            options={interestTypes}
            placeholder="Select interest type"
            onChange={(v) => onChange({ interestType: v })}
          />
          <EnumSelect
            id="interestCalculationPeriodType"
            label="Interest Calculation Period"
            tooltip={T.interestCalculationPeriodType}
            value={form.interestCalculationPeriodType}
            options={interestCalcTypes}
            onChange={(v) =>
              onChange({
                interestCalculationPeriodType: v,
                allowPartialPeriodInterestCalculation:
                  v === dailyInterestCalculationTypeId
                    ? false
                    : form.allowPartialPeriodInterestCalculation,
              })
            }
          />
          <div className="space-y-2">
            <FieldLabel
              htmlFor="transactionProcessingStrategyCode"
              label="Repayment Strategy"
              required
              tooltip={T.transactionProcessingStrategyCode}
            />
            <Select
              value={form.transactionProcessingStrategyCode}
              onValueChange={(v) => onChange({ transactionProcessingStrategyCode: v })}
            >
              <SelectTrigger id="transactionProcessingStrategyCode">
                <SelectValue placeholder="Select repayment strategy" />
              </SelectTrigger>
              <SelectContent>
                {strategies.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <EnumSelect
            id="daysInYearType"
            label="Days in Year"
            tooltip={T.daysInYearType}
            value={form.daysInYearType}
            options={daysInYear}
            onChange={(v) => onChange({ daysInYearType: v })}
          />
          <EnumSelect
            id="daysInMonthType"
            label="Days in Month"
            tooltip={T.daysInMonthType}
            value={form.daysInMonthType}
            options={daysInMonth}
            onChange={(v) => onChange({ daysInMonthType: v })}
          />
          {loanScheduleTypes.length > 0 && (
            <CodeSelect
              id="loanScheduleType"
              label="Loan Schedule Type"
              tooltip={T.loanScheduleType}
              value={form.loanScheduleType}
              options={loanScheduleTypes}
              onChange={handleScheduleTypeChange}
            />
          )}
          {isProgressive && loanScheduleProcessingTypes.length > 0 && (
            <CodeSelect
              id="loanScheduleProcessingType"
              label="Loan Schedule Processing Type"
              tooltip={T.loanScheduleProcessingType}
              value={form.loanScheduleProcessingType}
              options={loanScheduleProcessingTypes}
              onChange={(v) => onChange({ loanScheduleProcessingType: v })}
            />
          )}
        </div>
        <SwitchRow
          id="allowPartialPeriodInterestCalculation"
          label="Allow Partial Period Interest Calculation"
          tooltip={T.allowPartialPeriodInterestCalculation}
          hint={
            isDailyInterestCalculation
              ? "Disabled for daily interest calculation because Fineract will force this off."
              : "Allow interest calculation for partial periods at the same rate as full periods."
          }
          checked={form.allowPartialPeriodInterestCalculation}
          disabled={isDailyInterestCalculation}
          onChange={(v) => onChange({ allowPartialPeriodInterestCalculation: v })}
        />
        {isDailyInterestCalculation && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              Partial-period interest is not supported when the interest calculation period is
              set to Daily. Choose a different interest calculation period to enable this option.
            </p>
          </div>
        )}
        <SwitchRow
          id="isEqualAmortization"
          label="Equal Amortization"
          tooltip={T.isEqualAmortization}
          hint="Distribute the amortization equally across all repayment periods."
          checked={form.isEqualAmortization}
          onChange={(v) => onChange({ isEqualAmortization: v })}
        />
      </section>

      <Separator />

      {/* Grace periods */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Grace Periods & Arrears
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumInput
            id="graceOnPrincipalPayment"
            label="Grace on Principal Payment"
            tooltip={T.graceOnPrincipalPayment}
            hint="Repayments of principal not required for this many periods."
            value={form.graceOnPrincipalPayment}
            min={0}
            onChange={(v) => onChange({ graceOnPrincipalPayment: v })}
          />
          <NumInput
            id="graceOnInterestPayment"
            label="Grace on Interest Payment"
            tooltip={T.graceOnInterestPayment}
            hint="Repayments of interest not required for this many periods."
            value={form.graceOnInterestPayment}
            min={0}
            onChange={(v) => onChange({ graceOnInterestPayment: v })}
          />
          <NumInput
            id="graceOnInterestCharged"
            label="Grace on Interest Charged"
            tooltip={T.graceOnInterestCharged}
            hint="No interest charged for this many periods."
            value={form.graceOnInterestCharged}
            min={0}
            onChange={(v) => onChange({ graceOnInterestCharged: v })}
          />
          <NumInput
            id="graceOnArrearsAgeing"
            label="Grace on Arrears Ageing (days)"
            tooltip={T.graceOnArrearsAgeing}
            hint="Days overdue before account moves into arrears."
            value={form.graceOnArrearsAgeing}
            min={0}
            onChange={(v) => onChange({ graceOnArrearsAgeing: v })}
          />
          <NumInput
            id="inArrearsTolerance"
            label="In Arrears Tolerance"
            tooltip={T.inArrearsTolerance}
            hint="Maximum amount that can be overdue before the account is in arrears."
            value={form.inArrearsTolerance}
            min={0}
            step={0.01}
            onChange={(v) => onChange({ inArrearsTolerance: v })}
          />
          <NumInput
            id="overdueDaysForNPA"
            label="Days Overdue Before NPA"
            tooltip={T.overdueDaysForNPA}
            hint="Overdue days before the account is flagged as Non-Performing Asset."
            value={form.overdueDaysForNPA}
            min={0}
            onChange={(v) => onChange({ overdueDaysForNPA: v })}
          />
        </div>
        <SwitchRow
          id="accountMovesOutOfNPAOnlyOnArrearsCompletion"
          label="Account Moves Out of NPA Only After All Arrears Cleared"
          tooltip={T.accountMovesOutOfNPAOnlyOnArrearsCompletion}
          checked={form.accountMovesOutOfNPAOnlyOnArrearsCompletion}
          onChange={(v) => onChange({ accountMovesOutOfNPAOnlyOnArrearsCompletion: v })}
        />
      </section>

      <Separator />

      {/* Multi-disbursement */}
      <section className="space-y-4">
        <div
          className="flex cursor-pointer select-none items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
          onClick={() => onChange({ multiDisburseLoan: !form.multiDisburseLoan })}
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-1">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Multiple Disbursements (Tranches)
              </h3>
              <TooltipHelp
                tooltip={T.multiDisburseLoan}
                ariaLabel="More information about multiple disbursements"
              />
            </div>
          </div>
          <Switch
            checked={form.multiDisburseLoan}
            onCheckedChange={(v) => onChange({ multiDisburseLoan: v })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {form.multiDisburseLoan && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumInput
                id="maxTrancheCount"
                label="Max Tranche Count"
                tooltip={T.maxTrancheCount}
                value={form.maxTrancheCount}
                min={1}
                onChange={(v) => onChange({ maxTrancheCount: v })}
              />
              <NumInput
                id="outstandingLoanBalance"
                label="Outstanding Loan Balance"
                tooltip={T.outstandingLoanBalance}
                value={form.outstandingLoanBalance}
                min={0}
                step={0.01}
                onChange={(v) => onChange({ outstandingLoanBalance: v })}
              />
            </div>
            <SwitchRow
              id="disallowExpectedDisbursements"
              label="Disallow Expected Disbursements"
              tooltip={T.disallowExpectedDisbursements}
              checked={form.disallowExpectedDisbursements}
              onChange={(v) => onChange({ disallowExpectedDisbursements: v })}
            />
          </div>
        )}
      </section>

      <Separator />

      {/* Interest Recalculation */}
      <section className="space-y-4">
        <div
          className="flex cursor-pointer select-none items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
          onClick={() => handleInterestRecalculationChange(!form.isInterestRecalculationEnabled)}
        >
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Interest Recalculation
            </h3>
            <TooltipHelp
              tooltip={T.isInterestRecalculationEnabled}
              ariaLabel="More information about interest recalculation"
            />
          </div>
          <Switch
            checked={form.isInterestRecalculationEnabled}
            onCheckedChange={handleInterestRecalculationChange}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {form.isInterestRecalculationEnabled && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <EnumSelect
                id="preClosureInterestCalculationStrategy"
                label="Pre-Closure Interest Calculation Strategy"
                tooltip={T.preClosureInterestCalculationStrategy}
                value={form.preClosureInterestCalculationStrategy}
                options={preClosureStrategies}
                onChange={(v) => onChange({ preClosureInterestCalculationStrategy: v })}
              />
              <EnumSelect
                id="rescheduleStrategyMethod"
                label="Advance Payments Adjustment Type"
                tooltip={T.rescheduleStrategyMethod}
                value={form.rescheduleStrategyMethod}
                options={rescheduleStrategyOptions}
                disabled={isProgressive}
                onChange={(v) => onChange({ rescheduleStrategyMethod: v })}
              />
              <EnumSelect
                id="interestRecalculationCompoundingMethod"
                label="Compounding Method"
                tooltip={T.interestRecalculationCompoundingMethod}
                value={form.interestRecalculationCompoundingMethod}
                options={compoundingMethods}
                onChange={(v) => onChange({ interestRecalculationCompoundingMethod: v })}
              />
              <EnumSelect
                id="recalculationRestFrequencyType"
                label="Rest Frequency Type"
                tooltip={T.recalculationRestFrequencyType}
                value={form.recalculationRestFrequencyType}
                options={recalcFreqTypes}
                onChange={(v) => onChange({ recalculationRestFrequencyType: v })}
              />
              {form.recalculationRestFrequencyType !== "" &&
                form.recalculationRestFrequencyType !== 0 && (
                  <NumInput
                    id="recalculationRestFrequencyInterval"
                    label="Rest Frequency Interval"
                    tooltip={T.recalculationRestFrequencyInterval}
                    value={form.recalculationRestFrequencyInterval}
                    min={1}
                    onChange={(v) => onChange({ recalculationRestFrequencyInterval: v })}
                  />
                )}
            </div>
            <SwitchRow
              id="isArrearsBasedOnOriginalSchedule"
              label="Arrears Based on Original Schedule"
              tooltip={T.isArrearsBasedOnOriginalSchedule}
              checked={form.isArrearsBasedOnOriginalSchedule}
              onChange={(v) => onChange({ isArrearsBasedOnOriginalSchedule: v })}
            />
            <SwitchRow
              id="disallowInterestCalculationOnPastDue"
              label="Disallow Interest Calculation on Past Due"
              tooltip={T.disallowInterestCalculationOnPastDue}
              checked={form.disallowInterestCalculationOnPastDue}
              onChange={(v) => onChange({ disallowInterestCalculationOnPastDue: v })}
            />
          </div>
        )}
      </section>

      <Separator />

      {/* Guarantee */}
      <section className="space-y-4">
        <div
          className="flex cursor-pointer select-none items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
          onClick={() => onChange({ holdGuaranteeFunds: !form.holdGuaranteeFunds })}
        >
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Guarantee Funds
            </h3>
            <TooltipHelp tooltip={T.holdGuaranteeFunds} ariaLabel="More information about guarantee funds" />
          </div>
          <Switch
            checked={form.holdGuaranteeFunds}
            onCheckedChange={(v) => onChange({ holdGuaranteeFunds: v })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {form.holdGuaranteeFunds && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-lg border bg-muted/30 p-4">
            <NumInput
              id="mandatoryGuarantee"
              label="Mandatory Guarantee %"
              tooltip={T.mandatoryGuarantee}
              value={form.mandatoryGuarantee}
              min={0}
              max={100}
              step={0.01}
              onChange={(v) => onChange({ mandatoryGuarantee: v })}
            />
            <NumInput
              id="minimumGuaranteeFromGuarantor"
              label="Min Guarantee from Guarantor %"
              tooltip={T.minimumGuaranteeFromGuarantor}
              value={form.minimumGuaranteeFromGuarantor}
              min={0}
              max={100}
              step={0.01}
              onChange={(v) => onChange({ minimumGuaranteeFromGuarantor: v })}
            />
            <NumInput
              id="minimumGuaranteeFromOwnFunds"
              label="Min Guarantee from Own Funds %"
              tooltip={T.minimumGuaranteeFromOwnFunds}
              value={form.minimumGuaranteeFromOwnFunds}
              min={0}
              max={100}
              step={0.01}
              onChange={(v) => onChange({ minimumGuaranteeFromOwnFunds: v })}
            />
          </div>
        )}
      </section>

      <Separator />

      {/* Variable Installments */}
      <section className="space-y-4">
        <div
          className="flex cursor-pointer select-none items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
          onClick={() => onChange({ allowVariableInstallments: !form.allowVariableInstallments })}
        >
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Variable Installments
            </h3>
            <TooltipHelp
              tooltip={T.allowVariableInstallments}
              ariaLabel="More information about variable installments"
            />
          </div>
          <Switch
            checked={form.allowVariableInstallments}
            onCheckedChange={(v) => onChange({ allowVariableInstallments: v })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {form.allowVariableInstallments && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-lg border bg-muted/30 p-4">
            <NumInput
              id="minimumGap"
              label="Minimum Gap (days)"
              tooltip={T.minimumGap}
              value={form.minimumGap}
              min={0}
              onChange={(v) => onChange({ minimumGap: v })}
            />
            <NumInput
              id="maximumGap"
              label="Maximum Gap (days)"
              tooltip={T.maximumGap}
              value={form.maximumGap}
              min={0}
              onChange={(v) => onChange({ maximumGap: v })}
            />
          </div>
        )}
      </section>

      <Separator />

      {/* Down Payment */}
      <section className="space-y-4">
        <div
          className="flex cursor-pointer select-none items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
          onClick={() => onChange({ enableDownPayment: !form.enableDownPayment })}
        >
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Down Payment
            </h3>
            <TooltipHelp tooltip={T.enableDownPayment} ariaLabel="More information about down payment" />
          </div>
          <Switch
            checked={form.enableDownPayment}
            onCheckedChange={(v) => onChange({ enableDownPayment: v })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {form.enableDownPayment && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <NumInput
              id="disbursedAmountPercentageForDownPayment"
              label="Down Payment % of Disbursed Amount"
              tooltip={T.disbursedAmountPercentageForDownPayment}
              value={form.disbursedAmountPercentageForDownPayment}
              min={0}
              max={100}
              step={0.01}
              onChange={(v) => onChange({ disbursedAmountPercentageForDownPayment: v })}
            />
            <SwitchRow
              id="enableAutoRepaymentForDownPayment"
              label="Enable Auto Repayment for Down Payment"
              tooltip={T.enableAutoRepaymentForDownPayment}
              checked={form.enableAutoRepaymentForDownPayment}
              onChange={(v) => onChange({ enableAutoRepaymentForDownPayment: v })}
            />
          </div>
        )}
      </section>

      <Separator />

      {/* Delinquency */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Delinquency
        </h3>
        {delinquencyBuckets.length > 0 && (
          <div className="space-y-2">
            <FieldLabel
              htmlFor="delinquencyBucketId"
              label="Delinquency Bucket"
              tooltip={T.delinquencyBucketId}
            />
            <Select
              value={form.delinquencyBucketId === "" ? "__none__" : String(form.delinquencyBucketId)}
              onValueChange={(v) =>
                onChange({ delinquencyBucketId: v === "__none__" ? "" : Number(v) })
              }
            >
              <SelectTrigger id="delinquencyBucketId">
                <SelectValue placeholder="Select bucket (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {delinquencyBuckets.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <SwitchRow
          id="enableInstallmentLevelDelinquency"
          label="Enable Installment Level Delinquency"
          tooltip={T.enableInstallmentLevelDelinquency}
          checked={form.enableInstallmentLevelDelinquency}
          onChange={(v) => onChange({ enableInstallmentLevelDelinquency: v })}
        />
      </section>

      <Separator />

      {/* Misc */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Additional Settings
        </h3>
        <div className="space-y-3">
          <SwitchRow
            id="canDefineInstallmentAmount"
            label="Can Define Installment Amount"
            tooltip={T.canDefineInstallmentAmount}
            hint="Allow loan officers to define the installment amount when creating a loan account."
            checked={form.canDefineInstallmentAmount}
            onChange={(v) => onChange({ canDefineInstallmentAmount: v })}
          />
          {form.canDefineInstallmentAmount && (
            <div className="pl-4">
              <NumInput
                id="principalThresholdForLastInstallment"
                label="Principal Threshold for Last Installment (%)"
                tooltip={T.principalThresholdForLastInstallment}
                value={form.principalThresholdForLastInstallment}
                min={0}
                max={100}
                step={0.01}
                hint="If remaining principal is below this % of the regular installment, it is merged with the last installment."
                onChange={(v) => onChange({ principalThresholdForLastInstallment: v })}
              />
            </div>
          )}
          <SwitchRow
            id="canUseForTopup"
            label="Can Be Used for Top-Up Loans"
            tooltip={T.canUseForTopup}
            checked={form.canUseForTopup}
            onChange={(v) => onChange({ canUseForTopup: v })}
          />
        </div>
      </section>
    </div>
  );
}
