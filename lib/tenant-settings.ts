import type {
  TenantAutoPopulateFields,
  TenantSettings,
} from "@/shared/types/tenant";

export function shouldAutoPopulateTenantField(
  settings: Pick<TenantSettings, "autoPopulateFields"> | null | undefined,
  field: keyof TenantAutoPopulateFields
): boolean {
  return settings?.autoPopulateFields?.[field] !== false;
}

export function shouldAutoPopulatePrincipalAmount(
  settings: Pick<TenantSettings, "autoPopulateFields"> | null | undefined
): boolean {
  return shouldAutoPopulateTenantField(settings, "principalAmount");
}
