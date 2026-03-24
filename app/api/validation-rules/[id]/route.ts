import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug, extractTenantSlugFromRequest } from "@/lib/tenant-service";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, conditions, actions, severity, enabled, order, pipelineStageId, tab } = body;

    const rule = await prisma.validationRule.update({
      where: { id, tenantId: tenant.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(conditions !== undefined && { conditions }),
        ...(actions !== undefined && { actions }),
        ...(severity !== undefined && { severity }),
        ...(enabled !== undefined && { enabled }),
        ...(order !== undefined && { order }),
        ...(pipelineStageId !== undefined && { pipelineStageId: pipelineStageId || null }),
        ...(tab !== undefined && { tab: tab || null }),
      },
    });

    return NextResponse.json({ rule });
  } catch (error) {
    console.error("Error updating validation rule:", error);
    return NextResponse.json(
      { error: "Failed to update validation rule" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantSlug = extractTenantSlugFromRequest(request);
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    await prisma.validationRule.delete({
      where: { id, tenantId: tenant.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting validation rule:", error);
    return NextResponse.json(
      { error: "Failed to delete validation rule" },
      { status: 500 }
    );
  }
}
