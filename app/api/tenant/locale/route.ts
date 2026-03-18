import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTenantSlugFromRequest } from "@/lib/tenant-service";

const DEFAULT_LOCALE = {
  countryCode: "+260",
  countryName: "Zambia",
  countryIso: "ZM",
  phoneDigits: 9,
  phoneFormat: "XX XXX XXXX",
  phonePlaceholder: "977123456",
};

/**
 * GET /api/tenant/locale
 * Returns locale settings (country code, country name) for the current tenant.
 * Settings are stored in tenant.settings.locale JSON field.
 */
export async function GET(request: NextRequest) {
  try {
    const tenantSlug = extractTenantSlugFromRequest(request);

    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug, isActive: true },
      select: {
        slug: true,
        settings: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({
        ...DEFAULT_LOCALE,
        tenantSlug,
      });
    }

    const settings = tenant.settings as any;
    const locale = {
      ...DEFAULT_LOCALE,
      ...settings?.locale,
    };

    return NextResponse.json({
      ...locale,
      tenantSlug: tenant.slug,
    });
  } catch (error) {
    console.error("Error fetching tenant locale:", error);
    return NextResponse.json(DEFAULT_LOCALE, { status: 500 });
  }
}
