"use client";

import { useState, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCurrency } from "@/contexts/currency-context";
import { getSavingsProductTemplate } from "@/app/actions/rcf-actions";
import type { SavingsProductTemplate } from "@/app/actions/rcf-actions";

const schema = z.object({
  creditLimit: z.string().min(1, "Credit limit is required"),
  savingsProductId: z.string().min(1, "Savings product is required"),
  interestRate: z.string().optional(),
  tenorMonths: z.string().min(1, "Tenor is required"),
  maxDrawdowns: z.string().min(1, "Max drawdowns is required"),
});

type FormValues = z.infer<typeof schema>;

interface SavingsProduct {
  id: number;
  name: string;
}

interface RcfFacilityTermsFormProps {
  leadId: string;
  fineractClientId: number | null;
  onComplete: () => void;
  onBack: () => void;
}

function formatDisplayAmount(raw: string): string {
  const digits = raw.replace(/[^0-9.]/g, "");
  const parts = digits.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

function stripFormatting(display: string): string {
  return display.replace(/,/g, "");
}

export function RcfFacilityTermsForm({
  leadId,
  fineractClientId,
  onComplete,
  onBack,
}: RcfFacilityTermsFormProps) {
  const { currencySymbol } = useCurrency();
  const [savingsProducts, setSavingsProducts] = useState<SavingsProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productTemplate, setProductTemplate] = useState<SavingsProductTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [displayAmount, setDisplayAmount] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      creditLimit: "",
      savingsProductId: "",
      interestRate: "",
      tenorMonths: "",
      maxDrawdowns: "10",
    },
  });

  // Load existing saved data
  useEffect(() => {
    if (!leadId) return;
    fetch(`/api/leads/${leadId}/facility-terms`)
      .then((r) => r.json())
      .then((data) => {
        if (data.creditLimit) {
          setValue("creditLimit", String(data.creditLimit));
          setDisplayAmount(formatDisplayAmount(String(data.creditLimit)));
        }
        if (data.savingsProductId) setValue("savingsProductId", String(data.savingsProductId));
        if (data.interestRate) setValue("interestRate", String(data.interestRate));
        if (data.tenorMonths) setValue("tenorMonths", String(data.tenorMonths));
        if (data.maxDrawdowns) setValue("maxDrawdowns", String(data.maxDrawdowns));
      })
      .catch(() => {});
  }, [leadId, setValue]);

  // Load savings products list from template endpoint
  useEffect(() => {
    setLoadingProducts(true);
    fetch(`/api/leads/template`)
      .then((r) => r.json())
      .then((d) => setSavingsProducts(d.data?.savingsProducts ?? []))
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, []);

  const selectedProductId = watch("savingsProductId");

  // Fetch product template when product + clientId are both available
  useEffect(() => {
    if (!selectedProductId || !fineractClientId) return;

    startTransition(async () => {
      try {
        const template = await getSavingsProductTemplate(
          fineractClientId,
          parseInt(selectedProductId, 10)
        );
        setProductTemplate(template);

        // Prefill interest rate from overdraft rate (charged on drawdowns)
        const rate = template.nominalAnnualInterestRateOverdraft || template.nominalAnnualInterestRate;
        if (rate) setValue("interestRate", String(rate));

        // Prefill credit limit from overdraft limit
        if (template.overdraftLimit && template.overdraftLimit > 0) {
          const raw = String(template.overdraftLimit);
          setValue("creditLimit", raw);
          setDisplayAmount(formatDisplayAmount(raw));
        }
      } catch {
        // silently ignore — template is informational
      }
    });
  }, [selectedProductId, fineractClientId, setValue]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/facility-terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditLimit: parseFloat(stripFormatting(values.creditLimit)),
          savingsProductId: parseInt(values.savingsProductId, 10),
          interestRate: values.interestRate ? parseFloat(values.interestRate) : undefined,
          tenorMonths: parseInt(values.tenorMonths, 10),
          maxDrawdowns: parseInt(values.maxDrawdowns, 10),
          disbursementDate: new Date().toISOString().split("T")[0],
        }),
      });
      if (!res.ok) throw new Error("Failed to save facility terms");
      onComplete();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const loadingTemplate = isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Savings Product */}
        <div className="space-y-2">
          <Label htmlFor="savingsProductId">
            Product <span className="text-red-500">*</span>
          </Label>
          <Select
            onValueChange={(val) => {
              setValue("savingsProductId", val);
              setProductTemplate(null);
            }}
            defaultValue=""
          >
            <SelectTrigger id="savingsProductId">
              <SelectValue placeholder={loadingProducts ? "Loading..." : "Select product"} />
            </SelectTrigger>
            <SelectContent>
              {savingsProducts.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.savingsProductId && (
            <p className="text-xs text-red-500">{errors.savingsProductId.message}</p>
          )}
          <p className="text-xs text-muted-foreground">Fineract savings product backing this facility</p>
        </div>

        {/* Credit Limit */}
        <div className="space-y-2">
          <Label htmlFor="creditLimit">
            Credit Limit ({currencySymbol}) <span className="text-red-500">*</span>
          </Label>
          <Input
            id="creditLimit"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={displayAmount}
            onChange={(e) => {
              const raw = stripFormatting(e.target.value);
              setDisplayAmount(formatDisplayAmount(e.target.value));
              setValue("creditLimit", raw, { shouldValidate: true });
            }}
          />
          {errors.creditLimit && (
            <p className="text-xs text-red-500">{errors.creditLimit.message}</p>
          )}
          <p className="text-xs text-muted-foreground">Total revolving credit limit for this facility</p>
        </div>

        {/* Interest Rate */}
        <div className="space-y-2">
          <Label htmlFor="interestRate">
            Interest Rate (% p.a.)
            {loadingTemplate && <Loader2 className="inline ml-1 h-3 w-3 animate-spin" />}
          </Label>
          <Input
            id="interestRate"
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register("interestRate")}
          />
          <p className="text-xs text-muted-foreground">
            Nominal annual rate charged on drawdowns
          </p>
        </div>

        {/* Tenor */}
        <div className="space-y-2">
          <Label htmlFor="tenorMonths">
            Tenor (months) <span className="text-red-500">*</span>
          </Label>
          <Input
            id="tenorMonths"
            type="number"
            min="1"
            placeholder="12"
            {...register("tenorMonths")}
          />
          {errors.tenorMonths && (
            <p className="text-xs text-red-500">{errors.tenorMonths.message}</p>
          )}
          <p className="text-xs text-muted-foreground">Facility duration in months</p>
        </div>

        {/* Max Drawdowns */}
        <div className="space-y-2">
          <Label htmlFor="maxDrawdowns">
            Max Drawdowns <span className="text-red-500">*</span>
          </Label>
          <Input
            id="maxDrawdowns"
            type="number"
            min="1"
            max="100"
            {...register("maxDrawdowns")}
          />
          {errors.maxDrawdowns && (
            <p className="text-xs text-red-500">{errors.maxDrawdowns.message}</p>
          )}
          <p className="text-xs text-muted-foreground">Maximum drawdown tranches allowed (default 10)</p>
        </div>

      </div>

      {!fineractClientId && selectedProductId && (
        <p className="text-xs text-amber-600">
          Client must be registered in Fineract before product details can load.
        </p>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save & Continue
        </Button>
      </div>
    </form>
  );
}
