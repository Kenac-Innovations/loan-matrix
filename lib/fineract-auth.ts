import https from "https";
import fetch from "node-fetch";
import { Role, SpecificPermission } from "@/shared/types/auth";
import { mapApiPermissionsToSpecific } from "@/lib/authorization";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

type JsonValue = Record<string, any>;

export class FineractAuthenticationError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "FineractAuthenticationError";
    this.status = status;
  }
}

export type FineractAuthenticatedUser = {
  id: string;
  tenantId: string;
  userId: number;
  username: string;
  name: string;
  email: string;
  fineractEmail: string | null;
  accessToken: string;
  base64EncodedAuthenticationKey: string;
  officeId?: number;
  officeName?: string;
  roles: Role[];
  permissions: SpecificPermission[];
  rawPermissions: string[];
  shouldRenewPassword?: boolean;
  isTwoFactorAuthenticationRequired?: boolean;
};

function getFineractBaseUrl() {
  return process.env.FINERACT_BASE_URL || "https://demo.mifos.io";
}

function createResponseShim(statusCode: number, statusText: string, body: string) {
  return {
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    statusText,
    json: async () => JSON.parse(body),
    text: async () => body,
  };
}

async function requestFineract(
  url: string,
  options: {
    method: "GET" | "POST";
    headers: Record<string, string>;
    body?: string;
  }
) {
  if (url.startsWith("http://")) {
    const http = require("http");
    const parsedUrl = new URL(url);

    return new Promise<ReturnType<typeof createResponseShim>>((resolve, reject) => {
      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 80,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: options.method,
          headers: options.body
            ? {
                ...options.headers,
                "Content-Length": Buffer.byteLength(options.body),
              }
            : options.headers,
        },
        (res: any) => {
          let data = "";
          res.on("data", (chunk: any) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve(
              createResponseShim(
                res.statusCode || 500,
                res.statusMessage || "Request failed",
                data
              )
            );
          });
        }
      );

      req.on("error", reject);

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  return fetch(url, {
    method: options.method,
    headers: options.headers,
    body: options.body,
    agent: new https.Agent({
      rejectUnauthorized: false,
    }),
  });
}

async function readJsonSafe(response: {
  json: () => Promise<any>;
  text: () => Promise<string>;
}) {
  try {
    return await response.json();
  } catch {
    try {
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }
}

export async function extractFineractErrorMessage(response: {
  status: number;
  statusText: string;
  json: () => Promise<any>;
  text: () => Promise<string>;
}) {
  const errorData = await readJsonSafe(response);

  if (errorData?.defaultUserMessage) {
    return errorData.defaultUserMessage as string;
  }

  if (errorData?.developerMessage) {
    return errorData.developerMessage as string;
  }

  if (
    Array.isArray(errorData?.errors) &&
    errorData.errors.length > 0 &&
    typeof errorData.errors[0]?.defaultUserMessage === "string"
  ) {
    return errorData.errors[0].defaultUserMessage as string;
  }

  return `Authentication failed (${response.status} ${response.statusText})`;
}

async function fetchFineractUserDetails(input: {
  baseUrl: string;
  fineractTenantId: string;
  basicAuth: string;
  userId: number;
}) {
  const { baseUrl, fineractTenantId, basicAuth, userId } = input;
  const userDetailUrl = `${baseUrl}/fineract-provider/api/v1/users/${userId}`;

  const response = await requestFineract(userDetailUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${basicAuth}`,
      "Fineract-Platform-TenantId": fineractTenantId,
    },
  });

  if (!response.ok) {
    return null;
  }

  return readJsonSafe(response);
}

export function getPermissionValidationError(userPermissions: string[]) {
  if (!Array.isArray(userPermissions) || userPermissions.length === 0) {
    return "Your account does not have any permissions assigned. Please contact your administrator.";
  }

  const hasAllFunctions =
    userPermissions.includes("ALL_FUNCTIONS") ||
    userPermissions.includes("ALL_FUNCTIONS_READ");

  if (hasAllFunctions) {
    return null;
  }

  const requiredPermissions = ["READ_USER", "READ_CURRENCY", "READ_REPORT"];
  const missing = requiredPermissions.filter(
    (permission) => !userPermissions.includes(permission)
  );

  if (missing.length === 0) {
    return null;
  }

  return `Insufficient privileges. Your account is missing required permissions: ${missing.join(", ")}. Please contact your administrator.`;
}

export async function authenticateWithFineractCredentials(input: {
  username: string;
  password: string;
}): Promise<FineractAuthenticatedUser> {
  const username = input.username.trim();
  const password = input.password;

  if (!username || !password) {
    throw new FineractAuthenticationError(
      "Username and password are required",
      400
    );
  }

  const fineractTenantId = await getFineractTenantId();
  const baseUrl = getFineractBaseUrl();
  const authUrl = `${baseUrl}/fineract-provider/api/v1/authentication`;

  const response = await requestFineract(authUrl, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "Fineract-Platform-TenantId": fineractTenantId,
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  if (!response.ok) {
    throw new FineractAuthenticationError(
      await extractFineractErrorMessage(response),
      response.status
    );
  }

  const data = (await readJsonSafe(response)) as JsonValue | null;

  if (!data?.base64EncodedAuthenticationKey || !data?.userId) {
    throw new FineractAuthenticationError(
      "Authentication failed. Please check your credentials.",
      401
    );
  }

  const computedBasicAuth = Buffer.from(`${username}:${password}`).toString(
    "base64"
  );
  const userDetails = await fetchFineractUserDetails({
    baseUrl,
    fineractTenantId,
    basicAuth: computedBasicAuth,
    userId: Number(data.userId),
  });

  const selectedRoles = Array.isArray(userDetails?.selectedRoles)
    ? userDetails.selectedRoles
    : Array.isArray(data.roles)
      ? data.roles
      : [];

  const fineractEmail =
    typeof userDetails?.email === "string" && userDetails.email.trim()
      ? userDetails.email.trim()
      : typeof data.email === "string" && data.email.trim()
        ? data.email.trim()
        : null;
  const resolvedOfficeId =
    typeof data.officeId === "number"
      ? data.officeId
      : Number.isFinite(Number(data.officeId))
        ? Number(data.officeId)
        : undefined;

  return {
    id: String(data.userId),
    tenantId: fineractTenantId,
    userId: Number(data.userId),
    username: typeof data.username === "string" ? data.username : username,
    name: typeof data.username === "string" ? data.username : username,
    email: fineractEmail || username,
    fineractEmail,
    accessToken: computedBasicAuth,
    base64EncodedAuthenticationKey: computedBasicAuth,
    officeId: resolvedOfficeId,
    officeName:
      typeof data.officeName === "string" ? data.officeName : undefined,
    roles: selectedRoles.map((role: JsonValue) => ({
      id: Number(role.id),
      name: typeof role.name === "string" ? role.name : "Unknown Role",
      description:
        typeof role.description === "string" ? role.description : "",
      disabled: Boolean(role.disabled),
    })),
    permissions: mapApiPermissionsToSpecific(
      Array.isArray(data.permissions) ? data.permissions : []
    ),
    rawPermissions: Array.isArray(data.permissions) ? data.permissions : [],
    shouldRenewPassword: Boolean(data.shouldRenewPassword),
    isTwoFactorAuthenticationRequired: Boolean(
      data.isTwoFactorAuthenticationRequired
    ),
  };
}
