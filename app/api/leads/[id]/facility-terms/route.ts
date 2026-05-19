import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractTenantSlugFromRequest, getTenantBySlug } from "@/lib/tenant-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const data = await request.json();
    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const currentMetadata = (lead.stateMetadata as any) || {};

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        facilityType: "REVOLVING_CREDIT",
        requestedAmount: data.creditLimit ? parseFloat(data.creditLimit) : null,
        savingsProductId: data.savingsProductId
          ? parseInt(data.savingsProductId, 10)
          : null,
        expectedDisbursementDate: data.disbursementDate
          ? new Date(data.disbursementDate)
          : null,
        stateMetadata: {
          ...currentMetadata,
          maxDrawdowns: data.maxDrawdowns ?? 10,
          tenorMonths: data.tenorMonths ?? null,
          nominalInterestRate: data.interestRate ?? null,
          fieldOfficerId: data.fieldOfficerId ?? null,
        },
        lastModified: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    const meta = (lead.stateMetadata as any) || {};
    return NextResponse.json({
      creditLimit: lead.requestedAmount,
      savingsProductId: lead.savingsProductId,
      disbursementDate: lead.expectedDisbursementDate,
      maxDrawdowns: meta.maxDrawdowns ?? 10,
      tenorMonths: meta.tenorMonths ?? null,
      interestRate: meta.nominalInterestRate ?? null,
      fieldOfficerId: meta.fieldOfficerId ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
