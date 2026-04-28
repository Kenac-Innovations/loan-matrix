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
  skipAffordabilityForCompanies: false,
  clientSelfieOptionalForCompanies: false,
  clientSelfieOptionalForPerson: false,
  createLeadSignaturesOnContractOptional: false,
  documentsOptional: false,
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
    const skipAffordabilityForCompanies =
      settings?.features?.skipAffordabilityForCompanies ??
      settings?.skipAffordabilityForCompanies ??
      false;
    const clientSelfieOptionalForCompanies =
      settings?.features?.clientSelfieOptionalForCompanies ??
      settings?.clientSelfieOptionalForCompanies ??
      false;
    const clientSelfieOptionalForPerson =
      settings?.features?.clientSelfieOptionalForPerson ??
      settings?.clientSelfieOptionalForPerson ??
      false;
    const createLeadSignaturesOnContractOptional =
      settings?.features?.createLeadSignaturesOnContractOptional ??
      settings?.createLeadSignaturesOnContractOptional ??
      false;
    const documentsOptional =
      settings?.features?.documentsOptional ??
      settings?.documentsOptional ??
      false;
    const locale = {
      ...DEFAULT_LOCALE,
      ...settings?.locale,
      skipAffordabilityForCompanies: !!skipAffordabilityForCompanies,
      clientSelfieOptionalForCompanies: !!clientSelfieOptionalForCompanies,
      clientSelfieOptionalForPerson: !!clientSelfieOptionalForPerson,
      createLeadSignaturesOnContractOptional:
        !!createLeadSignaturesOnContractOptional,
      documentsOptional: !!documentsOptional,
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
