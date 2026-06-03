/**
 * Shared notification service for sending SMS (Loan Matrix and USSD).
 * Uses NOTIFICATION_SERVICE_URL and POST /api/v1/notifications/sms.
 */

import { prisma } from "@/lib/prisma";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import {
  normalizeCountryDialCode,
  normalizeSmsPhoneNumber as normalizeSmsPhoneNumberFromUtils,
} from "@/lib/phone-utils";

const CONTACT_LINE = "For more info please contact us on +260957224792 /774 or visit our offices.";
const DEFAULT_SMS_COUNTRY_CODE =
  process.env.SMS_DEFAULT_COUNTRY_CODE || "+260";
const DEFAULT_EMAIL_NOTIFICATION_PATH =
  process.env.EMAIL_NOTIFICATION_SERVICE_PATH || "/api/v1/notifications/email";

async function resolveNotificationServiceTenantId(
  tenantId?: string
): Promise<string> {
  let tenantRecord:
    | { slug: string; notificationServiceTenantId: string | null }
    | null = null;

  if (tenantId) {
    tenantRecord = await prisma.tenant.findFirst({
      where: {
        OR: [{ id: tenantId }, { slug: tenantId }],
      },
      select: {
        slug: true,
        notificationServiceTenantId: true,
      },
    });
  } else {
    try {
      const tenant = await getTenantFromHeaders();
      if (tenant?.id) {
        tenantRecord = await prisma.tenant.findUnique({
          where: { id: tenant.id },
          select: {
            slug: true,
            notificationServiceTenantId: true,
          },
        });
      }
    } catch {
      tenantRecord = null;
    }
  }

  const configuredTenantId = tenantRecord?.notificationServiceTenantId?.trim();
  if (configuredTenantId) {
    return configuredTenantId;
  }

  const slugFallback = tenantRecord?.slug?.trim();
  if (slugFallback) {
    return slugFallback;
  }

  return "no-tenant";
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function normalizeSmsPhoneNumber(
  phone: string,
  countryCode?: string | null
): string | null {
  return normalizeSmsPhoneNumberFromUtils(
    phone,
    countryCode || normalizeCountryDialCode(DEFAULT_SMS_COUNTRY_CODE)
  );
}

/**
 * Send an SMS via the external notification service.
 * Best-effort: logs and swallows errors so callers are not blocked.
 */
export async function sendSms(
  phoneNumbers: string[],
  message: string,
  options?: {
    tenantId?: string;
    countryCode?: string | null;
    logLabel?: string;
  }
): Promise<boolean> {
  const serviceBaseUrl = process.env.NOTIFICATION_SERVICE_URL;

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
    const tenantId = await resolveNotificationServiceTenantId(options?.tenantId);
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
    if (options?.logLabel) {
      console.log(`[${options.logLabel}] Notification service SMS payload:`, {
        url,
        payload,
      });
    } else {
      console.log("SENDING SMS TO NOTIFICATION SERVICE...");
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const responseText = await res.text().catch(() => "");

    if (options?.logLabel) {
      console.log(`[${options.logLabel}] Notification service SMS response:`, {
        status: res.status,
        ok: res.ok,
        body: responseText,
      });
    }

    if (!res.ok) {
      console.error(
        "Notification service SMS failed:",
        res.status,
        responseText
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

export async function sendEmail(
  emailAddresses: string[],
  subject: string,
  html: string,
  options?: {
    tenantId?: string;
    text?: string;
    fromEmail?: string;
    logLabel?: string;
  }
): Promise<boolean> {
  const serviceBaseUrl =
    process.env.EMAIL_NOTIFICATION_SERVICE_URL ||
    process.env.NOTIFICATION_SERVICE_URL;
  const validEmails = emailAddresses
    .map((email) => String(email || "").trim())
    .filter(Boolean);

  if (!serviceBaseUrl) {
    console.warn(
      "No email notification service is configured; skipping email notification"
    );
    return false;
  }

  if (validEmails.length === 0) {
    console.warn("No valid email addresses; skipping email notification");
    return false;
  }

  try {
    const tenantId = await resolveNotificationServiceTenantId(options?.tenantId);
    const payload = {
      tenantId,
      emailAddresses: validEmails,
      subject,
      html,
      text: options?.text,
      fromEmail: options?.fromEmail || process.env.MFA_EMAIL_FROM,
      messageId:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      configId: 0,
    };

    const url = `${serviceBaseUrl.replace(/\/$/, "")}${DEFAULT_EMAIL_NOTIFICATION_PATH}`;
    if (options?.logLabel) {
      console.log(`[${options.logLabel}] Notification service email payload:`, {
        url,
        payload,
      });
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const responseText = await res.text().catch(() => "");

    if (options?.logLabel) {
      console.log(`[${options.logLabel}] Notification service email response:`, {
        status: res.status,
        ok: res.ok,
        body: responseText,
      });
    }

    if (!res.ok) {
      console.error(
        "Notification service email failed:",
        res.status,
        responseText
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send email notification:", error);
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
      message = `Dear ${name}, your loan of ${prefix} has been processed successfully. ${CONTACT_LINE}`;
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
