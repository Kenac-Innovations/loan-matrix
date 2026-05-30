"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ChargeProductsSkeleton } from "@/components/skeletons/charge-products-skeleton";
import {
  getChargeCalculationOptionsForType,
  getChargePaymentModeOptions,
  getChargeTimeOptionsForType,
} from "@/lib/charge-product-fineract";
import { typeFromFineractCode } from "@/shared/types/charge-product";

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
  feeFrequencyOptions?: FineractOption[];
  loanChargeTimeTypeOptions?: FineractOption[];
  loanChargeCalculationTypeOptions?: FineractOption[];
  savingsChargeTimeTypeOptions?: FineractOption[];
  savingsChargeCalculationTypeOptions?: FineractOption[];
  clientChargeTimeTypeOptions?: FineractOption[];
  clientChargeCalculationTypeOptions?: FineractOption[];
  shareChargeTimeTypeOptions?: FineractOption[];
  shareChargeCalculationTypeOptions?: FineractOption[];
}

interface FineractChargeRecord {
  id: number;
  name: string;
  amount?: number | string | null;
  active?: boolean;
  minCap?: number | string | null;
  maxCap?: number | string | null;
  feeInterval?: number | string | null;
  feeOnMonthDay?: string | null;
  penalty?: boolean;
  currency?: {
    code?: string;
  };
  chargeAppliesTo?: FineractOption;
  chargeTimeType?: FineractOption;
  chargeCalculationType?: FineractOption;
  chargePaymentMode?: FineractOption;
  feeFrequency?: FineractOption;
}

type FormState = {
  chargeAppliesTo: string;
  name: string;
  amount: string;
  currencyCode: string;
  chargeTimeType: string;
  chargeCalculationType: string;
  chargePaymentMode: string;
  penalty: boolean;
  minCap: string;
  maxCap: string;
  feeInterval: string;
  feeFrequency: string;
  feeOnMonthDay: string;
  addFeeFrequency: boolean;
  active: boolean;
};

const INVOICE_INCOME_CHARGE_NAME = "DISCOUNT_FACTOR";
const INVOICE_INCOME_CHARGE_DISPLAY_NAME = "Discount Factor";

const emptyForm: FormState = {
  chargeAppliesTo: "",
  name: "",
  amount: "",
  currencyCode: "",
  chargeTimeType: "",
  chargeCalculationType: "",
  chargePaymentMode: "",
  penalty: false,
  minCap: "",
  maxCap: "",
  feeInterval: "",
  feeFrequency: "",
  feeOnMonthDay: "",
  addFeeFrequency: false,
  active: false,
};

const LOAN_TIME_TYPE_TRANCHE_DISBURSEMENT =
  "chargeTimeType.tranchedisbursement";
const LOAN_CALC_PERCENT_OF_AMOUNT_AND_INTEREST =
  "chargeCalculationType.percent.of.amount.and.interest";
const LOAN_CALC_PERCENT_OF_INTEREST =
  "chargeCalculationType.percent.of.interest";
const LOAN_CALC_PERCENT_OF_DISBURSEMENT_AMOUNT =
  "chargeCalculationType.percent.of.disbursement.amount";
const CALC_PERCENT_OF_AMOUNT = "chargeCalculationType.percent.of.amount";
const SAVINGS_TIME_TYPE_WITHDRAWAL_FEE = "chargeTimeType.withdrawalFee";
const SAVINGS_TIME_TYPE_ANNUAL_FEE = "chargeTimeType.annualFee";
const SAVINGS_TIME_TYPE_SAVINGS_NO_ACTIVITY_FEE =
  "chargeTimeType.savingsNoActivityFee";
const SHARES_TIME_TYPE_SHARE_PURCHASE = "chargeTimeType.sharespurchase";
const SHARES_TIME_TYPE_SHARE_REDEEM = "chargeTimeType.sharesredeem";
const TIME_TYPE_SPECIFIED_DUE_DATE = "chargeTimeType.specifiedDueDate";
const TIME_TYPE_MONTHLY_FEE = "chargeTimeType.monthlyFee";
const TIME_TYPE_WEEKLY_FEE = "chargeTimeType.weeklyFee";
const TIME_TYPE_OVERDUE_INSTALLMENT = "chargeTimeType.overdueInstallment";

function RequiredAsterisk() {
  return <span className="ml-1 text-destructive">*</span>;
}

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

