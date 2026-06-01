/**
 * Shared notification service for sending SMS (Loan Matrix and USSD).
 * Uses NOTIFICATION_SERVICE_URL and POST /api/v1/notifications/sms.
 */

const CONTACT_LINE = "Contact us on +260957224792 /774 or visit our offices.";
const DEFAULT_SMS_COUNTRY_CODE =
  process.env.SMS_DEFAULT_COUNTRY_CODE || "+260";

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeCountryCode(countryCode?: string | null): string | null {
  if (!countryCode) return null;
  const digits = String(countryCode).replace(/\D/g, "");
  return digits || null;
}

export function normalizeSmsPhoneNumber(
  phone: string,
  countryCode?: string | null
): string | null {
  const raw = String(phone || "").trim();
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (raw.startsWith("+")) {
    return `+${digits}`;
  }

  if (raw.startsWith("00")) {
    const internationalDigits = digits.slice(2);
    return internationalDigits ? `+${internationalDigits}` : null;
  }

  const normalizedCountryCode =
    normalizeCountryCode(countryCode) ||
    normalizeCountryCode(DEFAULT_SMS_COUNTRY_CODE);

  if (normalizedCountryCode) {
    if (digits.startsWith(normalizedCountryCode)) {
      return `+${digits}`;
    }

    const localDigits = digits.startsWith("0") ? digits.slice(1) : digits;
    if (localDigits) {
      return `+${normalizedCountryCode}${localDigits}`;
    }
  }

  if (digits.length >= 11) {
    return `+${digits}`;
  }

  return digits;
}

/**
 * Send an SMS via the external notification service.
 * Best-effort: logs and swallows errors so callers are not blocked.
 */
export async function sendSms(
  phoneNumbers: string[],
  message: string,
  options?: { tenantId?: string; countryCode?: string | null }
): Promise<boolean> {
  const serviceBaseUrl = process.env.NOTIFICATION_SERVICE_URL;
  const tenantId = options?.tenantId ?? process.env.TENANT_ID ?? "no-tenant";

  if (!serviceBaseUrl) {
    console.warn(
      "NOTIFICATION_SERVICE_URL is not set; skipping SMS notification"
    );
    return false;
  }

  const validPhones = phoneNumbers
    .map((phone) => normalizeSmsPhoneNumber(phone, options?.countryCode))
    .filter((phone): phone is string => Boolean(phone));
  if (validPhones.length === 0) {
    console.warn("No valid phone numbers; skipping SMS");
    return false;
  }

  try {
    const payload = {
      tenantId,
      phoneNumbers: validPhones,
      message,
      messageId:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      configId: 0,
    };

    console.log("SENDING SMS TO NOTIFICATION SERVICE...");
    const url = `${serviceBaseUrl.replace(/\/$/, "")}/api/v1/notifications/sms`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(
        "Notification service SMS failed:",
        res.status,
        await res.text().catch(() => "")
      );
      return false;
    }

    console.log("SMS NOTIFICATION SENT SUCCESSFULLY...");
    return true;
  } catch (err) {
    console.error("Failed to send SMS notification:", err);
    return false;
  }
}

export type LoanStatusSmsType =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "disbursed"
  | "paid";

export interface LoanStatusSmsParams {
  type: LoanStatusSmsType;
  clientName: string;
  phone: string;
  countryCode?: string | null;
  amount: number;
  /** For rejected: reason text */
  reason?: string;
  /** Currency code for display, e.g. ZMW */
  currency?: string;
  tenantId?: string;
}

/**
 * Build message for a loan status and send SMS.
 * Used for Loan Matrix loan application status changes (not USSD nano loans).
 */
export async function sendLoanStatusSms(
  params: LoanStatusSmsParams
): Promise<boolean> {
  const {
    type,
    clientName,
    phone,
    countryCode,
    amount,
    reason,
    currency = "ZMW",
    tenantId,
  } = params;

  const name = clientName?.trim() || "Customer";
  const amountStr = formatAmount(amount);
  const prefix = `${currency} ${amountStr}`;

  let message: string;
  switch (type) {
    case "pending_approval":
      message = `Dear ${name}, your loan application of ${prefix} has been submitted and is pending approval. We will notify you of the outcome. ${CONTACT_LINE}`;
      break;
    case "approved":
      message = `Dear ${name}, your loan application of ${prefix} has been approved. Visit our office to complete disbursement. ${CONTACT_LINE}`;
      break;
    case "rejected":
      message = `Sorry ${name}, your loan application of ${prefix} was not approved. Reason: ${reason || "No reason provided"}. ${CONTACT_LINE}`;
      break;
    case "disbursed":
      message = `Dear ${name}, your loan of ${prefix} has been disbursed. Visit our office to collect your payout. ${CONTACT_LINE}`;
      break;
    case "paid":
      message = `Dear ${name}, your loan payout of ${prefix} has been completed. Thank you for banking with us. ${CONTACT_LINE}`;
      break;
    default:
      return false;
  }

  return sendSms([phone], message, { tenantId, countryCode });
}

export interface LoanRepaymentSmsParams {
  clientName: string;
  phone: string;
  countryCode?: string | null;
  amount: number;
  currency?: string;
  tenantId?: string;
}

/**
 * Send a repayment receipt SMS after a successful loan repayment.
 */
export async function sendLoanRepaymentSms(
  params: LoanRepaymentSmsParams
): Promise<boolean> {
  const {
    clientName,
    phone,
    countryCode,
    amount,
    currency = "ZMW",
    tenantId,
  } = params;

  const name = clientName?.trim() || "Customer";
  const amountStr = formatAmount(amount);
  const prefix = `${currency} ${amountStr}`;

  const message = `Dear ${name}, we have received your loan repayment of ${prefix}. Thank you for keeping your account up to date. ${CONTACT_LINE}`;

  return sendSms([phone], message, { tenantId, countryCode });
}
