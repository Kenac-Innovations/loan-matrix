import { getSession } from "./auth";
import { getFineractTenantId } from "./fineract-tenant-service";

const API_BASE_URL = "http://10.10.0.143:8443/fineract-provider/api/v1";

/**
 * Makes an authenticated request to the Fineract API
 * @param endpoint - The API endpoint to call (without the base URL)
 * @param options - Fetch options
 * @returns Promise with the response data
 */
export async function fetchFineractAPI(
  endpoint: string,
  options: RequestInit = {}
) {
  const session = await getSession();
  const accessToken = session?.accessToken as string | undefined;
  const fineractTenantId = await getFineractTenantId();

  if (!accessToken) {
    throw new Error("No access token available");
  }

  const url = `${API_BASE_URL}${
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
        errorData: errorData,
        specificErrorMessage: specificErrorMessage,
      });

      throw error;
    }

    return await response.json();
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
}

/**
 * Fetches client details by external ID (national ID)
 * @param externalId - The external ID (national ID) of the client
 * @returns Promise with the client details including email address
 */
export async function fetchClientByExternalId(externalId: string) {
  try {
    const data = await fetchFineractAPI(`/clients/external-id/${externalId}`);
    return data;
  } catch (error) {
    console.error("Error fetching client by external ID:", error);
    throw error;
  }
}

/**
 * Client-side API fetcher that includes the access token from the auth context
 */
export function createClientFineractAPI(accessToken: string) {
  return async (endpoint: string, options: RequestInit = {}) => {
    if (!accessToken) {
      throw new Error("No access token available");
    }

    const url = `${API_BASE_URL}${
      endpoint.startsWith("/") ? endpoint : `/${endpoint}`
    }`;

    const headers = {
      ...options.headers,
      Authorization: `Basic ${accessToken}`,
      "Fineract-Platform-TenantId": "goodfellow",
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
