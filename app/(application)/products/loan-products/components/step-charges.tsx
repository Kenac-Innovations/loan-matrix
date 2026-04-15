"use client";

import { useState, useMemo } from "react";
import { Check, Search, ShieldAlert, Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  FineractCharge,
  LoanProductChargeEntry,
  LoanProductFormData,
  LoanProductTemplate,
} from "@/shared/types/loan-product";

interface StepChargesProps {
  form: LoanProductFormData;
  template: LoanProductTemplate;
  onChange: (updates: Partial<LoanProductFormData>) => void;
}

function ChargeCard({
  charge,
  selected,
  onToggle,
}: {
  charge: FineractCharge;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "group relative flex w-full flex-col gap-2 rounded-xl border-2 p-4 text-left transition-all duration-150",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
      )}
    >
      {/* Selected check */}
      <span
        className={cn(
          "absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30 bg-transparent group-hover:border-primary/50"
        )}
      >
        {selected && <Check className="h-3 w-3 stroke-[3]" />}
      </span>

      {/* Icon + name */}
      <div className="flex items-start gap-2 pr-7">
        <span
          className={cn(
            "mt-0.5 rounded-md p-1.5",
            charge.penalty
              ? "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
              : "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
          )}
        >
          {charge.penalty ? (
            <ShieldAlert className="h-3.5 w-3.5" />
          ) : (
            <Tag className="h-3.5 w-3.5" />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{charge.name}</p>
          {charge.penalty && (
            <Badge
              variant="secondary"
              className="mt-0.5 border-orange-200 bg-orange-100 text-[10px] text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300"
            >
              Penalty
            </Badge>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Calculation
          </p>
          <p className="truncate text-xs text-foreground">
            {charge.chargeCalculationType?.value ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Time
          </p>
          <p className="truncate text-xs text-foreground">
            {charge.chargeTimeType?.value ?? "—"}
          </p>
        </div>
        <div className="col-span-2 mt-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Amount
          </p>
          <p className="text-xs font-medium text-foreground">
            {charge.amount.toLocaleString()}
          </p>
        </div>
      </div>
    </button>
  );
}

function ChargeSection({
  title,
  charges,
  selectedIds,
  onToggle,
}: {
  title: string;
  charges: FineractCharge[];
  selectedIds: Set<number>;
  onToggle: (charge: FineractCharge) => void;
}) {
  if (charges.length === 0) return null;

  const selectedCount = charges.filter((c) => selectedIds.has(c.id)).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {selectedCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {selectedCount} selected
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {charges.map((charge) => (
          <ChargeCard
            key={charge.id}
            charge={charge}
            selected={selectedIds.has(charge.id)}
            onToggle={() => onToggle(charge)}
          />
        ))}
      </div>
    </div>
  );
}

export function StepCharges({ form, template, onChange }: StepChargesProps) {
  const [search, setSearch] = useState("");

  const allCharges: FineractCharge[] = useMemo(
    () => [...(template.chargeOptions ?? []), ...(template.penaltyOptions ?? [])],
    [template]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCharges;
    return allCharges.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.chargeCalculationType?.value?.toLowerCase().includes(q) ||
        c.chargeTimeType?.value?.toLowerCase().includes(q)
    );
  }, [allCharges, search]);

  const regularCharges = filtered.filter((c) => !c.penalty);
  const penalties      = filtered.filter((c) => c.penalty);

  const selectedIds = useMemo(() => new Set(form.charges.map((c) => c.id)), [form.charges]);

  const handleToggle = (charge: FineractCharge) => {
    if (selectedIds.has(charge.id)) {
      onChange({ charges: form.charges.filter((c) => c.id !== charge.id) });
    } else {
      const entry: LoanProductChargeEntry = {
        id: charge.id,
        name: charge.name,
        amount: charge.amount,
        chargeCalculationType: charge.chargeCalculationType,
        chargeTimeType: charge.chargeTimeType,
        penalty: charge.penalty,
      };
      onChange({ charges: [...form.charges, entry] });
    }
  };

  const totalSelected = form.charges.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Charges</h2>
          <p className="text-sm text-muted-foreground">
            Click any card to add or remove it from this loan product.
          </p>
        </div>
        {totalSelected > 0 && (
          <Badge className="shrink-0 text-sm">
            {totalSelected} charge{totalSelected !== 1 ? "s" : ""} selected
          </Badge>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search charges by name, calculation type, or time type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          No charges match &ldquo;{search}&rdquo;
        </div>
      )}

      {allCharges.length === 0 && !search && (
        <div className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          No charges are configured in Fineract yet.
        </div>
      )}

      {/* Cards */}
      <div className="space-y-6">
        <ChargeSection
          title="Charges"
          charges={regularCharges}
          selectedIds={selectedIds}
          onToggle={handleToggle}
        />
        <ChargeSection
          title="Penalties"
          charges={penalties}
          selectedIds={selectedIds}
          onToggle={handleToggle}
        />
      </div>
    </div>
  );
}
