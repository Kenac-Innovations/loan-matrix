import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import {
  DEFAULT_FEATURES,
  RoleFeatureOverrides,
  TenantFeatures,
} from "@/shared/types/tenant";
import {
  mergeGlobalFeatures,
  normalizeRoleOverrides,
  resolveFeaturesForRoles,
} from "@/lib/feature-flags";

/**
 * GET /api/tenant/features
 *
 * Returns the *effective* feature flags for the current user (global flags
 * + per-role overrides applied). For admin-style consumers the response
 * also includes the raw global flags and the full per-role override map so
 * the management UI can render the configuration as it is stored.
 */
export async function GET(request: NextRequest) {
  try {
    const tenantSlug = extractTenantSlugFromRequest(request);

    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug, isActive: true },
      select: {
        id: true,
        slug: true,
        settings: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({
        features: DEFAULT_FEATURES,
        global: DEFAULT_FEATURES,
        roleFeatureOverrides: {},
        tenantSlug,
        error: "Tenant not found, using defaults",
      });
    }

    const settings = tenant.settings as
      | {
          features?: Partial<TenantFeatures>;
          roleFeatureOverrides?: RoleFeatureOverrides;
        }
      | null;

    const global = mergeGlobalFeatures(settings?.features);
    const roleOverrides = normalizeRoleOverrides(settings?.roleFeatureOverrides);

    // Resolve effective flags for the current session (anonymous → global).
    const session = await getSession();
    const userRoles = Array.isArray(session?.user?.roles)
      ? session!.user!.roles!
          .filter((r) => !r?.disabled)
          .map((r) => r.name as string | null | undefined)
      : [];

    const resolved = resolveFeaturesForRoles(global, roleOverrides, userRoles);

    return NextResponse.json({
      features: resolved.features,
      global: resolved.global,
      roleFeatureOverrides: roleOverrides,
      featureSource: resolved.source,
      tenantSlug: tenant.slug,
    });
  } catch (error) {
    console.error("Error fetching tenant features:", error);
    return NextResponse.json(
      {
        features: DEFAULT_FEATURES,
        global: DEFAULT_FEATURES,
        roleFeatureOverrides: {},
        error: "Failed to fetch tenant features",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tenant/features
 *
 * Body shape — both fields are optional, at least one is required:
 *
 *   {
 *     "features": { ussdLeads: false },          // patch global flags
 *     "roleFeatureOverrides": {                   // patch role overrides
 *       "loan officer": { aiAssistant: false }    // null/{} removes a role
 *     }
 *   }
 *
 * Passing `null` (or an empty object) under a role name clears its overrides.
 */
export async function PUT(request: NextRequest) {
  try {
    const tenantSlug = extractTenantSlugFromRequest(request);
    const body = await request.json();
    const featuresPatch = body?.features as
      | Partial<TenantFeatures>
      | undefined;
    const overridesPatch = body?.roleFeatureOverrides as
      | Record<string, Partial<TenantFeatures> | null>
      | undefined;

    if (!featuresPatch && !overridesPatch) {
      return NextResponse.json(
        {
          error:
            "Provide at least one of: `features` or `roleFeatureOverrides`",
        },
        { status: 400 }
      );
    }

    if (featuresPatch && typeof featuresPatch !== "object") {
      return NextResponse.json(
        { error: "Invalid `features` object" },
        { status: 400 }
      );
    }

    if (overridesPatch && typeof overridesPatch !== "object") {
      return NextResponse.json(
        { error: "Invalid `roleFeatureOverrides` object" },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug, isActive: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const currentSettings = (tenant.settings as Record<string, unknown>) || {};
    const currentGlobal = mergeGlobalFeatures(
      (currentSettings.features as Partial<TenantFeatures> | undefined) ?? null
    );
    const currentOverrides = normalizeRoleOverrides(
      (currentSettings.roleFeatureOverrides as
        | RoleFeatureOverrides
        | undefined) ?? null
    );

    // Merge global patch into existing global.
    const nextGlobal: TenantFeatures = featuresPatch
      ? { ...currentGlobal, ...featuresPatch }
      : currentGlobal;

    // Merge role overrides patch with last-write-wins semantics. A role whose
    // value is `null` or an empty object is removed from the map entirely.
    const nextOverrides: RoleFeatureOverrides = { ...currentOverrides };
    if (overridesPatch) {
      for (const [rawRole, value] of Object.entries(overridesPatch)) {
        const role = rawRole.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
        if (!role) continue;
        if (value == null || Object.keys(value).length === 0) {
          delete nextOverrides[role];
          continue;
        }
        const merged: Partial<TenantFeatures> = {
          ...(nextOverrides[role] ?? {}),
        };
        for (const [k, v] of Object.entries(value)) {
          if (v === undefined) {
            // Explicit `undefined` means "clear this feature override"
            delete (merged as Record<string, unknown>)[k];
          } else if (typeof v === "boolean" && k in DEFAULT_FEATURES) {
            (merged as Record<string, boolean>)[k] = v;
          }
        }
        if (Object.keys(merged).length === 0) {
          delete nextOverrides[role];
        } else {
          nextOverrides[role] = merged;
        }
      }
    }

    const updatedSettings = {
      ...currentSettings,
      features: nextGlobal,
      roleFeatureOverrides: nextOverrides,
    };

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { settings: updatedSettings },
      select: { id: true, slug: true, settings: true },
    });

    const settings = updatedTenant.settings as
      | {
          features?: Partial<TenantFeatures>;
          roleFeatureOverrides?: RoleFeatureOverrides;
        }
      | null;

    const global = mergeGlobalFeatures(settings?.features);
    const roleFeatureOverrides = normalizeRoleOverrides(
      settings?.roleFeatureOverrides
    );

    // Re-resolve for the current session so the caller sees the new effective
    // value immediately.
    const session = await getSession();
    const userRoles = Array.isArray(session?.user?.roles)
      ? session!.user!.roles!
          .filter((r) => !r?.disabled)
          .map((r) => r.name as string | null | undefined)
      : [];

    const resolved = resolveFeaturesForRoles(
      global,
      roleFeatureOverrides,
      userRoles
    );

    return NextResponse.json({
      success: true,
      features: resolved.features,
      global: resolved.global,
      roleFeatureOverrides,
      featureSource: resolved.source,
      tenantSlug: updatedTenant.slug,
    });
  } catch (error) {
    console.error("Error updating tenant features:", error);
    return NextResponse.json(
      { error: "Failed to update tenant features" },
      { status: 500 }
    );
  }
}
