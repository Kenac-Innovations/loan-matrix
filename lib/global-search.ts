export type SearchResultType = "client" | "loan" | "savings";

export const SEARCH_TYPE_FILTERS = ["all", "clients", "loans", "savings"] as const;

export type SearchTypeFilter = (typeof SEARCH_TYPE_FILTERS)[number];

// Fineract `resource` values per filter, mirroring the Mifos search options.
// Groups, centers and shares are excluded because they have no detail pages.
export const SEARCH_RESOURCES: Record<SearchTypeFilter, string> = {
  all: "clients,clientIdentifiers,loans,savings",
  clients: "clients,clientIdentifiers",
  loans: "loans",
  savings: "savings",
};

export const MAX_SEARCH_RESULTS = 200;

export interface SearchResult {
  id: number;
  type: SearchResultType;
  name: string;
  accountNo: string | null;
  externalId: string | null;
  clientId: number;
  clientName: string | null;
  status: string | null;
  href: string;
}

export interface SearchResponse {
  results: SearchResult[];
  truncated: boolean;
}

type RawSearchItem = Record<string, unknown>;

function asRecord(value: unknown): RawSearchItem | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RawSearchItem)
    : null;
}

function toId(value: unknown): number | null {
  const id = typeof value === "string" ? Number(value) : value;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

function toText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return null;
}

export function buildSearchHref(
  type: SearchResultType,
  clientId: number,
  id: number
): string {
  if (type === "loan") return `/clients/${clientId}/loans/${id}`;
  if (type === "savings") return `/clients/${clientId}/savings/${id}`;
  return `/clients/${clientId}`;
}

function isClientIdentifier(item: RawSearchItem): boolean {
  return toText(item.entityType)?.toUpperCase() === "CLIENTIDENTIFIER";
}

function mapSearchItem(item: RawSearchItem): SearchResult | null {
  const entityType = toText(item.entityType)?.toUpperCase();
  const entityId = toId(item.entityId);
  const parentId = toId(item.parentId);
  const entityName = toText(item.entityName);
  const parentName = toText(item.parentName);
  const accountNo = toText(item.entityAccountNo);
  const externalId = toText(item.entityExternalId);
  const status = toText(asRecord(item.entityStatus)?.value);

  if (entityType === "CLIENT") {
    if (entityId === null) return null;
    return {
      id: entityId,
      type: "client",
      name: entityName ?? `Client #${entityId}`,
      accountNo,
      externalId,
      clientId: entityId,
      clientName: null,
      status,
      href: buildSearchHref("client", entityId, entityId),
    };
  }

  if (entityType === "CLIENTIDENTIFIER") {
    // Identifier hits point at the parent client; entityName is the document key.
    if (parentId === null) return null;
    return {
      id: parentId,
      type: "client",
      name: parentName ?? `Client #${parentId}`,
      accountNo: null,
      externalId: null,
      clientId: parentId,
      clientName: null,
      status: null,
      href: buildSearchHref("client", parentId, parentId),
    };
  }

  if (entityType === "LOAN" || entityType === "SAVING") {
    // Loan and savings hits need the owning client to build their detail href.
    if (entityId === null || parentId === null) return null;
    const type: SearchResultType = entityType === "LOAN" ? "loan" : "savings";
    return {
      id: entityId,
      type,
      name: entityName ?? accountNo ?? `Account #${entityId}`,
      accountNo,
      externalId,
      clientId: parentId,
      clientName: parentName,
      status,
      href: buildSearchHref(type, parentId, entityId),
    };
  }

  return null;
}

/**
 * Converts a raw Fineract /search payload (bare array or { pageItems }) into
 * deduped SearchResult rows. Unsupported entity types are dropped. Client
 * identifier hits become client rows, and are placed after direct client hits
 * so the direct hit wins the dedupe.
 */
export function normalizeSearchResults(raw: unknown): SearchResult[] {
  const rawItems: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray(asRecord(raw)?.pageItems)
      ? (asRecord(raw)?.pageItems as unknown[])
      : [];

  const items = rawItems
    .map(asRecord)
    .filter((item): item is RawSearchItem => item !== null);

  const ordered = [
    ...items.filter((item) => !isClientIdentifier(item)),
    ...items.filter(isClientIdentifier),
  ];

  const seen = new Set<string>();
  const results: SearchResult[] = [];

  for (const item of ordered) {
    const result = mapSearchItem(item);
    if (!result) continue;

    const key = `${result.type}:${result.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(result);
  }

  return results;
}

export function limitSearchResults(results: SearchResult[]): SearchResponse {
  return {
    results: results.slice(0, MAX_SEARCH_RESULTS),
    truncated: results.length > MAX_SEARCH_RESULTS,
  };
}
