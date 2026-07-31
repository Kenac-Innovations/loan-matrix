import https from "https";
import { getFineractTenantId as getFineractTenantIdFromService } from "./fineract-tenant-service";
import { getFineractBaseUrl } from "./fineract-base-url";

// Re-export for convenience
export { getFineractTenantIdFromService as getFineractTenantId };

// Get base URL from environment variable with fallback
const baseUrl = getFineractBaseUrl();

// Hardcoded service token for all API calls
// TODO: Move to environment variable
const SERVICE_TOKEN = "bWlmb3M6cGFzc3dvcmQ=";

export type FineractAuthMode = "session" | "service";

export type FineractRequestInit = RequestInit & {
  authMode?: FineractAuthMode;
};

type FineractRequestConfig = {
  headers: Record<string, string>;
  requestOptions: RequestInit;
  url: string;
};

type FineractError = Error & {
  status?: number;
  errorData?: unknown;
};

type FetchOptionsWithAgent = RequestInit & {
  agent?: https.Agent;
};

/**
 * Get access token - prefer the logged-in user's Fineract session and
 * fall back to the service token when no session is available.
 */
export async function getAccessToken(): Promise<string> {
  try {
    const { getSession } = await import("./auth");
    const nextAuthSession = (await getSession()) as {
      base64EncodedAuthenticationKey?: string;
      accessToken?: string;
    } | null;

    if (nextAuthSession?.base64EncodedAuthenticationKey) {
      return nextAuthSession.base64EncodedAuthenticationKey;
    }

    if (nextAuthSession?.accessToken) {
      return nextAuthSession.accessToken;
    }

    const { getSession: getCustomSession } = await import("@/app/actions/auth");
    const customSession = (await getCustomSession()) as {
      base64EncodedAuthenticationKey?: string;
      accessToken?: string;
    } | null;

    if (customSession?.base64EncodedAuthenticationKey) {
      return customSession.base64EncodedAuthenticationKey;
    }

    if (customSession?.accessToken) {
      return customSession.accessToken;
    }
  } catch (error) {
    console.error("Error resolving Fineract access token:", error);
  }

  return SERVICE_TOKEN;
}

export async function getCurrentUserAccessToken(): Promise<string> {
  const { getSession } = await import("./auth");
  const nextAuthSession = (await getSession()) as {
    base64EncodedAuthenticationKey?: string;
    accessToken?: string;
  } | null;

  const accessToken =
    nextAuthSession?.base64EncodedAuthenticationKey ||
    nextAuthSession?.accessToken;

  if (!accessToken) {
    throw new Error("A logged-in Fineract user session is required");
  }

  return accessToken;
}

async function resolveFineractAuthToken(
  authMode: FineractAuthMode
): Promise<string> {
  return authMode === "service" ? SERVICE_TOKEN : await getAccessToken();
}

async function performFineractRequest(
  url: string,
  requestOptions: RequestInit,
  headers: Record<string, string>
) {
  if (url.startsWith("http://")) {
    return fetch(url, {
      ...requestOptions,
      headers,
    });
  }

  const agent = new https.Agent({ rejectUnauthorized: false });

  const fetchOptions: FetchOptionsWithAgent = {
    ...requestOptions,
    headers,
    agent,
  };

  return fetch(url, fetchOptions);
}

