"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, AlertCircle, Landmark } from "lucide-react";
import { getActiveFacility } from "@/app/actions/credit-facility-actions";
import { parseFineractDateField } from "@/lib/credit-facility-utils";
import type { CreditFacilityInfo as CreditFacility, CreateFacilityData } from "@/lib/credit-facility-utils";
import { addMonths, format } from "date-fns";
import { cn } from "@/lib/utils";

export type FacilityIntent =
  | { mode: "create"; facility: CreateFacilityData }
  | { mode: "link" }
  | null;

interface FacilityToggleProps {
  fineractClientId: number | null | undefined;
  loanAmount: number;
  currencyCode?: string;
  onChange: (data: FacilityIntent) => void;
  onValidityChange?: (valid: boolean) => void;
}

function formatWithCommas(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en");
}

function parseRaw(formatted: string): number {
  return Number(formatted.replace(/,/g, ""));
}

export function FacilityToggle({
  fineractClientId,
  loanAmount,
  currencyCode = "USD",
  onChange,
  onValidityChange,
}: FacilityToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingFacility, setExistingFacility] = useState<CreditFacility | null>(null);
  const [checked, setChecked] = useState(false);

  // Credit limit stored as formatted display string; raw value derived on save
  const [creditLimitDisplay, setCreditLimitDisplay] = useState<string>("");
  const [tenorMonths, setTenorMonths] = useState<string>("12");
  const [drawdownTranches, setDrawdownTranches] = useState<string>("5");
  const [touched, setTouched] = useState(false);

  const creditLimitRaw = parseRaw(creditLimitDisplay);

  // Validation
  const limitError = (() => {
    if (!enabled || existingFacility || !checked) return null;
    if (!creditLimitDisplay) return "Credit limit is required";
    if (creditLimitRaw <= 0) return "Credit limit must be greater than zero";
    if (loanAmount > 0 && creditLimitRaw < loanAmount)
      return `Credit limit must be at least ${currencyCode} ${loanAmount.toLocaleString()} (the loan principal)`;
    return null;
  })();

  const available = existingFacility
    ? existingFacility.credit_limit - existingFacility.utilized_amount
    : null;
  const exceedsBalance = available !== null && loanAmount > available;

  const isValid = !enabled || (!!existingFacility && !exceedsBalance) || (!existingFacility && checked && !limitError && creditLimitRaw > 0);

  // Notify parent of validity
  useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid]);

  // Fetch existing facility when enabled
  useEffect(() => {
    if (!enabled || !fineractClientId || checked) return;
    setLoading(true);
    getActiveFacility(fineractClientId).then((f) => {
      setExistingFacility(f);
      setChecked(true);
      setLoading(false);
    });
  }, [enabled, fineractClientId, checked]);

  // Propagate intent to parent
  useEffect(() => {
    if (!enabled) {
      onChange(null);
      return;
    }
    if (existingFacility) {
      onChange({ mode: "link" });
      return;
    }
    const tenor = parseInt(tenorMonths, 10);
    const tranches = parseInt(drawdownTranches, 10);
    if (creditLimitRaw > 0 && tenor > 0 && tranches > 0) {
      onChange({
        mode: "create",
        facility: { creditLimit: creditLimitRaw, tenorMonths: tenor, drawdownTranches: tranches, currencyCode },
      });
    } else {
      onChange(null);
    }
  }, [enabled, existingFacility, creditLimitRaw, tenorMonths, drawdownTranches, currencyCode]);

  const handleToggle = (val: boolean) => {
    setEnabled(val);
    if (!val) {
      setChecked(false);
      setExistingFacility(null);
      setTouched(false);
    }
  };

  const handleCreditLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTouched(true);
    setCreditLimitDisplay(formatWithCommas(e.target.value));
  };

  const showError = touched && !!limitError;

  return (
    <div className="space-y-2">
      {/* Header card */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors",
          enabled
            ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"
            : "border-border bg-card"
        )}
      >
        <div
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
          onClick={() => handleToggle(!enabled)}
        >
          <div className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            enabled ? "bg-blue-100 dark:bg-blue-900" : "bg-muted"
          )}>
            <Landmark className={cn("h-4 w-4", enabled ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")} />
          </div>
          <div className="min-w-0">
            <p className={cn("text-sm font-medium leading-none", enabled && "text-blue-700 dark:text-blue-300")}>
              Link to Credit Facility
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {enabled && existingFacility
                ? "Loan will draw from existing facility"
                : enabled && checked && !existingFacility
                ? "A new facility will be created with this loan"
                : "Optionally associate this loan with a credit facility"}
            </p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} />
      </div>

      {/* Loading state */}
      {enabled && loading && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking for existing facility…
        </div>
      )}

      {/* Expanded content */}
      {enabled && !loading && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-4 space-y-4">
          {existingFacility ? (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-blue-700 border-blue-300 dark:text-blue-300 dark:border-blue-700">
                  {existingFacility.status}
                </Badge>
                <span className="text-sm font-medium">Active Facility Found</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Credit Limit</span>
                  <span className="font-medium">
                    {existingFacility.currency_code} {existingFacility.credit_limit.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Available</span>
                  <span className={cn("font-medium", exceedsBalance && "text-destructive")}>
                    {existingFacility.currency_code} {available!.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Tranches Used</span>
                  <span className="font-medium">
                    {existingFacility.disbursed_tranches} / {existingFacility.drawdown_tranches}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Expires</span>
                  <span className="font-medium">
                    {format(
                      addMonths(parseFineractDateField(existingFacility.created_date), existingFacility.tenor_months),
                      "MMM yyyy"
                    )}
                  </span>
                </div>
              </div>
              {exceedsBalance && (
                <div className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Loan amount exceeds the facility's available balance
                </div>
              )}
            </>
          ) : checked ? (
            <>
              <p className="text-sm text-muted-foreground">
                No active facility found. Fill in the details below to create one alongside this loan.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cf-limit" className="text-xs">
                    Credit Limit ({currencyCode})
                  </Label>
                  <Input
                    id="cf-limit"
                    type="text"
                    inputMode="numeric"
                    placeholder="100,000"
                    value={creditLimitDisplay}
                    onChange={handleCreditLimitChange}
                    onBlur={() => setTouched(true)}
                    className={cn(showError && "border-destructive focus-visible:ring-destructive")}
                  />
                  {showError ? (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {limitError}
                    </p>
                  ) : loanAmount > 0 && creditLimitRaw > 0 && creditLimitRaw >= loanAmount ? (
                    <p className="text-xs text-muted-foreground">
                      {currencyCode} {(creditLimitRaw - loanAmount).toLocaleString()} headroom above principal
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cf-tenor" className="text-xs">
                    Tenor (months)
                  </Label>
                  <Input
                    id="cf-tenor"
                    type="number"
                    min={1}
                    placeholder="12"
                    value={tenorMonths}
                    onChange={(e) => setTenorMonths(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cf-tranches" className="text-xs">
                    Max Tranches
                  </Label>
                  <Input
                    id="cf-tranches"
                    type="number"
                    min={1}
                    placeholder="5"
                    value={drawdownTranches}
                    onChange={(e) => setDrawdownTranches(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
