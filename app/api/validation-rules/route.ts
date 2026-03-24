import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug, extractTenantSlugFromRequest } from "@/lib/tenant-service";

export async function GET(request: NextRequest) {
  try {
    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab");

    const where: any = { tenantId: tenant.id };
    if (tab) where.tab = tab;

    const rules = await prisma.validationRule.findMany({
      where,
      orderBy: [{ tab: "asc" }, { order: "asc" }],
      include: { pipelineStage: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Error fetching validation rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch validation rules" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, conditions, actions, severity, enabled, order, pipelineStageId, tab } = body;

    if (!name || !conditions || !actions) {
      return NextResponse.json(
        { error: "name, conditions, and actions are required" },
        { status: 400 }
      );
    }

    const rule = await prisma.validationRule.create({
      data: {
        tenantId: tenant.id,
        name,
        description: description || null,
        conditions,
        actions,
        severity: severity || "warning",
        enabled: enabled !== false,
        order: order ?? 0,
        pipelineStageId: pipelineStageId || null,
        tab: tab || null,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error("Error creating validation rule:", error);
    return NextResponse.json(
      { error: "Failed to create validation rule" },
      { status: 500 }
    );
  }
}
