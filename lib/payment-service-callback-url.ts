const CALLBACK_ENV_ERROR =
  "PAYMENT_SERVICE_CALLBACK_URL or CDE_DISBURSEMENT_CALLBACK_URL is required for Yango USSD disbursements";

export function resolvePaymentServiceCallbackUrl(): string | null {
  const callbackUrl =
    process.env.PAYMENT_SERVICE_CALLBACK_URL?.trim() ||
    process.env.CDE_DISBURSEMENT_CALLBACK_URL?.trim() ||
    "";

  return callbackUrl || null;
}

export function getRequiredPaymentServiceCallbackUrl(): string {
  const callbackUrl = resolvePaymentServiceCallbackUrl();

  if (!callbackUrl) {
    throw new Error(CALLBACK_ENV_ERROR);
  }

  return callbackUrl;
}

export function buildPaymentServiceCallbackUrl(
  baseCallbackUrl: string,
  ussdServiceTenantId?: string | null
): string {
  const normalizedBaseUrl = baseCallbackUrl.trim();
  const tenantCode = ussdServiceTenantId?.trim();

  if (!tenantCode) {
    return normalizedBaseUrl;
  }

  try {
    const callbackUrl = new URL(normalizedBaseUrl);
    callbackUrl.searchParams.set("tenantCode", tenantCode);
    return callbackUrl.toString();
  } catch {
    return normalizedBaseUrl;
  }
}
