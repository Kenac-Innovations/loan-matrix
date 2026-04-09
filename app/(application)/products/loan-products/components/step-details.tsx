"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LoanProductFormData, LoanProductTemplate } from "@/shared/types/loan-product";

interface StepDetailsProps {
  form: LoanProductFormData;
  template: LoanProductTemplate;
  onChange: (updates: Partial<LoanProductFormData>) => void;
}

export function StepDetails({ form, template, onChange }: StepDetailsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Product Details</h2>
        <p className="text-sm text-muted-foreground">
          Basic information about the loan product.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">
            Product Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="e.g. Personal Loan"
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="shortName">
            Short Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="shortName"
            placeholder="e.g. PL"
            maxLength={4}
            value={form.shortName}
            onChange={(e) => onChange({ shortName: e.target.value })}
            required
          />
          <p className="text-xs text-muted-foreground">Max 4 characters</p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Describe the loan product..."
            rows={3}
            value={form.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="externalId">External ID</Label>
          <Input
            id="externalId"
            placeholder="Optional external reference"
            value={form.externalId}
            onChange={(e) => onChange({ externalId: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fundId">Fund</Label>
          <Select
            value={form.fundId === "" ? "__none__" : String(form.fundId)}
            onValueChange={(v) => onChange({ fundId: v === "__none__" ? "" : Number(v) })}
          >
            <SelectTrigger id="fundId">
              <SelectValue placeholder="Select fund (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {(template.fundOptions ?? []).map((fund) => (
                <SelectItem key={fund.id} value={String(fund.id)}>
                  {fund.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={form.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="closeDate">Close Date</Label>
          <Input
            id="closeDate"
            type="date"
            value={form.closeDate}
            onChange={(e) => onChange({ closeDate: e.target.value })}
          />
        </div>
      </div>

      <div
        className="flex cursor-pointer select-none items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/40"
        onClick={() => onChange({ includeInBorrowerCycle: !form.includeInBorrowerCycle })}
      >
        <div className="space-y-1">
          <Label htmlFor="includeInBorrowerCycle" className="pointer-events-none text-sm font-medium">
            Include in Borrower Cycle
          </Label>
          <p className="text-xs text-muted-foreground">
            Track the number of times a client has taken this loan product.
          </p>
        </div>
        <Switch
          id="includeInBorrowerCycle"
          checked={form.includeInBorrowerCycle}
          onCheckedChange={(v) => onChange({ includeInBorrowerCycle: v })}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div
        className={`flex cursor-pointer select-none items-center justify-between rounded-lg border-2 p-4 transition-colors hover:bg-muted/40 ${
          form.isInvoiceDiscounting
            ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/20"
            : "border-border"
        }`}
        onClick={() => onChange({ isInvoiceDiscounting: !form.isInvoiceDiscounting })}
      >
        <div className="space-y-1">
          <Label htmlFor="isInvoiceDiscounting" className="pointer-events-none text-sm font-medium">
            Invoice Discounting Product
          </Label>
          <p className="text-xs text-muted-foreground">
            Mark this as an invoice discounting loan product. Interest rate will be locked
            to 0% — discounting fees are handled separately as charges.
          </p>
        </div>
        <Switch
          id="isInvoiceDiscounting"
          checked={form.isInvoiceDiscounting}
          onCheckedChange={(v) => onChange({ isInvoiceDiscounting: v })}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}
