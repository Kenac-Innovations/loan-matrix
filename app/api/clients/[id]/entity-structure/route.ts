import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTenantFromHeaders,
  getTenantBySlug,
  extractTenantSlug,
} from "@/lib/tenant-service";

const ENTITY_LEGAL_FORM_ID = 2;

async function resolveTenant(req: NextRequest) {
  try {
    const tenant = await getTenantFromHeaders();
    if (tenant) return tenant;
  } catch {}

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  if (origin) {
    try {
      const t = await getTenantBySlug(
        extractTenantSlug(new URL(origin).hostname)
      );
      if (t) return t;
    } catch {}
  }
  if (referer) {
    try {
      const t = await getTenantBySlug(
        extractTenantSlug(new URL(referer).hostname)
      );
      if (t) return t;
    } catch {}
  }

  const fallbackSlug = process.env.FINERACT_TENANT_ID || "goodfellow";
  const fallback = await prisma.tenant.findFirst({
    where: { slug: fallbackSlug, isActive: true },
    select: { id: true, slug: true, name: true },
  });
  if (!fallback) {
    throw new Error(`Tenant '${fallbackSlug}' not found`);
  }
  return fallback;
}

/**
 * GET /api/clients/[id]/entity-structure
 * id = Fineract client id. Returns Prisma entity stakeholders & bank accounts for Entity leads.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fineractClientId = parseInt(id, 10);
    if (isNaN(fineractClientId)) {
      return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
    }

    const tenant = await resolveTenant(request);

    const lead = await prisma.lead.findFirst({
      where: {
        fineractClientId,
        tenantId: tenant.id,
        legalFormId: ENTITY_LEGAL_FORM_ID,
      },
      select: {
        id: true,
        legalFormId: true,
        entityStakeholders: {
          orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
          include: { proofOfResidenceDocument: true },
        },
        entityBankAccounts: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: "No entity lead data found for this client" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      leadId: lead.id,
      entityStakeholders: lead.entityStakeholders,
      entityBankAccounts: lead.entityBankAccounts,
    });
  } catch (error: any) {
    console.error("entity-structure GET:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load entity structure" },
      { status: 500 }
    );
  }
}
