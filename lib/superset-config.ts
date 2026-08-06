export type SupersetRole = "viewer" | "creator";

export interface ResolvedTenantSupersetConfig {
  enabled: boolean;
  baseUrl: string | null;
  creatorUsernames: string[];
}

export function isTenantSupersetRequestedEnabled(settings: unknown): boolean {
  if (!settings || typeof settings !== "object") return false;
  const root = settings as Record<string, unknown>;
  if (!root.superset || typeof root.superset !== "object") return false;
  return (root.superset as Record<string, unknown>).enabled === true;
}

function normalizeCreatorUsernames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((username): username is string => typeof username === "string")
        .map((username) => username.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function normalizeHttpsBaseUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getTenantSupersetConfig(
  settings: unknown
): ResolvedTenantSupersetConfig {
  const root =
    settings && typeof settings === "object"
      ? (settings as Record<string, unknown>)
      : {};
  const superset =
    root.superset && typeof root.superset === "object"
      ? (root.superset as Record<string, unknown>)
      : {};
  const baseUrl = normalizeHttpsBaseUrl(superset.baseUrl);

  return {
    enabled: superset.enabled === true && baseUrl !== null,
    baseUrl,
    creatorUsernames: normalizeCreatorUsernames(superset.creatorUsernames),
  };
}

export function resolveSupersetRole(
  username: string | null | undefined,
  creatorUsernames: string[]
): SupersetRole {
  const normalizedUsername = username?.trim().toLowerCase();
  if (!normalizedUsername) return "viewer";

  return creatorUsernames.includes(normalizedUsername) ? "creator" : "viewer";
}
