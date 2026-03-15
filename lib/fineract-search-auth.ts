import { getFineractTenantId } from "./fineract-tenant-service";

/**
 * Service account authentication for Fineract search operations.
 * Uses a dedicated service account with broader search permissions
 * instead of the logged-in user's token.
 */

// Service account token for search operations
// TODO: Move to environment variable (FINERACT_SEARCH_TOKEN)
const SEARCH_SERVICE_TOKEN = "bWlmb3M6cGFzc3dvcmQ=";

// Base URL for Fineract API
const baseUrl = process.env.FINERACT_BASE_URL || "http://10.10.0.143:8443";

/**
 * Get the authentication token for search operations.
 * Uses a service account with broader permissions for client/loan searches.
 */
export function getSearchAuthToken(): string {
  return SEARCH_SERVICE_TOKEN;
}

/**
 * Get headers for Fineract search API calls.
 * Uses service account auth instead of user auth.
 */
export function getSearchHeaders(tenantId: string): Record<string, string> {
  return {
    Authorization: `Basic ${getSearchAuthToken()}`,
    "Fineract-Platform-TenantId": tenantId,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Make a search API call to Fineract using the service account.
 * @param endpoint - The API endpoint (e.g., "/clients/search")
 * @param options - Fetch options
 * @param version - API version (defaults to 'v1')
 */
export async function fetchFineractSearch(
  endpoint: string,
  options: RequestInit = {},
  version: "v1" | "v2" = "v1"
) {
  const fineractTenantId = await getFineractTenantId();
  
  const url = `${baseUrl}/fineract-provider/api/${version}${
    endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  }`;

  const headers = getSearchHeaders(fineractTenantId);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          defaultUserMessage: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const error = new Error(`API error: ${response.status} ${response.statusText}`);
      (error as any).status = response.status;
      (error as any).errorData = errorData;
      throw error;
    }

    return await response.json();
  } catch (error) {
    console.error("Search API request failed:", error);
    throw error;
  }
}
