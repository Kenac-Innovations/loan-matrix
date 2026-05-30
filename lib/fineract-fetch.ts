"use client";

import { parseFineractErrorResponse } from "./fineract-error";

/**
 * Fetch wrapper for Fineract API calls (/api/fineract/*).
 * When the response is not ok, parses the error body and throws an Error
 * with the user-friendly defaultUserMessage from the Fineract errors array.
 *
 * @param url - Full URL (e.g. /api/fineract/loans/47/transactions?command=close)
 * @param options - Standard fetch options
 * @returns Response on success
 * @throws Error with user-friendly message on failure
 */
export async function fineractFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const responseText = await response.text();
    const userMessage = parseFineractErrorResponse(responseText);
    throw new Error(userMessage);
  }

  return response;
}
