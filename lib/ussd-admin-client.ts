export type UssdAdminUser = {
  userId: number;
  fullName: string;
  nationalIdMask?: string | null;
  phoneNumber: string;
  otherPhoneNumber?: string | null;
  active?: boolean;
  createdAt?: string | null;
};

export type UssdAdminResetResult = {
  success: boolean;
  status: string;
  message: string;
  userId?: number | null;
  fullName?: string | null;
  phoneNumber?: string | null;
};

type ResetInput = {
  phoneNumber: string;
  actorUserId: number;
  actorName: string;
  reason: string;
};

function getUssdApiBaseUrl(): string {
  const baseUrl = (process.env.USSD_BASE_URL ?? "").replace(/\/$/, "");

  if (!baseUrl) {
    throw new Error("USSD_BASE_URL is not configured");
  }

  return baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;
}

function getUssdAdminApiKey(): string {
  const apiKey = process.env.USSD_ADMIN_API_KEY ?? "";

  if (!apiKey) {
    throw new Error("USSD_ADMIN_API_KEY is not configured");
  }

  return apiKey;
}

function getAdminHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-USSD-Admin-Key": getUssdAdminApiKey(),
  };
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numericId(value: unknown, fieldName: string): number {
  const id = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(id)) {
    throw new Error(`USSD response returned an invalid ${fieldName}`);
  }

  return id;
}

function parseUssdAdminUser(payload: unknown): UssdAdminUser {
  if (
    !isRecord(payload) ||
    typeof payload.fullName !== "string" ||
    typeof payload.phoneNumber !== "string"
  ) {
    throw new Error("USSD lookup returned invalid user details");
  }

  return {
    userId: numericId(payload.userId, "userId"),
    fullName: payload.fullName,
    nationalIdMask: optionalString(payload.nationalIdMask),
    phoneNumber: payload.phoneNumber,
    createdAt: optionalString(payload.createdAt),
  };
}

function parseUssdResetResult(payload: unknown): UssdAdminResetResult | null {
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
    userId: payload.userId == null ? null : numericId(payload.userId, "userId"),
    fullName: optionalString(payload.fullName),
    phoneNumber: optionalString(payload.phoneNumber),
  };
}

function parseUssdResetResultBody(body: string): UssdAdminResetResult | null {
  if (!body) {
    return null;
  }

  try {
    return parseUssdResetResult(JSON.parse(body));
  } catch {
    return null;
  }
}

export function normalizeUssdPhoneNumber(phoneNumber: string): string {
  const digits = String(phoneNumber || "").replace(/\D/g, "");

  if (digits.startsWith("260") && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `260${digits.slice(1)}`;
  }

  if (digits.length === 9) {
    return `260${digits}`;
  }

  return digits;
}

export async function lookupUssdUserByPhone(
  phoneNumber: string
): Promise<UssdAdminUser | null> {
  const normalizedPhoneNumber = normalizeUssdPhoneNumber(phoneNumber);
  const url = new URL(`${getUssdApiBaseUrl()}/admin/users/lookup`);
  url.searchParams.set("phoneNumber", normalizedPhoneNumber);

  const response = await fetch(url, {
    method: "GET",
    headers: getAdminHeaders(),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await readResponseBody(response);
    throw new Error(
      `USSD lookup failed (${response.status}): ${body || response.statusText}`
    );
  }

  const payload = await response.json();
  return parseUssdAdminUser(payload);
}

export async function resetUssdPin(
  input: ResetInput
): Promise<UssdAdminResetResult> {
  const response = await fetch(`${getUssdApiBaseUrl()}/admin/users/pin-reset`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({
      phoneNumber: normalizeUssdPhoneNumber(input.phoneNumber),
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      reason: input.reason,
    }),
  });

  if (!response.ok) {
    const body = await readResponseBody(response);
    const resetResult = parseUssdResetResultBody(body);
    if (resetResult) {
      return resetResult;
    }

    throw new Error(
      `USSD PIN reset failed (${response.status}): ${body || response.statusText}`
    );
  }

  const payload = await response.json();
  const resetResult = parseUssdResetResult(payload);
  if (!resetResult) {
    throw new Error("USSD PIN reset returned invalid reset details");
  }

  return resetResult;
}
