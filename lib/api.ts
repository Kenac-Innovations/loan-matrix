import { getFineractTenantId as getFineractTenantIdFromService } from "./fineract-tenant-service";

// Re-export for convenience
export { getFineractTenantIdFromService as getFineractTenantId };

// Get base URL from environment variable with fallback
const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

// Hardcoded service token for all API calls
// TODO: Move to environment variable
const SERVICE_TOKEN = "bWlmb3M6cGFzc3dvcmQ=";

/**
 * Get access token - returns hardcoded service token
 * TODO: Restore session-based token when needed
 */
export async function getAccessToken(): Promise<string> {
  return SERVICE_TOKEN;
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
  options: RequestInit = {},
  version: "v1" | "v2" = "v1"
) {
  const accessToken = await getAccessToken();
  const fineractTenantId = await getFineractTenantIdFromService();

  const url = `${baseUrl}/fineract-provider/api/${version}${
    endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  }`;

  const headers: any = {
    ...options.headers,
    Authorization: `Basic ${accessToken}`,
    "Fineract-Platform-TenantId": fineractTenantId,
  };

  // Only set Content-Type to application/json if body is NOT FormData
  // For FormData, let the browser set the correct Content-Type with boundary
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  try {
    let response;

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
      const https = require("https");
      const agent = new https.Agent({ rejectUnauthorized: false });

      response = await fetch(url, {
        ...options,
        headers,
        //@ts-ignore
        agent,
      });
    }

    if (!response.ok) {
      // Try to get the error response body
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        // If we can't parse JSON, use the status text
        errorData = {
          defaultUserMessage: `HTTP ${response.status}: ${response.statusText}`,
          developerMessage: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Handle empty response bodies (common with 403/401 errors)
      if (!errorData || Object.keys(errorData).length === 0) {
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
      (error as any).status = response.status;
      (error as any).errorData = {
        ...errorData,
        defaultUserMessage: specificErrorMessage,
        developerMessage: specificErrorMessage,
      };

      console.error("API Error Details:", {
        status: response.status,
        statusText: response.statusText,
        url: url,
        errorData: JSON.stringify(errorData, null, 2),
        specificErrorMessage: specificErrorMessage,
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
      (client: any) => client.externalId === externalId
    );

    if (!matchingClient) {
      throw new Error("Client not found with the provided external ID");
    }

    // If we have a client ID, fetch full client details for consistency
    if (matchingClient.id) {
      try {
        const fullClientData = await fetchFineractAPI(
          `/clients/${matchingClient.id}`
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
  options: RequestInit = {}
) {
  return fetchFineractAPI(endpoint, options, "v2");
}

/**
 * Client-side API fetcher - uses hardcoded token
 * TODO: Restore token parameter when needed
 */
export function createClientFineractAPI(accessToken?: string) {
  const token = SERVICE_TOKEN; // Use hardcoded token for now
  
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
      let response;

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
        const https = require("https");
        const agent = new https.Agent({ rejectUnauthorized: false });

        response = await fetch(url, {
          ...options,
          headers,
          //@ts-ignore
          agent,
        });
      }

      if (!response.ok) {
        // Try to get the error response body
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
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
        (error as any).status = response.status;
        (error as any).errorData = {
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
