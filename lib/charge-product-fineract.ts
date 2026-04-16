import { ChargeProductTypeValue } from "@/shared/types/charge-product";

export interface FineractEnumOption {
  id: number;
  code: string;
  value?: string;
  description?: string;
}

interface ChargeTemplatePayload {
  chargeAppliesToOptions?: unknown;
  chargeTimeTypeOptions?: unknown;
  chargeCalculationTypeOptions?: unknown;
  chargePaymentModeOptions?: unknown;
  chargePaymetModeOptions?: unknown;
  loanChargeTimeTypeOptions?: unknown;
  savingsChargeTimeTypeOptions?: unknown;
  clientChargeTimeTypeOptions?: unknown;
  loanChargeCalculationTypeOptions?: unknown;
  savingsChargeCalculationTypeOptions?: unknown;
  clientChargeCalculationTypeOptions?: unknown;
}

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

function toOptions(input: unknown): FineractEnumOption[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.reduce<FineractEnumOption[]>((acc, item) => {
      const option = item as Record<string, unknown>;
      const id = Number(option.id);
      const code = typeof option.code === "string" ? option.code : "";
      if (!Number.isFinite(id) || !code) {
        return acc;
      }

      acc.push({
        id,
        code,
        value: typeof option.value === "string" ? option.value : undefined,
        description:
          typeof option.description === "string"
            ? option.description
            : undefined,
      });
      return acc;
    }, []);
}

export function getChargeAppliesToOptions(
  template: ChargeTemplatePayload
): FineractEnumOption[] {
  return toOptions(template.chargeAppliesToOptions);
}

export function getChargePaymentModeOptions(
  template: ChargeTemplatePayload
): FineractEnumOption[] {
  const options = toOptions(template.chargePaymentModeOptions);
  if (options.length > 0) {
    return options;
  }
  // Fineract/Mifos payload may expose this with a legacy typo.
  return toOptions(template.chargePaymetModeOptions);
}

export function getChargeTimeOptionsForType(
  template: ChargeTemplatePayload,
  type: ChargeProductTypeValue
): FineractEnumOption[] {
  if (type === "LOAN") {
    return toOptions(template.loanChargeTimeTypeOptions).length > 0
      ? toOptions(template.loanChargeTimeTypeOptions)
      : toOptions(template.chargeTimeTypeOptions);
  }
  if (type === "SAVINGS") {
    return toOptions(template.savingsChargeTimeTypeOptions).length > 0
      ? toOptions(template.savingsChargeTimeTypeOptions)
      : toOptions(template.chargeTimeTypeOptions);
  }
  if (type === "CLIENT") {
    return toOptions(template.clientChargeTimeTypeOptions).length > 0
      ? toOptions(template.clientChargeTimeTypeOptions)
      : toOptions(template.chargeTimeTypeOptions);
  }
  return toOptions(template.chargeTimeTypeOptions);
}

export function getChargeCalculationOptionsForType(
  template: ChargeTemplatePayload,
  type: ChargeProductTypeValue
): FineractEnumOption[] {
  if (type === "LOAN") {
    return toOptions(template.loanChargeCalculationTypeOptions).length > 0
      ? toOptions(template.loanChargeCalculationTypeOptions)
      : toOptions(template.chargeCalculationTypeOptions);
  }
  if (type === "SAVINGS") {
    return toOptions(template.savingsChargeCalculationTypeOptions).length > 0
      ? toOptions(template.savingsChargeCalculationTypeOptions)
      : toOptions(template.chargeCalculationTypeOptions);
  }
  if (type === "CLIENT") {
    return toOptions(template.clientChargeCalculationTypeOptions).length > 0
      ? toOptions(template.clientChargeCalculationTypeOptions)
      : toOptions(template.chargeCalculationTypeOptions);
  }
  return toOptions(template.chargeCalculationTypeOptions);
}

export function findOptionIdByCode(
  options: FineractEnumOption[],
  fineractCode: string
): number | null {
  const normalized = normalizeCode(fineractCode);
  const found = options.find((option) => normalizeCode(option.code) === normalized);
  return found?.id ?? null;
}
