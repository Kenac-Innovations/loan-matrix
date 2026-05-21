import { DEFAULT_FEATURES, TenantFeatures } from "@/shared/types/tenant";

export function getTenantFeatures(settings: unknown): TenantFeatures {
  const resolvedSettings = (settings || {}) as { features?: Partial<TenantFeatures> };
  return {
    ...DEFAULT_FEATURES,
    ...(resolvedSettings.features || {}),
  };
}

export function isInvoiceDiscountingEnabled(settings: unknown): boolean {
  return getTenantFeatures(settings).hasInvoiceDiscounting === true;
}

export function isRevolvingCreditEnabled(settings: unknown): boolean {
  return getTenantFeatures(settings).hasRevolvingCredit === true;
}

export function isCreditFacilityEnabled(settings: unknown): boolean {
  return getTenantFeatures(settings).hasCreditFacility === true;
}

