import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/app/generated/prisma";
import { getTenantBySlug } from "@/lib/tenant-service";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    // Get tenant from x-tenant-slug header or default to "default"
    const tenantSlug = request.headers.get("x-tenant-slug") || "default";
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Verify the lead exists and belongs to this tenant
    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
        tenantId: tenant.id,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Fetch pipeline stages for the tenant
    const stages = await prisma.pipelineStage.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
      },
      orderBy: { order: "asc" },
    });

    // Transform stages to match the expected format
    const transformedStages = stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      description: stage.description || "",
      order: stage.order,
      color: stage.color || "#3b82f6",
      isActive: stage.isActive,
      isInitialState: stage.isInitialState || false,
      isFinalState: stage.isFinalState || false,
      allowedTransitions: stage.allowedTransitions || [],
    }));

    return NextResponse.json({
      stages: transformedStages,
      totalStages: transformedStages.length,
    });
  } catch (error) {
    console.error("Error fetching pipeline stages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
