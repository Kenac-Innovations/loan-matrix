import { getSession } from "next-auth/react";

const API_BASE_URL = "https://localhost:8443/fineract-provider/api/v1";

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

  if (!accessToken) {
    throw new Error("No access token available");
  }

  const url = `${API_BASE_URL}${
    endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  }`;

  const headers = {
    ...options.headers,
    Authorization: `Basic ${accessToken}`,
    "Fineract-Platform-TenantId": "default",
    "Content-Type": "application/json",
  };

  // Skip SSL verification for local development
  // In production, you should use proper SSL certificates
  const https = require("https");
  const agent = new https.Agent({ rejectUnauthorized: false });

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      //@ts-ignore
      agent,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("API request failed:", error);
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
      "Fineract-Platform-TenantId": "default",
      "Content-Type": "application/json",
    };

    // Skip SSL verification for local development
    // In production, you should use proper SSL certificates
    const https = require("https");
    const agent = new https.Agent({ rejectUnauthorized: false });

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        //@ts-ignore
        agent,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  };
}