async function readFineractResponse(response: Response, url: string) {
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        defaultUserMessage: `HTTP ${response.status}: ${response.statusText}`,
        developerMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    if (!errorData || Object.keys(errorData).length === 0) {
      errorData = {
        defaultUserMessage: `HTTP ${response.status}: ${response.statusText}`,
        developerMessage: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    let specificErrorMessage =
      errorData.defaultUserMessage || errorData.developerMessage;

    if (
      errorData.errors &&
      Array.isArray(errorData.errors) &&
      errorData.errors.length > 0
    ) {
      const firstError = errorData.errors[0];
      specificErrorMessage =
        firstError.defaultUserMessage ||
        firstError.developerMessage ||
        specificErrorMessage;
    }

    const error = new Error(
      `API error: ${response.status} ${response.statusText}`
    );
    const fineractError = error as FineractError;
    fineractError.status = response.status;
    fineractError.errorData = {
      ...errorData,
      defaultUserMessage: specificErrorMessage,
      developerMessage: specificErrorMessage,
    };

    console.error("API Error Details:", {
      status: response.status,
      statusText: response.statusText,
      url,
      errorData: JSON.stringify(errorData, null, 2),
      specificErrorMessage,
    });

    throw error;
  }

  const text = await response.text();
  if (!text || text.trim() === "") {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function buildFineractRequest(
  endpoint: string,
  options: FineractRequestInit = {},
  version: "v1" | "v2" = "v1"
): Promise<FineractRequestConfig> {
  const { authMode = "session", ...requestOptions } = options;
  const accessToken = await resolveFineractAuthToken(authMode);
  const fineractTenantId = await getFineractTenantIdFromService();

  const url = `${baseUrl}/fineract-provider/api/${version}${
    endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  }`;

  const headers: Record<string, string> = {
    ...(requestOptions.headers as Record<string, string> | undefined),
    Authorization: `Basic ${accessToken}`,
    "Fineract-Platform-TenantId": fineractTenantId,
  };

  if (!(requestOptions.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  return {
    headers,
    requestOptions,
    url,
  };
}

/**
 * Makes an authenticated request to the Fineract API
 * @param endpoint - The API endpoint to call (without the base URL)
 * @param options - Fetch options
 * @param version - API version (defaults to 'v1')
 * @returns Promise with the response data
 */
export async function fetchFineractAPI(
  endpoint: string,
  options: FineractRequestInit = {},
  version: "v1" | "v2" = "v1"
) {
  const { headers, requestOptions, url } = await buildFineractRequest(
    endpoint,
    options,
    version
  );

  try {
    const response = await performFineractRequest(url, requestOptions, headers);
    return readFineractResponse(response as Response, url);
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}

/**
 * Fineract returns HTTP 200 with a normal-looking CommandProcessingResult even when a
 * maker-checker-enabled command was intercepted and rolled back rather than applied -
 * the only signal is `rollbackTransaction: true`. Callers of actions that touch
 * maker-checker-eligible tasks must check this before treating the call as a success.
 */
export function isFineractCommandPendingApproval(result: unknown): boolean {
  const record = result as { rollbackTransaction?: unknown } | null | undefined;
  return Boolean(record && record.rollbackTransaction === true);
}

/**
 * Extracts the HTTP status Fineract responded with, if the given error came from
 * readFineractResponse. Lets callers distinguish "you don't have permission" (403)
 * from other failures (network errors, validation errors, 500s, ...).
 */
export function getFineractErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as FineractError).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

export async function fetchFineractAPIAsCurrentUser(
  endpoint: string,
  options: RequestInit = {},
  version: "v1" | "v2" = "v1"
) {
  const accessToken = await getCurrentUserAccessToken();
  const fineractTenantId = await getFineractTenantIdFromService();
  const url = `${baseUrl}/fineract-provider/api/${version}${
    endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  }`;

  const strictHeaders: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
    Authorization: `Basic ${accessToken}`,
    "Fineract-Platform-TenantId": fineractTenantId,
  };

  if (!(options.body instanceof FormData)) {
    strictHeaders["Content-Type"] = "application/json";
  }

  try {
    const response = await performFineractRequest(
      url,
      options,
      strictHeaders
    );
    return readFineractResponse(response as Response, url);
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}

/**
 * Fetches client details by external ID (national ID)
 * Uses the /clients/search endpoint (v2) to avoid URL encoding issues with special characters
 * @param externalId - The external ID (national ID) of the client
 * @returns Promise with the client details including email address
 */
export async function fetchClientByExternalId(externalId: string) {
  try {
    // Use the v2 search endpoint with POST to avoid URL encoding issues
    // This handles external IDs with special characters like forward slashes
    const searchPayload = {
      request: { text: externalId },
      page: 0,
      size: 50,
    };

    const searchData = await fetchFineractAPI(
      "/clients/search",
      {
        authMode: "service",
        method: "POST",
        body: JSON.stringify(searchPayload),
      },
      "v2"
    );

    // Check if any clients were found
    if (!searchData.pageItems || searchData.pageItems.length === 0) {
      throw new Error("Client not found with the provided external ID");
    }

    // Find the client that matches the external ID exactly
    // (search might return multiple results)
    const matchingClient = searchData.pageItems.find(
      (client: { externalId?: string }) => client.externalId === externalId
    );

    if (!matchingClient) {
      throw new Error("Client not found with the provided external ID");
    }

    // If we have a client ID, fetch full client details for consistency
    if (matchingClient.id) {
      try {
        const fullClientData = await fetchFineractAPI(
          `/clients/${matchingClient.id}`,
          { authMode: "service" }
        );
        return fullClientData;
      } catch (fetchError) {
        // If fetching full details fails, return the search result
        console.warn(
          "Could not fetch full client details, returning search result:",
          fetchError
        );
        return matchingClient;
      }
    }

    return matchingClient;
  } catch (error) {
    console.error("Error fetching client by external ID:", error);
    throw error;
  }
}

/**
 * Makes an authenticated request to the Fineract API v2
 * @param endpoint - The API endpoint to call (without the base URL)
 * @param options - Fetch options
 * @returns Promise with the response data
 */
export async function fetchFineractAPIV2(
  endpoint: string,
  options: FineractRequestInit = {}
) {
  return fetchFineractAPI(endpoint, options, "v2");
}

/**
 * Client-side API fetcher - uses hardcoded token
 * TODO: Restore token parameter when needed
 */
export function createClientFineractAPI(accessToken?: string) {
  const token = accessToken || SERVICE_TOKEN;
  
  return async (endpoint: string, options: RequestInit = {}) => {
    const fineractTenantId = await getFineractTenantIdFromService();
    
    const url = `${baseUrl}/fineract-provider/api/v1${
      endpoint.startsWith("/") ? endpoint : `/${endpoint}`
    }`;

    const headers = {
      ...options.headers,
      Authorization: `Basic ${token}`,
      "Fineract-Platform-TenantId": fineractTenantId,
      "Content-Type": "application/json",
    };

    try {
      let response: Response;

      // Check if it's HTTP and use different approach
      if (url.startsWith("http://")) {
        // Use standard fetch for HTTP URLs (no agent needed)
        response = await fetch(url, {
          ...options,
          headers,
        });
      } else {
        // Skip SSL verification for local development
        // In production, you should use proper SSL certificates
        const agent = new https.Agent({ rejectUnauthorized: false });

        const fetchOptions: FetchOptionsWithAgent = {
          ...options,
          headers,
          agent,
        };

        response = await fetch(url, fetchOptions);
      }

      if (!response.ok) {
        // Try to get the error response body
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          // If we can't parse JSON, use the status text
          errorData = {
            defaultUserMessage: `HTTP ${response.status}: ${response.statusText}`,
            developerMessage: `HTTP ${response.status}: ${response.statusText}`,
          };
        }

        // Extract the most specific error message from the errors array
        let specificErrorMessage =
          errorData.defaultUserMessage || errorData.developerMessage;

        if (
          errorData.errors &&
          Array.isArray(errorData.errors) &&
          errorData.errors.length > 0
        ) {
          // Use the first error's defaultUserMessage if available, otherwise developerMessage
          const firstError = errorData.errors[0];
          specificErrorMessage =
            firstError.defaultUserMessage ||
            firstError.developerMessage ||
            specificErrorMessage;
        }

        // Create a custom error that includes the backend error data
        const error = new Error(
          `API error: ${response.status} ${response.statusText}`
        );
        const fineractError = error as FineractError;
        fineractError.status = response.status;
        fineractError.errorData = {
          ...errorData,
          defaultUserMessage: specificErrorMessage,
          developerMessage: specificErrorMessage,
        };
        throw error;
      }

      return await response.json();
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  };
}
