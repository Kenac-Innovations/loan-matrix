"use client";

import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { FieldLabel, TooltipHelp } from "./field-label";
import { LOAN_PRODUCT_TOOLTIPS as T } from "./loan-product-tooltips";

interface StepTermsProps {
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
  disabled,
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
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel
        htmlFor={id}
        label={label}
        required={required}
        tooltip={tooltip}
        labelClassName={disabled ? "text-muted-foreground" : ""}
      />
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step ?? "any"}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StepTerms({ form, template, onChange }: StepTermsProps) {
  const freqOptions = template.repaymentFrequencyTypeOptions ?? [];
  const interestFreqOptions = template.interestRateFrequencyTypeOptions ?? [];
  const floatingRates = template.floatingRateOptions ?? [];
  const repayStartOptions = template.repaymentStartDateTypeOptions ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Loan Terms</h2>
        <p className="text-sm text-muted-foreground">
          Define principal amounts, repayment schedule, and interest configuration.
        </p>
      </div>

      {/* Principal */}
      <section className="space-y-4">
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Principal
          </h3>
          <TooltipHelp tooltip="Defines the minimum, default, and maximum principal amounts." ariaLabel="More information about principal" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumInput
            id="minPrincipal"
            label="Min Principal"
            tooltip={T.minPrincipal}
            value={form.minPrincipal}
            min={0}
            onChange={(v) => onChange({ minPrincipal: v })}
            placeholder="0"
          />
          <NumInput
            id="principal"
            label="Default Principal"
            required
            tooltip={T.principal}
            value={form.principal}
            min={0}
            onChange={(v) => onChange({ principal: v })}
            placeholder="10000"
          />
          <NumInput
            id="maxPrincipal"
            label="Max Principal"
            tooltip={T.maxPrincipal}
            value={form.maxPrincipal}
            min={0}
            onChange={(v) => onChange({ maxPrincipal: v })}
            placeholder="100000"
          />
        </div>
        <div
          className="flex cursor-pointer select-none items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
          onClick={() => onChange({ useBorrowerCycle: !form.useBorrowerCycle })}
        >
          <div className="space-y-1">
            <FieldLabel
              label="Use Borrower Cycle"
              tooltip={T.useBorrowerCycle}
              labelClassName="pointer-events-none text-sm font-medium"
            />
            <p className="text-xs text-muted-foreground">
              Set different principal limits per loan cycle number.
            </p>
          </div>
          <Switch
            checked={form.useBorrowerCycle}
            onCheckedChange={(v) => onChange({ useBorrowerCycle: v })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </section>

      <Separator />

      {/* Repayment */}
      <section className="space-y-4">
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Repayment Schedule
          </h3>
          <TooltipHelp
            tooltip="Defines when installments are due and how many repayments are expected."
            ariaLabel="More information about the repayment schedule"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumInput
            id="minNumberOfRepayments"
            label="Min # of Repayments"
            tooltip={T.minNumberOfRepayments}
            value={form.minNumberOfRepayments}
            min={1}
            onChange={(v) => onChange({ minNumberOfRepayments: v })}
          />
          <NumInput
            id="numberOfRepayments"
            label="# of Repayments"
            required
            tooltip={T.numberOfRepayments}
            value={form.numberOfRepayments}
            min={1}
            onChange={(v) => onChange({ numberOfRepayments: v })}
            placeholder="12"
          />
          <NumInput
            id="maxNumberOfRepayments"
            label="Max # of Repayments"
            tooltip={T.maxNumberOfRepayments}
            value={form.maxNumberOfRepayments}
            min={1}
            onChange={(v) => onChange({ maxNumberOfRepayments: v })}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumInput
            id="repaymentEvery"
            label="Repaid Every"
            required
            tooltip={T.repaymentEvery}
            value={form.repaymentEvery}
            min={1}
            onChange={(v) => onChange({ repaymentEvery: v })}
            placeholder="1"
          />
          <div className="space-y-2">
            <FieldLabel
              htmlFor="repaymentFrequencyType"
              label="Frequency"
              required
              tooltip={T.repaymentFrequencyType}
            />
            <Select
              value={form.repaymentFrequencyType === "" ? "" : String(form.repaymentFrequencyType)}
              onValueChange={(v) =>
                onChange({ repaymentFrequencyType: v === "" ? "" : Number(v) })
              }
            >
              <SelectTrigger id="repaymentFrequencyType">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {freqOptions.map((opt) => (
                  <SelectItem key={opt.id} value={String(opt.id)}>
                    {opt.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumInput
            id="minimumDaysBetweenDisbursalAndFirstRepayment"
            label="Min Days Between Disbursal & First Repayment"
            tooltip={T.minimumDaysBetweenDisbursalAndFirstRepayment}
            value={form.minimumDaysBetweenDisbursalAndFirstRepayment}
            min={0}
            onChange={(v) => onChange({ minimumDaysBetweenDisbursalAndFirstRepayment: v })}
          />
          {repayStartOptions.length > 0 && (
            <div className="space-y-2">
              <FieldLabel
                htmlFor="repaymentStartDateType"
                label="Repayment Start Date Type"
                tooltip={T.repaymentStartDateType}
              />
              <Select
                value={
                  form.repaymentStartDateType === ""
                    ? ""
                    : String(form.repaymentStartDateType)
                }
                onValueChange={(v) =>
                  onChange({ repaymentStartDateType: v === "" ? "" : Number(v) })
                }
              >
                <SelectTrigger id="repaymentStartDateType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {repayStartOptions.map((opt) => (
                    <SelectItem key={opt.id} value={String(opt.id)}>
                      {opt.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <NumInput
            id="fixedLength"
            label="Fixed Length (months)"
            tooltip={T.fixedLength}
            value={form.fixedLength}
            min={0}
            onChange={(v) => onChange({ fixedLength: v })}
            hint="Optional fixed loan term length"
          />
        </div>

        <div
          className="flex cursor-pointer select-none items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
          onClick={() => onChange({ interestRecognitionOnDisbursementDate: !form.interestRecognitionOnDisbursementDate })}
        >
          <div className="space-y-1">
            <FieldLabel
              label="Interest Recognition on Disbursement Date"
              tooltip="Calculates interest from the disbursement date rather than the expected first repayment date."
              labelClassName="pointer-events-none text-sm font-medium"
            />
            <p className="text-xs text-muted-foreground">
              Calculate interest from the disbursement date rather than the expected first
              repayment date.
            </p>
          </div>
          <Switch
            checked={form.interestRecognitionOnDisbursementDate}
            onCheckedChange={(v) => onChange({ interestRecognitionOnDisbursementDate: v })}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </section>

      <Separator />

      {/* Interest */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Interest Rate
            </h3>
            <TooltipHelp
              tooltip="Defines the minimum, default, maximum, and period for the nominal or floating interest rate."
              ariaLabel="More information about interest rates"
            />
          </div>
          <div
            className={`flex select-none items-center gap-2 rounded-md border px-3 py-1.5 transition-colors ${
              form.isInvoiceDiscounting
                ? "cursor-not-allowed opacity-40"
                : "cursor-pointer hover:bg-muted/40"
            }`}
            onClick={() =>
              !form.isInvoiceDiscounting &&
              onChange({ isLinkedToFloatingInterestRates: !form.isLinkedToFloatingInterestRates })
            }
          >
            <FieldLabel
              htmlFor="isLinkedToFloatingInterestRates"
              label="Use Floating Rates"
              tooltip={T.isLinkedToFloatingInterestRates}
              labelClassName="pointer-events-none text-sm"
            />
            <Switch
              id="isLinkedToFloatingInterestRates"
              checked={form.isLinkedToFloatingInterestRates}
              disabled={form.isInvoiceDiscounting}
              onCheckedChange={(v) => !form.isInvoiceDiscounting && onChange({ isLinkedToFloatingInterestRates: v })}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {form.isLinkedToFloatingInterestRates ? (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="space-y-2">
              <FieldLabel
                htmlFor="floatingRatesId"
                label="Floating Rate"
                required
                tooltip={T.floatingRatesId}
              />
              <Select
                value={form.floatingRatesId === "" ? "" : String(form.floatingRatesId)}
                onValueChange={(v) =>
                  onChange({ floatingRatesId: v === "" ? "" : Number(v) })
                }
              >
                <SelectTrigger id="floatingRatesId">
                  <SelectValue placeholder="Select floating rate" />
                </SelectTrigger>
                <SelectContent>
                  {floatingRates.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumInput
                id="interestRateDifferential"
                label="Differential"
                tooltip={T.defaultDifferentialLendingRate}
                value={form.interestRateDifferential}
                step={0.01}
                onChange={(v) => onChange({ interestRateDifferential: v })}
              />
              <NumInput
                id="minDifferentialLendingRate"
                label="Min Differential"
                tooltip={T.minDifferentialLendingRate}
                value={form.minDifferentialLendingRate}
                step={0.01}
                onChange={(v) => onChange({ minDifferentialLendingRate: v })}
              />
              <NumInput
                id="defaultDifferentialLendingRate"
                label="Default Differential"
                tooltip={T.defaultDifferentialLendingRate}
                value={form.defaultDifferentialLendingRate}
                step={0.01}
                onChange={(v) => onChange({ defaultDifferentialLendingRate: v })}
              />
              <NumInput
                id="maxDifferentialLendingRate"
                label="Max Differential"
                tooltip={T.maxDifferentialLendingRate}
                value={form.maxDifferentialLendingRate}
                step={0.01}
                onChange={(v) => onChange({ maxDifferentialLendingRate: v })}
              />
            </div>
            <div
              className="flex cursor-pointer select-none items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/40"
              onClick={() => onChange({ isFloatingInterestRateCalculationAllowed: !form.isFloatingInterestRateCalculationAllowed })}
            >
              <FieldLabel
                label="Floating Interest Rate Calculation Allowed"
                tooltip={T.isFloatingInterestRateCalculationAllowed}
                labelClassName="pointer-events-none text-sm"
              />
              <Switch
                checked={form.isFloatingInterestRateCalculationAllowed}
                onCheckedChange={(v) =>
                  onChange({ isFloatingInterestRateCalculationAllowed: v })
                }
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {form.isInvoiceDiscounting && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <span className="font-semibold">Invoice discounting product — interest locked at 0%.</span>{" "}
                  Discounting income is collected through charges, not interest. These fields
                  are fixed and cannot be changed.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <NumInput
                id="minInterestRatePerPeriod"
                label="Min Nominal Interest Rate %"
                tooltip={T.minInterestRatePerPeriod}
                value={form.isInvoiceDiscounting ? 0 : form.minInterestRatePerPeriod}
                min={0}
                step={0.01}
                onChange={(v) => !form.isInvoiceDiscounting && onChange({ minInterestRatePerPeriod: v })}
                disabled={form.isInvoiceDiscounting}
              />
              <NumInput
                id="interestRatePerPeriod"
                label="Nominal Interest Rate %"
                required
                tooltip={T.interestRatePerPeriod}
                value={form.isInvoiceDiscounting ? 0 : form.interestRatePerPeriod}
                min={0}
                step={0.01}
                placeholder="10"
                onChange={(v) => !form.isInvoiceDiscounting && onChange({ interestRatePerPeriod: v })}
                disabled={form.isInvoiceDiscounting}
              />
              <NumInput
                id="maxInterestRatePerPeriod"
                label="Max Nominal Interest Rate %"
                tooltip={T.maxInterestRatePerPeriod}
                value={form.isInvoiceDiscounting ? 0 : form.maxInterestRatePerPeriod}
                min={0}
                step={0.01}
                onChange={(v) => !form.isInvoiceDiscounting && onChange({ maxInterestRatePerPeriod: v })}
                disabled={form.isInvoiceDiscounting}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel
                htmlFor="interestRateFrequencyType"
                label="Interest Rate Frequency"
                required
                tooltip={T.interestRateFrequencyType}
                labelClassName={form.isInvoiceDiscounting ? "text-muted-foreground" : ""}
              />
              <Select
                value={
                  form.interestRateFrequencyType === ""
                    ? ""
                    : String(form.interestRateFrequencyType)
                }
                disabled={form.isInvoiceDiscounting}
                onValueChange={(v) =>
                  !form.isInvoiceDiscounting &&
                  onChange({ interestRateFrequencyType: v === "" ? "" : Number(v) })
                }
              >
                <SelectTrigger id="interestRateFrequencyType" disabled={form.isInvoiceDiscounting}>
                  <SelectValue placeholder="Per period" />
                </SelectTrigger>
                <SelectContent>
                  {interestFreqOptions.map((opt) => (
                    <SelectItem key={opt.id} value={String(opt.id)}>
                      {opt.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </section>

      <Separator />

      {/* Over Applied */}
      <section className="space-y-4">
        <div
          className="flex cursor-pointer select-none items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
          onClick={() => onChange({ allowApprovedDisbursedAmountsOverApplied: !form.allowApprovedDisbursedAmountsOverApplied })}
        >
          <div className="flex items-center gap-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Over-Applied Amounts
            </h3>
            <TooltipHelp
              tooltip={T.allowApprovedDisbursedAmountsOverApplied}
              ariaLabel="More information about over-applied amounts"
            />
          </div>
          <Switch
            checked={form.allowApprovedDisbursedAmountsOverApplied}
            onCheckedChange={(v) =>
              onChange({ allowApprovedDisbursedAmountsOverApplied: v })
            }
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {form.allowApprovedDisbursedAmountsOverApplied && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-lg border bg-muted/30 p-4">
            <div className="space-y-2">
              <FieldLabel
                htmlFor="overAppliedCalculationType"
                label="Over Applied Calculation Type"
                tooltip={T.overAppliedCalculationType}
              />
              <Select
                value={form.overAppliedCalculationType}
                onValueChange={(v) => onChange({ overAppliedCalculationType: v })}
              >
                <SelectTrigger id="overAppliedCalculationType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {(template.overAppliedCalculationTypeOptions ?? []).map((opt) => (
                    <SelectItem key={opt.code} value={opt.code}>
                      {opt.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <NumInput
              id="overAppliedNumber"
              label="Over Applied Number"
              tooltip={T.overAppliedNumber}
              value={form.overAppliedNumber}
              min={0}
              step={0.01}
              onChange={(v) => onChange({ overAppliedNumber: v })}
            />
          </div>
        )}
      </section>
    </div>
  );
}
