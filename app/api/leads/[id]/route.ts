import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/app/generated/prisma";
import { getTenantBySlug } from "@/lib/tenant-service";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get tenant from x-tenant-slug header or default to "default"
    const tenantSlug = request.headers.get("x-tenant-slug") || "default";
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Fetch lead with all related data
    const lead = await prisma.lead.findUnique({
      where: {
        id,
        tenantId: tenant.id,
      },
      include: {
        currentStage: true,
        familyMembers: true,
        stateTransitions: {
          include: {
            fromStage: true,
            toStage: true,
          },
          orderBy: {
            triggeredAt: "desc",
          },
        },
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Calculate some derived fields
    const timeInCurrentStage =
      lead.currentStage && lead.stateTransitions.length > 0
        ? Date.now() - new Date(lead.stateTransitions[0].triggeredAt).getTime()
        : Date.now() - new Date(lead.createdAt).getTime();

    const totalTime = Date.now() - new Date(lead.createdAt).getTime();

    // Format the response with additional computed fields
    const response = {
      ...lead,
      computed: {
        timeInCurrentStage: Math.floor(
          timeInCurrentStage / (1000 * 60 * 60 * 24)
        ), // days
        totalTime: Math.floor(totalTime / (1000 * 60 * 60 * 24)), // days
        fullName: [lead.firstname, lead.middlename, lead.lastname]
          .filter(Boolean)
          .join(" "),
        hasRequiredFields: !!(
          lead.firstname &&
          lead.lastname &&
          lead.emailAddress
        ),
        stageHistory: lead.stateTransitions.map((transition) => ({
          ...transition,
          duration: transition.fromStage
            ? new Date(transition.triggeredAt).getTime() -
              new Date(lead.createdAt).getTime()
            : 0,
        })),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching lead:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get tenant from x-tenant-slug header or default to "default"
    const tenantSlug = request.headers.get("x-tenant-slug") || "default";
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await request.json();

    // Update lead
    const updatedLead = await prisma.lead.update({
      where: {
        id,
        tenantId: tenant.id,
      },
      data: {
        ...body,
        updatedAt: new Date(),
      },
      include: {
        currentStage: true,
        familyMembers: true,
      },
    });

    return NextResponse.json(updatedLead);
  } catch (error) {
    console.error("Error updating lead:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
