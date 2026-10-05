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
import { getFineractTenantId } from "./fineract-tenant-service";
import { parseOrgCurrencyForWrite } from "./currency-contract";
import type { OrgCurrencyForWrite } from "./currency-contract";

export { parseOrgCurrencyForWrite } from "./currency-contract";
export type { OrgCurrencyForWrite } from "./currency-contract";

type CurrencyCacheEntry = { code: string; rawCode: string; expiresAt: number };
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Org currency cache keyed by Fineract tenant ID. One server process serves
 * many tenants, so a single shared entry leaked one tenant's currency into
 * another tenant's requests (e.g. Rulethu cashier balances queried in ZMK).
 */
export function createOrgCurrencyResolver(deps: {
  getTenantKey: () => Promise<string>;
  fetchCurrencies: () => Promise<unknown>;
  now?: () => number;
}) {
  const cache = new Map<string, CurrencyCacheEntry>();
  const now = deps.now ?? Date.now;

  /** Returns null when Fineract cannot be reached. */
  return async function resolveOrgCurrency(): Promise<CurrencyCacheEntry | null> {
    let key: string | null = null;
    try {
      key = await deps.getTenantKey();
    } catch {
      key = null;
    }

    const cached = key ? cache.get(key) : undefined;
    if (cached && now() < cached.expiresAt) {
      return cached;
    }

    try {
      const data = (await deps.fetchCurrencies()) as {
        selectedCurrencyOptions?: Array<{ code?: string }>;
        currencyOptions?: Array<{ code?: string }>;
      } | null;
      const currencies =
        data?.selectedCurrencyOptions || data?.currencyOptions || [];

      if (currencies.length > 0) {
        const rawCode = currencies[0].code || "USD";
        const entry: CurrencyCacheEntry = {
          code: normalizeCode(rawCode),
          rawCode,
          expiresAt: now() + CACHE_TTL_MS,
        };
        if (key) cache.set(key, entry);
        return entry;
      }
    } catch (err) {
      console.error("Failed to fetch org default currency from Fineract:", err);
    }

    return null;
  };
}

const resolveOrgCurrency = createOrgCurrencyResolver({
  getTenantKey: getFineractTenantId,
  fetchCurrencies: () => fetchFineractAPI("/currencies"),
});

/**
 * Normalize currency code - converts deprecated ZMK to ZMW.
 * Fineract may return ZMK (old Zambian Kwacha code pre-2013 redenomination).
 */
function normalizeCode(code: string): string {
  if (code.toUpperCase() === "ZMK") return "ZMW";
  return code;
}

/**
 * Resolve the selected organization currency for a write operation.
 *
 * Unlike the read/display helpers below, this deliberately does not use the
 * permissive USD fallback or a stale cache. A write must stop if Fineract
 * cannot identify the tenant's selected currency.
 */
export async function getOrgCurrencyForWrite(): Promise<OrgCurrencyForWrite> {
  let data: unknown;

  try {
    data = await fetchFineractAPI("/currencies");
  } catch (error) {
    throw new Error("Unable to resolve the selected organization currency", {
      cause: error,
    });
  }

  return parseOrgCurrencyForWrite(data);
}

/**
 * Get the organization's default currency code from Fineract.
 * Results are cached for 5 minutes to avoid excessive API calls.
 * Falls back to "USD" if the Fineract call fails.
 */
export async function getOrgDefaultCurrencyCode(): Promise<string> {
  return (await resolveOrgCurrency())?.code || "USD";
}

/**
 * Get the raw (un-normalized) currency code as returned by Fineract.
 * Fineract APIs expect the raw code (e.g. "ZMK" not "ZMW") in query params.
 */
export async function getOrgRawCurrencyCode(): Promise<string> {
  return (await resolveOrgCurrency())?.rawCode || "USD";
}

/**
 * Convert a display-facing currency code back into the raw code Fineract
 * expects for writes such as journal entries.
 */
export async function toFineractCurrencyCode(
  currencyCode?: string | null
): Promise<string> {
  const requestedCode = (currencyCode || "").trim().toUpperCase();
  const rawOrgCode = (await getOrgRawCurrencyCode()).trim().toUpperCase();
  const normalizedOrgCode = normalizeCode(rawOrgCode).toUpperCase();

  if (!requestedCode) {
    return rawOrgCode || "USD";
  }

  if (requestedCode === normalizedOrgCode) {
    return rawOrgCode;
  }

  if (requestedCode === "ZMW") {
    return "ZMK";
  }

  return requestedCode;
}
