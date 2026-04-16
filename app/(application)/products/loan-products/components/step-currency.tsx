"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LoanProductFormData, LoanProductTemplate } from "@/shared/types/loan-product";

interface StepCurrencyProps {
  form: LoanProductFormData;
  template: LoanProductTemplate;
  onChange: (updates: Partial<LoanProductFormData>) => void;
}

export function StepCurrency({ form, template, onChange }: StepCurrencyProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Currency</h2>
        <p className="text-sm text-muted-foreground">
          Define the currency and decimal precision for this loan product.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="currencyCode">
            Currency <span className="text-destructive">*</span>
          </Label>
          <Select
            value={form.currencyCode}
            onValueChange={(v) => onChange({ currencyCode: v })}
          >
            <SelectTrigger id="currencyCode">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {(template.currencyOptions ?? []).map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.displayLabel || c.name || c.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="digitsAfterDecimal">
            Decimal Places <span className="text-destructive">*</span>
          </Label>
          <Input
            id="digitsAfterDecimal"
            type="number"
            min={0}
            max={6}
            placeholder="2"
            value={form.digitsAfterDecimal}
            onChange={(e) =>
              onChange({
                digitsAfterDecimal: e.target.value === "" ? "" : Number(e.target.value),
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            Number of decimal places supported (0–6)
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inMultiplesOf">Currency in Multiples Of</Label>
          <Input
            id="inMultiplesOf"
            type="number"
            min={0}
            placeholder="e.g. 100"
            value={form.inMultiplesOf}
            onChange={(e) =>
              onChange({
                inMultiplesOf: e.target.value === "" ? "" : Number(e.target.value),
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            Rounds currency amounts to the nearest multiple
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="installmentAmountInMultiplesOf">
            Installment Amount in Multiples Of
          </Label>
          <Input
            id="installmentAmountInMultiplesOf"
            type="number"
            min={0}
            placeholder="e.g. 10"
            value={form.installmentAmountInMultiplesOf}
            onChange={(e) =>
              onChange({
                installmentAmountInMultiplesOf:
                  e.target.value === "" ? "" : Number(e.target.value),
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            Rounds installment amounts to the nearest multiple
          </p>
        </div>
      </div>
    </div>
  );
}
