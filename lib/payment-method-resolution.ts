export type PreferredPaymentMethod =
  | "CASH"
  | "MOBILE_MONEY"
  | "BANK_TRANSFER";

export interface PaymentTypeOption {
  id: number | string;
  name?: string | null;
  isCashPayment?: boolean | null;
}

export interface ResolvedPaymentType {
  method: PreferredPaymentMethod;
  paymentTypeId: string;
  displayLabel: string;
  paymentType: PaymentTypeOption;
}

function isMobileMoneyLike(name?: string | null): boolean {
  const normalizedName = name?.trim().toUpperCase() || "";
  return (
    normalizedName.includes("MOBILE") ||
    normalizedName.includes("MOMO") ||
    normalizedName.includes("AIRTEL") ||
    normalizedName.includes("MTN") ||
    normalizedName.includes("WALLET")
  );
}

export function normalizePreferredPaymentMethod(
  value?: string | null
): PreferredPaymentMethod | null {
  const normalized = value?.trim().toUpperCase().replaceAll(/\s+/g, "_") || "";
  if (
    normalized === "CASH" ||
    normalized === "MOBILE_MONEY" ||
    normalized === "BANK_TRANSFER"
  ) {
    return normalized;
  }

  return null;
}

export function getPreferredPaymentMethodLabel(
  value?: string | null
): string {
  const normalized = normalizePreferredPaymentMethod(value);
  if (normalized === "CASH") return "Cash";
  if (normalized === "MOBILE_MONEY") return "Mobile Money";
  if (normalized === "BANK_TRANSFER") return "Bank Transfer";
  return value?.trim() || "Unknown";
}

export function inferPreferredPaymentMethodFromPaymentType(
  paymentType?: Pick<PaymentTypeOption, "name" | "isCashPayment"> | null
): PreferredPaymentMethod | null {
  if (!paymentType) return null;
  if (paymentType.isCashPayment) return "CASH";
  if (isMobileMoneyLike(paymentType.name)) return "MOBILE_MONEY";
  return "BANK_TRANSFER";
}

export function resolvePaymentTypeForPreferredMethod(
  preferredPaymentMethod: string | null | undefined,
  paymentTypes: PaymentTypeOption[]
): ResolvedPaymentType | null {
  const method = normalizePreferredPaymentMethod(preferredPaymentMethod);
  if (!method) return null;

  const list = Array.isArray(paymentTypes) ? paymentTypes : [];

  let matchedPaymentType: PaymentTypeOption | undefined;
  if (method === "CASH") {
    matchedPaymentType = list.find((paymentType) => Boolean(paymentType.isCashPayment));
  } else if (method === "MOBILE_MONEY") {
    matchedPaymentType = list.find(
      (paymentType) =>
        !paymentType.isCashPayment && isMobileMoneyLike(paymentType.name)
    );
  } else {
    matchedPaymentType = list.find(
      (paymentType) =>
        !paymentType.isCashPayment && !isMobileMoneyLike(paymentType.name)
    );
  }

  if (!matchedPaymentType) {
    return null;
  }

  return {
    method,
    paymentTypeId: String(matchedPaymentType.id),
    displayLabel:
      matchedPaymentType.name?.trim() || getPreferredPaymentMethodLabel(method),
    paymentType: matchedPaymentType,
  };
}
