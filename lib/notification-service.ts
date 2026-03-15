/**
 * Shared notification service for sending SMS (Loan Matrix and USSD).
 * Uses NOTIFICATION_SERVICE_URL and POST /api/v1/notifications/sms.
 */

const CONTACT_LINE = "Contact us on +2609558985 /774 or visit our offices.";

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Send an SMS via the external notification service.
 * Best-effort: logs and swallows errors so callers are not blocked.
 */
export async function sendSms(
  phoneNumbers: string[],
  message: string,
  options?: { tenantId?: string }
): Promise<void> {
  const serviceBaseUrl = process.env.NOTIFICATION_SERVICE_URL;
  const tenantId = options?.tenantId ?? process.env.TENANT_ID ?? "goodfellow";

  if (!serviceBaseUrl) {
    console.warn(
      "NOTIFICATION_SERVICE_URL is not set; skipping SMS notification"
    );
    return;
  }

  const validPhones = phoneNumbers.filter((p) => p && String(p).trim());
  if (validPhones.length === 0) {
    console.warn("No valid phone numbers; skipping SMS");
    return;
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
    }
  } catch (err) {
    console.error("Failed to send SMS notification:", err);
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
): Promise<void> {
  const {
    type,
    clientName,
    phone,
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
      return;
  }

  await sendSms([phone], message, { tenantId });
}