function formatChargeDisplayName(name: string) {
  return name === INVOICE_INCOME_CHARGE_NAME
    ? INVOICE_INCOME_CHARGE_DISPLAY_NAME
    : name;
}

function extractChargeList(payload: unknown): FineractChargeRecord[] {
  if (Array.isArray(payload)) {
    return payload as FineractChargeRecord[];
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    Array.isArray((payload as { pageItems?: unknown[] }).pageItems)
  ) {
    return (payload as { pageItems: FineractChargeRecord[] }).pageItems;
  }

  return [];
}

function toAmountString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return "0";
}

function toOptionalAmountString(value: unknown) {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return "";
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";

  const parsed = new Date(`${value} 2000`);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, "0"),
    String(parsed.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatMonthDayForFineract(value: string) {
  if (!value) return "";

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleString("en", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export default function ChargeProductsPage() {
  const [template, setTemplate] = useState<ChargeTemplate | null>(null);
  const [records, setRecords] = useState<FineractChargeRecord[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const previousChargeTimeTypeCodeRef = useRef<string | null>(null);

  const loadData = async () => {
    try {
      setLoadError(null);
      setIsLoading(true);
      const [templateRes, recordsRes] = await Promise.all([
        fetch("/api/fineract/charges/template"),
        fetch("/api/fineract/charges"),
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
      setRecords(
        extractChargeList(recordsBody).sort((left, right) =>
          left.name.localeCompare(right.name)
        )
      );
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

  const appliesToOptions = useMemo(() => {
    const options = (template?.chargeAppliesToOptions || [])
      .map((option) => ({
        value: String(option.id),
        label: optionLabel(option),
        code: option.code,
      }))
      .filter((option) => option.value && option.code);

    return dedupeByValue(options);
  }, [template]);

  const selectedAppliesToOption = useMemo(
    () =>
      appliesToOptions.find((option) => option.value === form.chargeAppliesTo) || null,
    [appliesToOptions, form.chargeAppliesTo]
  );

  const selectedChargeType = useMemo(() => {
    return selectedAppliesToOption
      ? typeFromFineractCode(selectedAppliesToOption.code)
      : null;
  }, [selectedAppliesToOption]);

  const loanAppliesToOption = useMemo(
    () => appliesToOptions.find((option) => typeFromFineractCode(option.code) === "LOAN") || null,
    [appliesToOptions]
  );

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
    if (!template || !selectedChargeType) return [];

    return getChargeTimeOptionsForType(template, selectedChargeType)
      .map((option) => ({
        value: String(option.id),
        label: optionLabel(option),
        code: option.code,
      }))
      .filter((item) => item.value);
  }, [selectedChargeType, template]);

  const chargeCalculationOptions = useMemo(() => {
    if (!template || !selectedChargeType) return [];

    const selectedChargeTimeOption =
      chargeTimeOptions.find((option) => option.value === form.chargeTimeType) || null;

    return getChargeCalculationOptionsForType(template, selectedChargeType)
      .filter((option) => {
        if (selectedChargeType === "LOAN") {
          const isTrancheDisbursementTime =
            selectedChargeTimeOption?.code === LOAN_TIME_TYPE_TRANCHE_DISBURSEMENT;

          if (isTrancheDisbursementTime) {
            return ![
              LOAN_CALC_PERCENT_OF_AMOUNT_AND_INTEREST,
              LOAN_CALC_PERCENT_OF_INTEREST,
            ].includes(option.code);
          }

          return option.code !== LOAN_CALC_PERCENT_OF_DISBURSEMENT_AMOUNT;
        }

        if (selectedChargeType === "SAVINGS") {
          if (option.code !== CALC_PERCENT_OF_AMOUNT) {
            return true;
          }

          return [
            SAVINGS_TIME_TYPE_WITHDRAWAL_FEE,
            SAVINGS_TIME_TYPE_ANNUAL_FEE,
            SAVINGS_TIME_TYPE_SAVINGS_NO_ACTIVITY_FEE,
          ].includes(selectedChargeTimeOption?.code || "");
        }

        return true;
      })
      .map((option) => ({
        value: String(option.id),
        label: optionLabel(option),
        code: option.code,
      }))
      .filter((item) => item.value);
  }, [chargeTimeOptions, form.chargeTimeType, selectedChargeType, template]);

  const chargePaymentModeOptions = useMemo(() => {
    if (!template) return [];

    return getChargePaymentModeOptions(template)
      .map((option) => ({
        value: String(option.id),
        label: optionLabel(option),
      }))
      .filter((item) => item.value);
  }, [template]);

  const feeFrequencyOptions = useMemo(() => {
    return (template?.feeFrequencyOptions || [])
      .map((option) => ({
        value: String(option.id),
        label: optionLabel(option),
      }))
      .filter((item) => item.value);
  }, [template]);

  const selectedChargeTimeOption = useMemo(
    () => chargeTimeOptions.find((option) => option.value === form.chargeTimeType) || null,
    [chargeTimeOptions, form.chargeTimeType]
  );
  const selectedChargeCalculationOption = useMemo(
    () =>
      chargeCalculationOptions.find(
        (option) => option.value === form.chargeCalculationType
      ) || null,
    [chargeCalculationOptions, form.chargeCalculationType]
  );

  const showChargePaymentMode = selectedChargeType === "LOAN";
  const showPenalty = selectedChargeType !== "SHARES";
  const showMinMaxCap = useMemo(() => {
    if (!selectedChargeCalculationOption || !selectedChargeTimeOption || !selectedChargeType) {
      return false;
    }

    if (selectedChargeType === "LOAN") {
      return [
        CALC_PERCENT_OF_AMOUNT,
        LOAN_CALC_PERCENT_OF_AMOUNT_AND_INTEREST,
        LOAN_CALC_PERCENT_OF_INTEREST,
        LOAN_CALC_PERCENT_OF_DISBURSEMENT_AMOUNT,
      ].includes(selectedChargeCalculationOption.code || "");
    }

    if (selectedChargeType === "SAVINGS") {
      return (
        selectedChargeCalculationOption.code === CALC_PERCENT_OF_AMOUNT &&
        [
          SAVINGS_TIME_TYPE_WITHDRAWAL_FEE,
          SAVINGS_TIME_TYPE_ANNUAL_FEE,
        ].includes(selectedChargeTimeOption.code || "")
      );
    }

    if (selectedChargeType === "SHARES") {
      return (
        selectedChargeCalculationOption.code === CALC_PERCENT_OF_AMOUNT &&
        [
          SHARES_TIME_TYPE_SHARE_PURCHASE,
          SHARES_TIME_TYPE_SHARE_REDEEM,
        ].includes(selectedChargeTimeOption.code || "")
      );
    }

    return false;
  }, [selectedChargeCalculationOption, selectedChargeTimeOption, selectedChargeType]);
  const showAddFeeFrequency =
    selectedChargeTimeOption?.code === TIME_TYPE_OVERDUE_INSTALLMENT;
  const showFeeFrequencyFields = showAddFeeFrequency && form.addFeeFrequency;
  const showDueOnField =
    editingRecordId == null &&
    [
      TIME_TYPE_SPECIFIED_DUE_DATE,
      TIME_TYPE_MONTHLY_FEE,
    ].includes(selectedChargeTimeOption?.code || "");
  const showMonthlyRepeatField =
    editingRecordId == null &&
    selectedChargeTimeOption?.code === TIME_TYPE_MONTHLY_FEE;
  const showWeeklyRepeatField =
    editingRecordId == null &&
    selectedChargeTimeOption?.code === TIME_TYPE_WEEKLY_FEE;
  const repeatEveryLabel = showMonthlyRepeatField ? "Months" : showWeeklyRepeatField ? "Weeks" : "";
  const penaltyLocked = selectedChargeTimeOption?.code === TIME_TYPE_OVERDUE_INSTALLMENT;

  useEffect(() => {
    if (penaltyLocked && !form.penalty) {
      setForm((prev) => ({ ...prev, penalty: true }));
    }
  }, [form.penalty, penaltyLocked]);

  useEffect(() => {
    const previousCode = previousChargeTimeTypeCodeRef.current;
    const currentCode = selectedChargeTimeOption?.code || null;

    if (
      previousCode === TIME_TYPE_OVERDUE_INSTALLMENT &&
      currentCode !== TIME_TYPE_OVERDUE_INSTALLMENT &&
      form.penalty
    ) {
      setForm((prev) => ({ ...prev, penalty: false }));
    }

    previousChargeTimeTypeCodeRef.current = currentCode;
  }, [form.penalty, selectedChargeTimeOption]);

  useEffect(() => {
    if (showPenalty || !form.penalty) return;
    setForm((prev) => ({ ...prev, penalty: false }));
  }, [form.penalty, showPenalty]);

  useEffect(() => {
    if (!loanAppliesToOption || form.chargeAppliesTo) return;
    setForm((prev) => ({ ...prev, chargeAppliesTo: loanAppliesToOption.value }));
  }, [form.chargeAppliesTo, loanAppliesToOption]);

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
    if (!form.chargePaymentMode) return;
    if (!showChargePaymentMode) {
      setForm((prev) => ({ ...prev, chargePaymentMode: "" }));
      return;
    }
    const exists = chargePaymentModeOptions.some(
      (option) => option.value === form.chargePaymentMode
    );
    if (!exists) {
      setForm((prev) => ({ ...prev, chargePaymentMode: "" }));
    }
  }, [chargePaymentModeOptions, form.chargePaymentMode, showChargePaymentMode]);

  useEffect(() => {
    if (!showAddFeeFrequency && form.addFeeFrequency) {
      setForm((prev) => ({ ...prev, addFeeFrequency: false, feeFrequency: "", feeInterval: "" }));
    }
  }, [form.addFeeFrequency, showAddFeeFrequency]);

  useEffect(() => {
    if (!showFeeFrequencyFields && (form.feeFrequency || (showAddFeeFrequency && form.feeInterval))) {
      setForm((prev) => ({ ...prev, feeFrequency: "", feeInterval: showMonthlyRepeatField || showWeeklyRepeatField ? prev.feeInterval : "" }));
    }
  }, [form.feeFrequency, form.feeInterval, showAddFeeFrequency, showFeeFrequencyFields, showMonthlyRepeatField, showWeeklyRepeatField]);

  useEffect(() => {
    if (!(showMonthlyRepeatField || showWeeklyRepeatField) && form.feeInterval) {
      if (!showFeeFrequencyFields) {
        setForm((prev) => ({ ...prev, feeInterval: "" }));
      }
    }
  }, [form.feeInterval, showFeeFrequencyFields, showMonthlyRepeatField, showWeeklyRepeatField]);

  useEffect(() => {
    if (!showDueOnField && form.feeOnMonthDay) {
      setForm((prev) => ({ ...prev, feeOnMonthDay: "" }));
    }
  }, [form.feeOnMonthDay, showDueOnField]);

  useEffect(() => {
    if (currencyOptions.length !== 1 || form.currencyCode) return;
    setForm((prev) => ({ ...prev, currencyCode: currencyOptions[0].value }));
  }, [currencyOptions, form.currencyCode]);

  useEffect(() => {
    if (!showChargePaymentMode) return;
    if (chargePaymentModeOptions.length !== 1 || form.chargePaymentMode) return;
    setForm((prev) => ({ ...prev, chargePaymentMode: chargePaymentModeOptions[0].value }));
  }, [chargePaymentModeOptions, form.chargePaymentMode, showChargePaymentMode]);

  const handleCreateDialogOpenChange = (open: boolean) => {
    setIsCreateModalOpen(open);
    if (!open) {
      setForm(emptyForm);
      setEditingRecordId(null);
      setFormError(null);
    }
  };

  const handleEdit = async (recordId: number) => {
    try {
      setFormError(null);
      setIsSubmitting(true);
      const response = await fetch(`/api/fineract/charges/${recordId}`);
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error || "Failed to load charge");
      }

      setEditingRecordId(recordId);
      setForm({
        chargeAppliesTo:
          body?.chargeAppliesTo?.id != null ? String(body.chargeAppliesTo.id) : "",
        name: body?.name || "",
        amount: toAmountString(body?.amount),
        currencyCode: body?.currency?.code || "",
        chargeTimeType:
          body?.chargeTimeType?.id != null ? String(body.chargeTimeType.id) : "",
        chargeCalculationType:
          body?.chargeCalculationType?.id != null
            ? String(body.chargeCalculationType.id)
            : "",
        chargePaymentMode:
          body?.chargePaymentMode?.id != null
            ? String(body.chargePaymentMode.id)
            : "",
        penalty: body?.penalty ?? false,
        minCap: toOptionalAmountString(body?.minCap),
        maxCap: toOptionalAmountString(body?.maxCap),
        feeInterval: toOptionalAmountString(body?.feeInterval),
        feeFrequency:
          body?.feeFrequency?.id != null ? String(body.feeFrequency.id) : "",
        feeOnMonthDay: toDateInputValue(body?.feeOnMonthDay),
        addFeeFrequency: Number(body?.feeInterval) > 0 && body?.feeFrequency?.id != null,
        active: body?.active ?? true,
      });
      setIsCreateModalOpen(true);
    } catch (err) {
      console.error("Error loading charge:", err);
      setFormError(err instanceof Error ? err.message : "Failed to load charge");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!selectedAppliesToOption || !selectedChargeType) {
      setFormError("Please select charge applies to.");
      return;
    }

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

    if (showChargePaymentMode && !form.chargePaymentMode) {
      setFormError("Please select charge payment mode.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      setFormError("Amount must be greater than zero.");
      return;
    }

    if (showFeeFrequencyFields) {
      if (!form.feeFrequency) {
        setFormError("Please select charge frequency.");
        return;
      }

      if (!form.feeInterval || !/^[1-9]\d*$/.test(form.feeInterval)) {
        setFormError("Frequency interval must be a positive integer.");
        return;
      }
    }

    if (showMonthlyRepeatField) {
      if (!form.feeOnMonthDay) {
        setFormError("Please select due date.");
        return;
      }

      if (
        !form.feeInterval ||
        !/^[1-9]\d*$/.test(form.feeInterval) ||
        Number(form.feeInterval) > 12
      ) {
        setFormError("Repeat every (Months) must be between 1 and 12.");
        return;
      }
    }

    if (showWeeklyRepeatField) {
      if (!form.feeInterval || !/^[1-9]\d*$/.test(form.feeInterval)) {
        setFormError("Repeat every (Weeks) must be a positive integer.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const isEditing = editingRecordId != null;
      const endpoint = isEditing
        ? `/api/fineract/charges/${editingRecordId}`
        : "/api/fineract/charges";

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        chargeAppliesTo: Number(form.chargeAppliesTo),
        currencyCode: form.currencyCode,
        amount: Number(form.amount),
        chargeTimeType: Number(form.chargeTimeType),
        chargeCalculationType: Number(form.chargeCalculationType),
        active: form.active,
        penalty: form.penalty,
        locale: "en",
      };

      if (form.chargePaymentMode) {
        payload.chargePaymentMode = Number(form.chargePaymentMode);
      }

      if (showMinMaxCap && form.minCap.trim()) {
        payload.minCap = Number(form.minCap);
      }

      if (showMinMaxCap && form.maxCap.trim()) {
        payload.maxCap = Number(form.maxCap);
      }

      if (showFeeFrequencyFields) {
        payload.feeFrequency = Number(form.feeFrequency);
        payload.feeInterval = Number(form.feeInterval);
      }

      if (showMonthlyRepeatField || showWeeklyRepeatField) {
        payload.feeInterval = Number(form.feeInterval);
      }

      if (!isEditing && showDueOnField && form.feeOnMonthDay) {
        payload.monthDayFormat = "dd MMM";
        payload.feeOnMonthDay = formatMonthDayForFineract(form.feeOnMonthDay);
      }

      const response = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await response.json();
      if (!response.ok) {
        const message =
          body?.errors?.[0]?.defaultUserMessage ||
          body?.defaultUserMessage ||
          body?.error ||
          "Failed to save charge";
        throw new Error(message);
      }

      await loadData();
      toast.success(isEditing ? "Charge updated." : "Charge created.");
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
            Manage charge definitions directly in Fineract.
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
            This page mirrors charge setup in Fineract and Mifos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading charges...
            </div>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground">No charges found in Fineract.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Applies To</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Charge Time Type</TableHead>
                  <TableHead>Charge Calculation Type</TableHead>
                  <TableHead>Charge Payment Mode</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {formatChargeDisplayName(record.name)}
                    </TableCell>
                    <TableCell>{optionLabel(record.chargeAppliesTo || {}) || "—"}</TableCell>
                    <TableCell>
                      {record.currency?.code || "—"} {toAmountString(record.amount)}
                    </TableCell>
                    <TableCell>{optionLabel(record.chargeTimeType || {}) || "—"}</TableCell>
                    <TableCell>
                      {optionLabel(record.chargeCalculationType || {}) || "—"}
                    </TableCell>
                    <TableCell>
                      {optionLabel(record.chargePaymentMode || {}) || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.active ? "default" : "secondary"}>
                        {record.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(record.id)}
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
            <DialogTitle>{editingRecordId != null ? "Edit Charge" : "Create Charge"}</DialogTitle>
            <DialogDescription>
              {editingRecordId != null
                ? "Update the charge definition directly in Fineract."
                : "Create a new charge definition directly in Fineract."}
            </DialogDescription>
          </DialogHeader>

          <form className="mx-auto w-full max-w-md space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Charge Name
                  <RequiredAsterisk />
                </Label>
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
                <Label htmlFor="amount">
                  Amount
                  <RequiredAsterisk />
                </Label>
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
                <Label>
                  Currency
                  <RequiredAsterisk />
                </Label>
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
                <Label>
                  Charge Time Type
                  <RequiredAsterisk />
                </Label>
                <Select
                  value={form.chargeTimeType}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, chargeTimeType: value }))
                  }
                  disabled={!selectedAppliesToOption}
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
                <Label>
                  Charge Calculation Type
                  <RequiredAsterisk />
                </Label>
                <Select
                  value={form.chargeCalculationType}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, chargeCalculationType: value }))
                  }
                  disabled={!selectedAppliesToOption}
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

              {showChargePaymentMode && (
                <div className="space-y-2">
                  <Label>
                    Charge Payment Mode
                    <RequiredAsterisk />
                  </Label>
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
              )}

              {showAddFeeFrequency && (
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <Checkbox
                    id="add-fee-frequency"
                    checked={form.addFeeFrequency}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, addFeeFrequency: checked === true }))
                    }
                  />
                  <Label htmlFor="add-fee-frequency" className="cursor-pointer">
                    Add Fee Frequency
                  </Label>
                </div>
              )}

              {showFeeFrequencyFields && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fee-interval">
                      Frequency Interval
                      <RequiredAsterisk />
                    </Label>
                    <Input
                      id="fee-interval"
                      type="number"
                      min="1"
                      step="1"
                      value={form.feeInterval}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, feeInterval: event.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Charge Frequency
                      <RequiredAsterisk />
                    </Label>
                    <Select
                      value={form.feeFrequency}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, feeFrequency: value }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select charge frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {feeFrequencyOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {showDueOnField && (
                <div className="space-y-2">
                  <Label htmlFor="fee-on-month-day">
                    Due Date
                    <RequiredAsterisk />
                  </Label>
                  <Input
                    id="fee-on-month-day"
                    type="date"
                    value={form.feeOnMonthDay}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, feeOnMonthDay: event.target.value }))
                    }
                    required
                  />
                </div>
              )}

              {(showMonthlyRepeatField || showWeeklyRepeatField) && (
                <div className="space-y-2">
                  <Label htmlFor="repeat-every">
                    {`Repeat Every (${repeatEveryLabel})`}
                    <RequiredAsterisk />
                  </Label>
                  <Input
                    id="repeat-every"
                    type="number"
                    min="1"
                    max={showMonthlyRepeatField ? "12" : undefined}
                    step="1"
                    value={form.feeInterval}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, feeInterval: event.target.value }))
                    }
                    required
                  />
                </div>
              )}

              {showMinMaxCap && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="min-cap">Minimum Charge Cap</Label>
                    <Input
                      id="min-cap"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.minCap}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, minCap: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-cap">Maximum Charge Cap</Label>
                    <Input
                      id="max-cap"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.maxCap}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, maxCap: event.target.value }))
                      }
                    />
                  </div>
                </>
              )}

              {showPenalty && (
                <div
                  className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/40"
                >
                  <Label htmlFor="penalty" className="text-sm font-medium">
                    Is Penalty
                  </Label>
                  <Switch
                    id="penalty"
                    checked={form.penalty}
                    disabled={penaltyLocked}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, penalty: checked }))
                    }
                  />
                </div>
              )}

              {/*
              {editingRecordId != null && (
                <div
                  className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted/40"
                >
                  <Label htmlFor="active" className="text-sm font-medium">
                    Active
                  </Label>
                  <Switch
                    id="active"
                    checked={form.active}
                    onCheckedChange={(checked) =>
                      setForm((prev) => ({ ...prev, active: checked }))
                    }
                  />
                </div>
              )}
              */}
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
                {editingRecordId != null ? "Update Charge" : "Save Charge"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
