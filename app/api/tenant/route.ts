import { NextResponse } from "next/server";
import { getTenantFromHeaders } from "@/lib/tenant-service";

/**
 * GET /api/tenant
 * Returns the current tenant info (from host/headers), including logo URL when set.
 */
export async function GET() {
  const tenant = await getTenantFromHeaders();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  const settings =
    tenant.settings && typeof tenant.settings === "object"
      ? ({ ...(tenant.settings as unknown as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : null;

  if (settings) {
    delete settings.usesMFA;
    delete settings.mfaChannels;
    delete settings.mfaMaxAttempts;

    const features =
      settings.features &&
      typeof settings.features === "object" &&
      !Array.isArray(settings.features)
        ? ({ ...(settings.features as Record<string, unknown>) } as Record<
            string,
            unknown
          >)
        : null;

    if (features) {
      delete features.usesMFA;
      delete features.mfaChannels;
      delete features.mfaMaxAttempts;
      settings.features = features;
    }
  }

  return NextResponse.json({
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    logoFileUrl: tenant.logoFileUrl ?? null,
    logoLinkId: tenant.logoLinkId ?? null,
    settings,
  });
}
