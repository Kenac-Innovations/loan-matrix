"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { LoanProductFormData, LoanProductTemplate } from "@/shared/types/loan-product";

interface StepInterestRefundProps {
  form: LoanProductFormData;
  template: LoanProductTemplate;
  onChange: (updates: Partial<LoanProductFormData>) => void;
}

export function StepInterestRefund({ form, template, onChange }: StepInterestRefundProps) {
  const options = template.supportedInterestRefundTypes ?? [];

  const toggle = (id: number) => {
    const current = form.supportedInterestRefundTypes;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange({ supportedInterestRefundTypes: next });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Interest Refund</h2>
        <p className="text-sm text-muted-foreground">
          Select which transaction types are eligible for interest refunds on this product.
        </p>
      </div>

      {options.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No interest refund types are configured in Fineract for this product.
        </div>
      ) : (
        <div className="space-y-3">
          {options.map((opt) => (
            <div
              key={opt.id}
              className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors"
            >
              <Checkbox
                id={`refund-${opt.id}`}
                checked={form.supportedInterestRefundTypes.includes(opt.id)}
                onCheckedChange={() => toggle(opt.id)}
              />
              <Label htmlFor={`refund-${opt.id}`} className="flex-1 cursor-pointer">
                <span className="font-medium">{opt.value}</span>
                {opt.description && (
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {opt.description}
                  </span>
                )}
              </Label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
