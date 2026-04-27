"use client";

import { Input } from "@/components/ui/input";
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
import type { LoanProductFormData, LoanProductTemplate } from "@/shared/types/loan-product";

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
  value: number | "";
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number | "") => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
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
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: number | "";
  options: { id: number; value: string }[];
  placeholder?: string;
  onChange: (v: number | "") => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Select
        value={value === "" ? "" : String(value)}
        onValueChange={(v) => onChange(v === "" ? "" : Number(v))}
      >
        <SelectTrigger id={id}>
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
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  options: { code: string; value: string }[];
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
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
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex cursor-pointer select-none items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
      onClick={() => onChange(!checked)}
    >
      <div className="space-y-1">
        <Label htmlFor={id} className="pointer-events-none text-sm font-medium">
          {label}
        </Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch
        id={id}
        checked={checked}
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
  const strategies = template.transactionProcessingStrategyOptions ?? [];
  const daysInYear = template.daysInYearTypeOptions ?? [];
  const daysInMonth = template.daysInMonthTypeOptions ?? [];
  const compoundingMethods = template.interestRecalculationCompoundingTypeOptions ?? [];
  const rescheduleStrategies = template.rescheduleStrategyTypeOptions ?? [];
  const preClosureStrategies = template.preClosureInterestCalculationStrategyOptions ?? [];
  const recalcFreqTypes = template.interestRecalculationFrequencyTypeOptions ?? [];
  const delinquencyBuckets = template.delinquencyBucketOptions ?? [];
  const loanScheduleTypes = template.loanScheduleTypeOptions ?? [];
  const loanScheduleProcessingTypes = template.loanScheduleProcessingTypeOptions ?? [];

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
            value={form.amortizationType}
            options={amortTypes}
            placeholder="Select amortization type"
            onChange={(v) => onChange({ amortizationType: v })}
          />
          <EnumSelect
            id="interestType"
            label="Interest Type"
            required
            value={form.interestType}
            options={interestTypes}
            placeholder="Select interest type"
            onChange={(v) => onChange({ interestType: v })}
          />
          <EnumSelect
            id="interestCalculationPeriodType"
            label="Interest Calculation Period"
            value={form.interestCalculationPeriodType}
            options={interestCalcTypes}
            onChange={(v) => onChange({ interestCalculationPeriodType: v })}
          />
          <div className="space-y-2">
            <Label htmlFor="transactionProcessingStrategyCode">
              Repayment Strategy <span className="text-destructive">*</span>
            </Label>
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
            value={form.daysInYearType}
            options={daysInYear}
            onChange={(v) => onChange({ daysInYearType: v })}
          />
          <EnumSelect
            id="daysInMonthType"
            label="Days in Month"
            value={form.daysInMonthType}
            options={daysInMonth}
            onChange={(v) => onChange({ daysInMonthType: v })}
          />
          {loanScheduleTypes.length > 0 && (
            <CodeSelect
              id="loanScheduleType"
              label="Loan Schedule Type"
              value={form.loanScheduleType}
              options={loanScheduleTypes}
              onChange={(v) => onChange({ loanScheduleType: v })}
            />
          )}
          {loanScheduleProcessingTypes.length > 0 && (
            <CodeSelect
              id="loanScheduleProcessingType"
              label="Loan Schedule Processing Type"
              value={form.loanScheduleProcessingType}
              options={loanScheduleProcessingTypes}
              onChange={(v) => onChange({ loanScheduleProcessingType: v })}
            />
          )}
        </div>
        <SwitchRow
          id="allowPartialPeriodInterestCalculation"
          label="Allow Partial Period Interest Calculation"
          hint="Allow interest calculation for partial periods at the same rate as full periods."
          checked={form.allowPartialPeriodInterestCalculation}
          onChange={(v) => onChange({ allowPartialPeriodInterestCalculation: v })}
        />
        <SwitchRow
          id="isEqualAmortization"
          label="Equal Amortization"
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
            hint="Repayments of principal not required for this many periods."
            value={form.graceOnPrincipalPayment}
            min={0}
            onChange={(v) => onChange({ graceOnPrincipalPayment: v })}
          />
          <NumInput
            id="graceOnInterestPayment"
            label="Grace on Interest Payment"
            hint="Repayments of interest not required for this many periods."
            value={form.graceOnInterestPayment}
            min={0}
            onChange={(v) => onChange({ graceOnInterestPayment: v })}
          />
          <NumInput
            id="graceOnInterestCharged"
            label="Grace on Interest Charged"
            hint="No interest charged for this many periods."
            value={form.graceOnInterestCharged}
            min={0}
            onChange={(v) => onChange({ graceOnInterestCharged: v })}
          />
          <NumInput
            id="graceOnArrearsAgeing"
            label="Grace on Arrears Ageing (days)"
            hint="Days overdue before account moves into arrears."
            value={form.graceOnArrearsAgeing}
            min={0}
            onChange={(v) => onChange({ graceOnArrearsAgeing: v })}
          />
          <NumInput
            id="inArrearsTolerance"
            label="In Arrears Tolerance"
            hint="Maximum amount that can be overdue before the account is in arrears."
            value={form.inArrearsTolerance}
            min={0}
            step={0.01}
            onChange={(v) => onChange({ inArrearsTolerance: v })}
          />
          <NumInput
            id="overdueDaysForNPA"
            label="Days Overdue Before NPA"
            hint="Overdue days before the account is flagged as Non-Performing Asset."
            value={form.overdueDaysForNPA}
            min={0}
            onChange={(v) => onChange({ overdueDaysForNPA: v })}
          />
        </div>
        <SwitchRow
          id="accountMovesOutOfNPAOnlyOnArrearsCompletion"
          label="Account Moves Out of NPA Only After All Arrears Cleared"
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
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Multiple Disbursements (Tranches)
            </h3>
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
                value={form.maxTrancheCount}
                min={1}
                onChange={(v) => onChange({ maxTrancheCount: v })}
              />
              <NumInput
                id="outstandingLoanBalance"
                label="Outstanding Loan Balance"
                value={form.outstandingLoanBalance}
                min={0}
                step={0.01}
                onChange={(v) => onChange({ outstandingLoanBalance: v })}
              />
            </div>
            <SwitchRow
              id="disallowExpectedDisbursements"
              label="Disallow Expected Disbursements"
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
          onClick={() => onChange({ isInterestRecalculationEnabled: !form.isInterestRecalculationEnabled })}
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Interest Recalculation
          </h3>
          <Switch
            checked={form.isInterestRecalculationEnabled}
            onCheckedChange={(v) => onChange({ isInterestRecalculationEnabled: v })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {form.isInterestRecalculationEnabled && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <EnumSelect
                id="preClosureInterestCalculationStrategy"
                label="Pre-Closure Interest Calculation Strategy"
                value={form.preClosureInterestCalculationStrategy}
                options={preClosureStrategies}
                onChange={(v) => onChange({ preClosureInterestCalculationStrategy: v })}
              />
              <EnumSelect
                id="rescheduleStrategyMethod"
                label="Reschedule Strategy"
                value={form.rescheduleStrategyMethod}
                options={rescheduleStrategies}
                onChange={(v) => onChange({ rescheduleStrategyMethod: v })}
              />
              <EnumSelect
                id="interestRecalculationCompoundingMethod"
                label="Compounding Method"
                value={form.interestRecalculationCompoundingMethod}
                options={compoundingMethods}
                onChange={(v) => onChange({ interestRecalculationCompoundingMethod: v })}
              />
              <EnumSelect
                id="recalculationRestFrequencyType"
                label="Rest Frequency Type"
                value={form.recalculationRestFrequencyType}
                options={recalcFreqTypes}
                onChange={(v) => onChange({ recalculationRestFrequencyType: v })}
              />
              {form.recalculationRestFrequencyType !== "" &&
                form.recalculationRestFrequencyType !== 0 && (
                  <NumInput
                    id="recalculationRestFrequencyInterval"
                    label="Rest Frequency Interval"
                    value={form.recalculationRestFrequencyInterval}
                    min={1}
                    onChange={(v) => onChange({ recalculationRestFrequencyInterval: v })}
                  />
                )}
            </div>
            <SwitchRow
              id="isArrearsBasedOnOriginalSchedule"
              label="Arrears Based on Original Schedule"
              checked={form.isArrearsBasedOnOriginalSchedule}
              onChange={(v) => onChange({ isArrearsBasedOnOriginalSchedule: v })}
            />
            <SwitchRow
              id="disallowInterestCalculationOnPastDue"
              label="Disallow Interest Calculation on Past Due"
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
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Guarantee Funds
          </h3>
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
              value={form.mandatoryGuarantee}
              min={0}
              max={100}
              step={0.01}
              onChange={(v) => onChange({ mandatoryGuarantee: v })}
            />
            <NumInput
              id="minimumGuaranteeFromGuarantor"
              label="Min Guarantee from Guarantor %"
              value={form.minimumGuaranteeFromGuarantor}
              min={0}
              max={100}
              step={0.01}
              onChange={(v) => onChange({ minimumGuaranteeFromGuarantor: v })}
            />
            <NumInput
              id="minimumGuaranteeFromOwnFunds"
              label="Min Guarantee from Own Funds %"
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
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Variable Installments
          </h3>
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
              value={form.minimumGap}
              min={0}
              onChange={(v) => onChange({ minimumGap: v })}
            />
            <NumInput
              id="maximumGap"
              label="Maximum Gap (days)"
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
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Down Payment
          </h3>
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
              value={form.disbursedAmountPercentageForDownPayment}
              min={0}
              max={100}
              step={0.01}
              onChange={(v) => onChange({ disbursedAmountPercentageForDownPayment: v })}
            />
            <SwitchRow
              id="enableAutoRepaymentForDownPayment"
              label="Enable Auto Repayment for Down Payment"
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
            <Label htmlFor="delinquencyBucketId">Delinquency Bucket</Label>
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
            hint="Allow loan officers to define the installment amount when creating a loan account."
            checked={form.canDefineInstallmentAmount}
            onChange={(v) => onChange({ canDefineInstallmentAmount: v })}
          />
          {form.canDefineInstallmentAmount && (
            <div className="pl-4">
              <NumInput
                id="principalThresholdForLastInstallment"
                label="Principal Threshold for Last Installment (%)"
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
            checked={form.canUseForTopup}
            onChange={(v) => onChange({ canUseForTopup: v })}
          />
        </div>
      </section>
    </div>
  );
}
