import { createHmac, timingSafeEqual } from "node:crypto";

const CALLBACK_URL_ENV = "SALARY_ADVANCE_PAYMENT_CALLBACK_URL";
const CALLBACK_SECRET_ENV = "SALARY_ADVANCE_PAYMENT_CALLBACK_SECRET";

export const SALARY_ADVANCE_CALLBACK_SIGNATURE_HEADER =
  "x-kenac-payment-signature";

export function getRequiredSalaryAdvancePaymentCallbackUrl(): string {
  const callbackUrl = process.env[CALLBACK_URL_ENV]?.trim();
  if (!callbackUrl) {
    throw new Error(`${CALLBACK_URL_ENV} is required for Salary Advance payouts`);
  }

  try {
    const parsed = new URL(callbackUrl);
    if (parsed.protocol !== "https:" && process.env.NODE_ENV === "production") {
      throw new Error("must use HTTPS in production");
    }
    return parsed.toString();
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(`${CALLBACK_URL_ENV} must be a valid callback URL${detail}`);
  }
}

export function verifySalaryAdvancePaymentCallbackSignature(
  rawBody: string,
  providedSignature: string | null
): boolean {
  const secret = process.env[CALLBACK_SECRET_ENV];
  if (!secret || !providedSignature) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = providedSignature.trim().toLowerCase();
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");

  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}
