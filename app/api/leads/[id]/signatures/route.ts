import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug, extractTenantSlugFromRequest } from "@/lib/tenant-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: leadId } = params;
    console.log("Saving signature metadata for leadId:", leadId);

    const data = await request.json();
    console.log("Received signature metadata:", data);

    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      console.error("Tenant not found for slug:", tenantSlug);
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Find lead without tenant filter (for compatibility)
    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
    });

    if (!lead) {
      console.error("Lead not found with ID:", leadId);
      return NextResponse.json(
        { success: false, error: "Lead not found" },
        { status: 404 }
      );
    }

    // Warn if tenant mismatch (but don't block)
    if (lead.tenantId !== tenant.id) {
      console.warn(
        `⚠️ Tenant mismatch for lead ${leadId}: lead.tenantId=${lead.tenantId}, expected=${tenant.id}`
      );
    }

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        stateMetadata: {
          ...((lead.stateMetadata as any) || {}),
          signatures: data, // Store signature metadata
          contractsSigned: true,
          contractsSignedAt: new Date().toISOString(),
        },
        lastModified: new Date(),
      },
    });

    console.log(
      "Successfully updated lead with signature metadata:",
      updatedLead.id
    );

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      message: "Signature metadata saved successfully.",
    });
  } catch (error) {
    console.error("Error saving signature metadata:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: `Failed to save signature metadata: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id: leadId } = params;
    console.log("GET signature metadata for leadId:", leadId);

    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      console.error("Tenant not found for slug:", tenantSlug);
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Find lead without tenant filter (for compatibility)
    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
      },
      select: {
        tenantId: true,
        stateMetadata: true,
      },
    });

    if (!lead) {
      console.error("Lead not found with ID:", leadId);
      return NextResponse.json(
        { success: false, error: "Lead not found" },
        { status: 404 }
      );
    }

    // Warn if tenant mismatch (but don't block)
    if (lead.tenantId !== tenant.id) {
      console.warn(
        `⚠️ Tenant mismatch for lead ${leadId}: lead.tenantId=${lead.tenantId}, expected=${tenant.id}`
      );
    }

    const signatures = (lead.stateMetadata as any)?.signatures || null;
    const contractsSigned =
      (lead.stateMetadata as any)?.contractsSigned || false;
    const contractsSignedAt =
      (lead.stateMetadata as any)?.contractsSignedAt || null;

    console.log("Found lead signature metadata:", signatures);

    return NextResponse.json({
      success: true,
      data: {
        signatures,
        contractsSigned,
        contractsSignedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching signature metadata:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch signature metadata: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}
