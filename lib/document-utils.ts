/**
 * Document URL handling for preview and download.
 * Normalizes stored values (full URL, path, or ID) to a canonical download URL.
 */

/**
 * Known path prefixes to strip when extracting document ID from URLs/paths.
 * Document service paths are typically /api/documents/{id} or similar.
 */
const DOCUMENT_PATH_PREFIXES = [
  /^https?:\/\/[^/]+\/api\/documents\//i,
  /^\/api\/documents\//,
];

/**
 * Extract document ID from a value that might be a full URL, path, or raw ID.
 * Strips query/hash and known prefixes; returns the document ID (e.g. UUID or path segment after documents/).
 */
export function extractDocumentId(value: string | null | undefined): string | null {
  if (value == null || typeof value !== "string") return null;
  let s = value.trim();
  if (!s) return null;
  // Remove hash and query
  const hashIdx = s.indexOf("#");
  if (hashIdx !== -1) s = s.slice(0, hashIdx);
  const queryIdx = s.indexOf("?");
  if (queryIdx !== -1) s = s.slice(0, queryIdx);
  s = s.trim();
  if (!s) return null;
  // Strip known prefixes
  for (const prefix of DOCUMENT_PATH_PREFIXES) {
    if (prefix.test(s)) {
      s = s.replace(prefix, "");
      break;
    }
  }
  // Also handle document-service base URL if passed as env (e.g. http://localhost:8080)
  const baseUrl =
    typeof process !== "undefined" && process.env?.DOCUMENT_SERVICE_BASE_URL
      ? process.env.DOCUMENT_SERVICE_BASE_URL
      : typeof process !== "undefined" && process.env?.DOCUMENT_SERVICE_URL
        ? process.env.DOCUMENT_SERVICE_URL
        : "";
  if (baseUrl) {
    const base = baseUrl.replace(/\/$/, "");
    const basePrefix = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/api\\/documents\\/`, "i");
    if (basePrefix.test(s)) {
      s = s.replace(basePrefix, "");
    }
  }
  s = s.replace(/^\/+/, "");
  return s || null;
}

/**
 * Build the canonical download URL for a document.
 * - In the browser we use the same-origin proxy /api/documents/{id} to avoid CORS.
 * - On the server you can pass baseUrl to get the full document-service URL.
 */
export function buildDocumentDownloadUrl(
  raw: string | null | undefined,
  options?: { baseUrl?: string }
): string {
  const id = extractDocumentId(raw);
  if (!id) return "";

  const baseUrl = options?.baseUrl;
  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, "")}/api/documents/${id}`;
  }

  // Client / default: use app proxy so we don't need document service URL in the browser
  return `/api/documents/${id}`;
}
