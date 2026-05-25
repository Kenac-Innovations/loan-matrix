/**
 * Feature flag resolution — server-side.
 *
 * The tenant stores a global feature map (`tenant.settings.features`) and an
 * optional per-role override map (`tenant.settings.roleFeatureOverrides`).
 * This module resolves the *effective* feature set for a given list of
 * roles by layering overrides on top of the global defaults.
 *
 * Semantics ("most-permissive-wins"):
 *
 *   effective[f] = DEFAULT_FEATURES[f]
 *   effective[f] = tenant.features[f]        (if defined)
 *   effective[f] |= any override.roles[f]    (any role that enables → wins)
 *
 *   If no role overrides `f` but at least one of the user's roles is in the
 *   overrides map and that role's value for `f` is `false`, that disables
 *   the feature only when no other role re-enables it. In other words: a
 *   user is granted a feature if either the global flag is on AND no role
 *   they hold explicitly disables it, OR any of their roles explicitly
 *   enables it.
 *
 * This avoids the footgun of accidentally hiding a feature from an admin
 * just because they happen to *also* hold a more restricted role.
 */

import {
  DEFAULT_FEATURES,
  RoleFeatureOverrides,
  TenantFeatures,
} from "@/shared/types/tenant";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a role name so user-typed values match what's stored. Mirrors
 * the normalization used in `lib/lead-access.ts` so the two stay in sync.
 */
export function normalizeRoleName(name?: string | null): string {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Merge global features with `DEFAULT_FEATURES` so callers always get a
 * fully-populated `TenantFeatures` object even when the tenant predates a
 * newly-added flag.
 */
export function mergeGlobalFeatures(
  raw: Partial<TenantFeatures> | null | undefined
): TenantFeatures {
  return { ...DEFAULT_FEATURES, ...(raw ?? {}) };
}

/**
 * Sanitize overrides keyed by raw role name into a normalized map keyed by
 * normalized role name. Discards empty overrides so we don't bloat the
 * stored JSON.
 */
export function normalizeRoleOverrides(
  raw: RoleFeatureOverrides | null | undefined
): RoleFeatureOverrides {
  if (!raw) return {};
  const out: RoleFeatureOverrides = {};
  for (const [rawName, overrides] of Object.entries(raw)) {
    const name = normalizeRoleName(rawName);
    if (!name) continue;
    if (!overrides || Object.keys(overrides).length === 0) continue;
    // Filter to known feature keys so we don't store bogus values.
    const cleaned: Partial<TenantFeatures> = {};
    for (const [key, value] of Object.entries(overrides)) {
      if (typeof value === "boolean" && key in DEFAULT_FEATURES) {
        (cleaned as Record<string, boolean>)[key] = value;
      }
    }
    if (Object.keys(cleaned).length > 0) {
      // If the same role is provided twice with different casings, merge
      // last-write-wins for individual keys.
      out[name] = { ...(out[name] ?? {}), ...cleaned };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Core resolver
// ---------------------------------------------------------------------------

export interface ResolvedFeatureInfo {
  /** Final effective flags for the user. */
  features: TenantFeatures;
  /** Global flags before overrides — useful for diagnostics. */
  global: TenantFeatures;
  /** Per-feature reason for the effective value (`global` or role name). */
  source: Record<keyof TenantFeatures, "global" | "role-override">;
}

/**
 * Resolve effective feature flags for a list of role names.
 */
export function resolveFeaturesForRoles(
  globalFeatures: Partial<TenantFeatures> | null | undefined,
  overrides: RoleFeatureOverrides | null | undefined,
  roleNames: Array<string | null | undefined>
): ResolvedFeatureInfo {
  const global = mergeGlobalFeatures(globalFeatures);
  const normalizedOverrides = normalizeRoleOverrides(overrides);
  const userRoles = (roleNames || [])
    .map(normalizeRoleName)
    .filter((n) => n.length > 0);

  // Pull together the overrides that apply to this user.
  const relevantOverrides = userRoles
    .map((r) => ({ role: r, overrides: normalizedOverrides[r] }))
    .filter((entry): entry is { role: string; overrides: Partial<TenantFeatures> } =>
      entry.overrides != null
    );

  const features = { ...global } as TenantFeatures;
  const source: Record<string, "global" | "role-override"> = {};
  for (const key of Object.keys(global) as Array<keyof TenantFeatures>) {
    source[key] = "global";
  }

  if (relevantOverrides.length === 0) {
    return {
      features,
      global,
      source: source as ResolvedFeatureInfo["source"],
    };
  }

  // Apply most-permissive-wins:
  //   - If any role overrides a feature to `true`  -> enable.
  //   - Else if any role overrides a feature to `false` AND global is true -> disable.
  //   - Otherwise keep global.
  for (const key of Object.keys(global) as Array<keyof TenantFeatures>) {
    let sawTrue = false;
    let sawFalse = false;
    for (const { overrides } of relevantOverrides) {
      const v = overrides[key];
      if (v === true) sawTrue = true;
      else if (v === false) sawFalse = true;
    }
    if (sawTrue) {
      features[key] = true;
      source[key] = "role-override";
    } else if (sawFalse) {
      features[key] = false;
      source[key] = "role-override";
    }
  }

  return {
    features,
    global,
    source: source as ResolvedFeatureInfo["source"],
  };
}
