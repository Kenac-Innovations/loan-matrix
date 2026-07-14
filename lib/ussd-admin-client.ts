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

  return response.json() as Promise<UssdAdminUser>;
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
    throw new Error(
      `USSD PIN reset failed (${response.status}): ${body || response.statusText}`
    );
  }

  return response.json() as Promise<UssdAdminResetResult>;
}
