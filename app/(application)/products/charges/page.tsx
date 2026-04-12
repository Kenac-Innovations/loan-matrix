"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  calcTypeFromFineractCode,
  formatChargeProductEnumLabel,
  paymentModeFromFineractCode,
  timeTypeFromFineractCode,
} from "@/shared/types/charge-product";
import { ChargeProductsSkeleton } from "@/components/skeletons/charge-products-skeleton";

interface FineractOption {
  id: number;
  code: string;
  value?: string;
  description?: string;
}

interface CurrencyOption {
  code: string;
  name?: string;
  displayLabel?: string;
}

interface ChargeTemplate {
  currencyOptions?: CurrencyOption[];
  chargeAppliesToOptions?: FineractOption[];
  chargeTimeTypeOptions?: FineractOption[];
  chargeCalculationTypeOptions?: FineractOption[];
  chargePaymentModeOptions?: FineractOption[];
  chargePaymetModeOptions?: FineractOption[];
  loanChargeTimeTypeOptions?: FineractOption[];
  loanChargeCalculationTypeOptions?: FineractOption[];
  savingsChargeTimeTypeOptions?: FineractOption[];
  savingsChargeCalculationTypeOptions?: FineractOption[];
  clientChargeTimeTypeOptions?: FineractOption[];
  clientChargeCalculationTypeOptions?: FineractOption[];
}

interface ChargeProductRecord {
  id: string;
  name: string;
  amount: string;
  currencyCode: string;
  type: string;
  chargeTimeType: string;
  chargeCalculationType: string;
  chargePaymentMode: string;
  fineractChargeTimeType: string | null;
  syncStatus: "PENDING" | "SYNCED" | "FAILED";
  syncError: string | null;
  fineractChargeId: number | null;
  active: boolean;
  createdAt: string;
}

const INVOICE_INCOME_CHARGE_NAME = "INVOICE_INCOME";
const INVOICE_INCOME_CHARGE_DISPLAY_NAME = "Invoice Income";

const emptyForm = {
  name: "",
  amount: "",
  currencyCode: "",
  type: "LOAN",
  chargeTimeType: "",
  chargeCalculationType: "",
  chargePaymentMode: "",
  active: true,
};

function optionLabel(option: { description?: string; value?: string; code?: string }) {
  return option.description || option.value || option.code || "";
}

function dedupeByValue<T extends { value: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.value)) continue;
    seen.add(item.value);
    result.push(item);
  }
  return result;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatChargeDisplayName(name: string) {
  return name === INVOICE_INCOME_CHARGE_NAME
    ? INVOICE_INCOME_CHARGE_DISPLAY_NAME
    : name;
}

