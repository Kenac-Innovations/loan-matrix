const BACKEND_URL_ENV = "LOAN_MATRIX_BACKEND_URL";
const PAYMENT_CALLBACK_PATH = "/api/v1/ussd-loans/payment-callback";

/**
 * Payment Service and Loan Matrix Backend run inside the same cluster. Use the
 * established backend service URL instead of exposing a callback through the
 * Next.js application or adding a product-specific callback setting.
 */
export function getRequiredLoanMatrixBackendPaymentCallbackUrl(): string {
  const backendUrl = process.env[BACKEND_URL_ENV]?.trim();
  if (!backendUrl) {
    throw new Error(`${BACKEND_URL_ENV} is required for Salary Advance payouts`);
  }

  try {
    const base = new URL(backendUrl);
    if (base.protocol !== "http:" && base.protocol !== "https:") {
      throw new Error("must use HTTP or HTTPS");
    }
    return new URL(PAYMENT_CALLBACK_PATH, base).toString();
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(`${BACKEND_URL_ENV} must be a valid backend URL${detail}`);
  }
}
