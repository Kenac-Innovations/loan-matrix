import { NextRequest, NextResponse } from "next/server";
import { getTenantFromHeaders } from "@/lib/tenant-service";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/tenant/contract-template?slug=full-loan
 * Returns the loan contract template HTML for the current tenant.
 * Used on the Contracts tab so omama (or other tenants) can have their own template.
 */
export async function GET(request: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const slug =
      request.nextUrl?.searchParams?.get("slug") ?? "full-loan";

    const template = await prisma.loanContractTemplate.findUnique({
      where: {
        tenantId_slug: { tenantId: tenant.id, slug },
      },
    });

    if (!template) {
      return NextResponse.json({ html: null, name: null });
    }

    return NextResponse.json({
      html: template.content,
      name: template.name,
      slug: template.slug,
    });
  } catch (error) {
    console.error("Error fetching contract template:", error);
    return NextResponse.json(
      { error: "Failed to fetch contract template" },
      { status: 500 }
    );
  }
}
