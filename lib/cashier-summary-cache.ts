/**
 * Short-lived, per-process cache for Fineract cashier summaryandtransactions.
 *
 * That endpoint is expensive on the Fineract side (it unions every loan/savings
 * transaction the cashier's user created in the allocation window), and the
 * teller screens used to request the same cashier several times in parallel.
 * Concurrent identical requests share one in-flight promise, and a settled
 * result is reused for a few seconds. Writes against a cashier must call
 * invalidateCashierSummary so the next read goes back to Fineract.
 */

export const CASHIER_SUMMARY_TTL_MS = 5_000;

type Entry = { promise: Promise<unknown>; expiresAt: number };

const entries = new Map<string, Entry>();

export type CashierSummaryKeyParts = {
  scope: string; // tenant + caller identity, so users never share results; must not contain "|"
  tellerId: number;
  cashierId: number;
  currencyCode: string;
  offset?: number;
  limit?: number;
};

/** Cache scope for a tenant + caller credential, without keeping the credential itself in memory keys. */
export function cashierSummaryScope(tenantId: string, credential: string): string {
  // cyrb53: small non-cryptographic hash; only used to separate callers, not for security.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < credential.length; i++) {
    const ch = credential.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  return `${tenantId.replace(/\|/g, "_")}:${hash}`;
}

export function cashierSummaryKey(parts: CashierSummaryKeyParts): string {
  return [
    parts.scope,
    parts.tellerId,
    parts.cashierId,
    parts.currencyCode,
    parts.offset ?? "",
    parts.limit ?? "",
  ].join("|");
}

export function getOrLoadCashierSummary<T>(
  parts: CashierSummaryKeyParts,
  load: () => Promise<T>,
  now: () => number = Date.now
): Promise<T> {
  const key = cashierSummaryKey(parts);
  const existing = entries.get(key);
  if (existing && existing.expiresAt > now()) {
    return existing.promise as Promise<T>;
  }

  const promise = load();
  // Until it settles the entry never expires, so concurrent callers share it.
  const entry: Entry = { promise, expiresAt: Number.POSITIVE_INFINITY };
  entries.set(key, entry);
  promise.then(
    () => {
      if (entries.get(key) === entry) entry.expiresAt = now() + CASHIER_SUMMARY_TTL_MS;
    },
    () => {
      // Never cache failures.
      if (entries.get(key) === entry) entries.delete(key);
    }
  );
  return promise;
}

/** Drop cached summaries for one cashier, or every cashier of the teller when cashierId is omitted. */
export function invalidateCashierSummary(tellerId: number, cashierId?: number): void {
  for (const key of entries.keys()) {
    // Across all scopes: over-invalidating another tenant's entry only costs one refetch.
    const [, keyTellerId, keyCashierId] = key.split("|");
    if (keyTellerId !== String(tellerId)) continue;
    if (cashierId == null || keyCashierId === String(cashierId)) entries.delete(key);
  }
}

export function clearCashierSummaryCache(): void {
  entries.clear();
}
