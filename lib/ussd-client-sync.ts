import {
  getAdminHeaders,
  getUssdApiBaseUrl,
  normalizeUssdPhoneNumber,
  readResponseBody,
} from "@/lib/ussd-admin-client";

export type UssdPhoneUpdateResult = {
  success: boolean;
  status: string;
  message: string;
  userId?: string | null;
  externalId?: number | null;
  oldPhoneNumber?: string | null;
  newPhoneNumber?: string | null;
};

type PhoneUpdateInput = {
  ussdServiceTenantId: string;
  externalId: number;
  currentPhoneNumber: string;
  newPhoneNumber: string;
};

/**
 * Statuses that mean "nothing to sync" rather than a failure — the caller
 * may safely proceed with the rest of the client update.
 */
export const USSD_PHONE_UPDATE_NON_BLOCKING_STATUSES = new Set([
  "NOT_FOUND",
  "UNCHANGED",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function optionalNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function parsePhoneUpdateResult(payload: unknown): UssdPhoneUpdateResult | null {
  if (
    !isRecord(payload) ||
    typeof payload.success !== "boolean" ||
    typeof payload.status !== "string" ||
    typeof payload.message !== "string"
  ) {
    return null;
  }

  return {
    success: payload.success,
    status: payload.status,
    message: payload.message,
    userId: optionalString(payload.userId),
    externalId: optionalNumber(payload.externalId),
    oldPhoneNumber: optionalString(payload.oldPhoneNumber),
    newPhoneNumber: optionalString(payload.newPhoneNumber),
  };
}

function parsePhoneUpdateResultBody(body: string): UssdPhoneUpdateResult | null {
  if (!body) {
    return null;
  }

  try {
    return parsePhoneUpdateResult(JSON.parse(body));
  } catch {
    return null;
  }
}

export async function updateUssdClientPhone(
  input: PhoneUpdateInput
): Promise<UssdPhoneUpdateResult> {
  const response = await fetch(
    `${getUssdApiBaseUrl()}/admin/users/external/${input.externalId}/phone`,
    {
      method: "PUT",
      headers: getAdminHeaders(input.ussdServiceTenantId),
      body: JSON.stringify({
        currentPhoneNumber: normalizeUssdPhoneNumber(input.currentPhoneNumber),
        newPhoneNumber: normalizeUssdPhoneNumber(input.newPhoneNumber),
      }),
    }
  );

  const body = await readResponseBody(response);
  const result = parsePhoneUpdateResultBody(body);

  if (!response.ok) {
    if (result) {
      return result;
    }

    throw new Error(
      `USSD phone update failed (${response.status}): ${
        body || response.statusText
      }`
    );
  }

  if (!result) {
    throw new Error("USSD phone update returned invalid details");
  }

  return result;
}
