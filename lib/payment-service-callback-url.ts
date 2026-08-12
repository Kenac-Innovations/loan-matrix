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
