/**
 * Server-side currency utilities.
 * 
 * Provides a cached organization default currency code from Fineract.
 * Use this in API routes, server actions, and server components where
 * the React useCurrency() hook is not available.
 * 
 * For React client components, use the useCurrency() hook from
 * @/contexts/currency-context instead.
 */

import { fetchFineractAPI } from "./api";

let cachedCurrencyCode: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Normalize currency code - converts deprecated ZMK to ZMW.
 * Fineract may return ZMK (old Zambian Kwacha code pre-2013 redenomination).
 */
function normalizeCode(code: string): string {
  if (code.toUpperCase() === "ZMK") return "ZMW";
  return code;
}

/**
 * Get the organization's default currency code from Fineract.
 * Results are cached for 5 minutes to avoid excessive API calls.
 * Falls back to "USD" if the Fineract call fails.
 */
export async function getOrgDefaultCurrencyCode(): Promise<string> {
  if (cachedCurrencyCode && Date.now() < cacheExpiry) {
    return cachedCurrencyCode;
  }

  try {
    const data = await fetchFineractAPI("/currencies");
    const currencies: any[] =
      data.selectedCurrencyOptions || data.currencyOptions || [];

    if (currencies.length > 0) {
      const code = normalizeCode(currencies[0].code || "USD");
      cachedCurrencyCode = code;
      cacheExpiry = Date.now() + CACHE_TTL_MS;
      return code;
    }
  } catch (err) {
    console.error("Failed to fetch org default currency from Fineract:", err);
  }

  return "USD";
}

/**
 * Synchronous fallback that returns the last cached value.
 * Returns undefined if the cache is empty (call getOrgDefaultCurrencyCode first).
 */
export function getCachedCurrencyCode(): string | undefined {
  return cachedCurrencyCode ?? undefined;
}