export default function ChargeProductsPage() {
  const [template, setTemplate] = useState<ChargeTemplate | null>(null);
  const [records, setRecords] = useState<ChargeProductRecord[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingRecord, setEditingRecord] = useState<ChargeProductRecord | null>(
    null
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoadError(null);
      setIsLoading(true);
      const [templateRes, recordsRes] = await Promise.all([
        fetch("/api/fineract/charges/template"),
        fetch("/api/charge-products"),
      ]);

      const templateBody = await templateRes.json();
      const recordsBody = await recordsRes.json();

      if (!templateRes.ok) {
        throw new Error(templateBody?.error || "Failed to load charge template");
      }
      if (!recordsRes.ok) {
        throw new Error(recordsBody?.error || "Failed to load charges");
      }

      setTemplate(templateBody);
      setRecords(recordsBody?.data || []);
    } catch (err) {
      console.error("Error loading charge data:", err);
      setLoadError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currencyOptions = useMemo(() => {
    const options = (template?.currencyOptions || [])
      .map((currency) => ({
        value: currency.code,
        label: currency.displayLabel || currency.name || currency.code,
      }))
      .filter((option) => option.value);

    return dedupeByValue(options);
  }, [template]);

  const chargeTimeOptions = useMemo(() => {
    if (!template) return [];

    const sourceOptions: FineractOption[] =
      template.loanChargeTimeTypeOptions?.length
        ? template.loanChargeTimeTypeOptions
        : template.chargeTimeTypeOptions || [];

    const mapped = sourceOptions
      .map((option) => {
        const value = timeTypeFromFineractCode(option.code);
        if (!value) return null;
        return {
          value,
          label: optionLabel(option) || formatChargeProductEnumLabel(value),
        };
      })
      .filter((item): item is { value: string; label: string } => item !== null);

    return dedupeByValue(mapped);
  }, [template]);

  const chargeCalculationOptions = useMemo(() => {
    if (!template) return [];

    const sourceOptions: FineractOption[] =
      template.loanChargeCalculationTypeOptions?.length
        ? template.loanChargeCalculationTypeOptions
        : template.chargeCalculationTypeOptions || [];

    const mapped = sourceOptions
      .map((option) => {
        const value = calcTypeFromFineractCode(option.code);
        if (!value) return null;
        return {
          value,
          label: optionLabel(option) || formatChargeProductEnumLabel(value),
        };
      })
      .filter((item): item is { value: string; label: string } => item !== null);

    return dedupeByValue(mapped);
  }, [template]);

  const chargePaymentModeOptions = useMemo(() => {
    const sourceOptions =
      template?.chargePaymentModeOptions?.length
        ? template.chargePaymentModeOptions
        : template?.chargePaymetModeOptions || [];

    const mapped = sourceOptions
      .map((option) => {
        const value = paymentModeFromFineractCode(option.code);
        if (!value) return null;
        return {
          value,
          label: optionLabel(option) || formatChargeProductEnumLabel(value),
        };
      })
      .filter((item): item is { value: string; label: string } => item !== null);

    return dedupeByValue(mapped);
  }, [template]);

  useEffect(() => {
    if (!form.chargeTimeType) return;
    const exists = chargeTimeOptions.some((option) => option.value === form.chargeTimeType);
    if (!exists) {
      setForm((prev) => ({ ...prev, chargeTimeType: "" }));
    }
  }, [chargeTimeOptions, form.chargeTimeType]);

  useEffect(() => {
    if (!form.chargeCalculationType) return;
    const exists = chargeCalculationOptions.some(
      (option) => option.value === form.chargeCalculationType
    );
    if (!exists) {
      setForm((prev) => ({ ...prev, chargeCalculationType: "" }));
    }
  }, [chargeCalculationOptions, form.chargeCalculationType]);

  useEffect(() => {
    if (currencyOptions.length !== 1 || form.currencyCode) return;
    setForm((prev) => ({ ...prev, currencyCode: currencyOptions[0].value }));
  }, [currencyOptions, form.currencyCode]);

  useEffect(() => {
    if (chargePaymentModeOptions.length !== 1 || form.chargePaymentMode) return;
    setForm((prev) => ({
      ...prev,
      chargePaymentMode: chargePaymentModeOptions[0].value,
    }));
  }, [chargePaymentModeOptions, form.chargePaymentMode]);

  const handleCreateDialogOpenChange = (open: boolean) => {
    setIsCreateModalOpen(open);
    if (!open) {
      setForm(emptyForm);
      setEditingRecord(null);
      setFormError(null);
    }
  };

  const handleEdit = (record: ChargeProductRecord) => {
    setEditingRecord(record);
    setForm({
      name: record.name,
      amount: record.amount,
      currencyCode: record.currencyCode,
      type: record.type,
      chargeTimeType: record.chargeTimeType,
      chargeCalculationType: record.chargeCalculationType,
      chargePaymentMode: record.chargePaymentMode,
      active: record.active ?? true,
    });
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!form.currencyCode) {
      setFormError("Please select currency.");
      return;
    }

    if (!form.chargeTimeType) {
      setFormError("Please select charge time type.");
      return;
    }

    if (!form.chargeCalculationType) {
      setFormError("Please select charge calculation type.");
      return;
    }

    if (!form.chargePaymentMode) {
      setFormError("Please select charge payment mode.");
      return;
    }

    try {
      setIsSubmitting(true);
      const isEditing = Boolean(editingRecord);
      const endpoint = isEditing
        ? `/api/charge-products/${editingRecord?.id}`
        : "/api/charge-products";

      const response = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          amount: form.amount,
          currencyCode: form.currencyCode,
          type: form.type,
          chargeTimeType: form.chargeTimeType,
          chargeCalculationType: form.chargeCalculationType,
          chargePaymentMode: form.chargePaymentMode,
          active: form.active,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        const message = body?.error || "Failed to save charge";
        throw new Error(message);
      }

      await loadData();
      handleCreateDialogOpenChange(false);
    } catch (err) {
      console.error("Error saving charge:", err);
      setFormError(err instanceof Error ? err.message : "Failed to save charge");
      await loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !template && records.length === 0 && !loadError) {
    return <ChargeProductsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Charges</h1>
          <p className="mt-1 text-muted-foreground">
            Manage local charge definitions and their Fineract placeholders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadData}
            disabled={isLoading || isSubmitting}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button onClick={() => handleCreateDialogOpenChange(true)} disabled={isLoading}>
            <Plus className="mr-2 h-4 w-4" />
            Create Charge
          </Button>
        </div>
      </div>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Charges</CardTitle>
          <CardDescription>
            Local values remain the source of truth. Fineract charge records are placeholders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading charges...
            </div>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground">No charges yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Charge Time Type</TableHead>
                  <TableHead>Charge Calculation Type</TableHead>
                  <TableHead>Charge Payment Mode</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {formatChargeDisplayName(record.name)}
                    </TableCell>
                    <TableCell>
                      {record.currencyCode} {record.amount}
                    </TableCell>
                    <TableCell>
                      {formatChargeProductEnumLabel(record.chargeTimeType)}
                    </TableCell>
                    <TableCell>
                      {formatChargeProductEnumLabel(record.chargeCalculationType)}
                    </TableCell>
                    <TableCell>
                      {formatChargeProductEnumLabel(record.chargePaymentMode)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.active ? "default" : "secondary"}>
                        {record.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          record.syncStatus === "SYNCED"
                            ? "default"
                            : record.syncStatus === "FAILED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {record.syncStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(record.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(record)}
                        disabled={isSubmitting}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateModalOpen} onOpenChange={handleCreateDialogOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRecord ? "Edit Charge" : "Create Charge"}</DialogTitle>
            <DialogDescription>
              {editingRecord
                ? "Update the local charge definition and synchronize changes to Fineract."
                : "Charge time type has no default and must be selected. If you choose Disbursement, the Fineract placeholder is saved as Specified due date with amount 1."}
            </DialogDescription>
          </DialogHeader>

          <form className="mx-auto w-full max-w-md space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Charge Name</Label>
                <Input
                  id="name"
                  placeholder="Processing Fee"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount (Local Source Value)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="250"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, amount: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={form.currencyCode}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, currencyCode: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Charge Time Type</Label>
                <Select
                  value={form.chargeTimeType}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, chargeTimeType: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select charge time type" />
                  </SelectTrigger>
                  <SelectContent>
                    {chargeTimeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Charge Calculation Type</Label>
                <Select
                  value={form.chargeCalculationType}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, chargeCalculationType: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select charge calculation type" />
                  </SelectTrigger>
                  <SelectContent>
                    {chargeCalculationOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Charge Payment Mode</Label>
                <Select
                  value={form.chargePaymentMode}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, chargePaymentMode: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select charge payment mode" />
                  </SelectTrigger>
                  <SelectContent>
                    {chargePaymentModeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-1">
                  <Label htmlFor="active-charge">Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Inactive charges stay in history but won&apos;t be used in active charge flows.
                  </p>
                </div>
                <Switch
                  id="active-charge"
                  checked={form.active}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, active: checked }))
                  }
                />
              </div>
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCreateDialogOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isLoading}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingRecord ? "Update Charge" : "Save Charge"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
