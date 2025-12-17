import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug } from "@/lib/tenant-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get tenant from x-tenant-slug header or default to "goodfellow"
    const tenantSlug = request.headers.get("x-tenant-slug") || "goodfellow";
    let tenant = await getTenantBySlug(tenantSlug);

    // If tenant not found, try to create default tenant
    if (!tenant) {
      const { getOrCreateDefaultTenant } = await import("@/lib/tenant-service");
      tenant = await getOrCreateDefaultTenant();
    }

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

    // Get tenant from x-tenant-slug header or default to "goodfellow"
    const tenantSlug = request.headers.get("x-tenant-slug") || "goodfellow";
    let tenant = await getTenantBySlug(tenantSlug);

    // If tenant not found, try to create default tenant
    if (!tenant) {
      const { getOrCreateDefaultTenant } = await import("@/lib/tenant-service");
      tenant = await getOrCreateDefaultTenant();
    }

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const paramsResolved = await params;
    const { id: leadId } = paramsResolved;

    console.log("=== PATCH LEAD ===");
    console.log("Lead ID:", leadId);

    const body = await request.json();
    console.log("Update data:", body);

    // Find the lead first (without tenant filter to avoid issues)
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, tenantId: true },
    });

    if (!lead) {
      console.error("Lead not found:", leadId);
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    console.log("Lead found, updating...");

    // Handle date fields that might be passed as strings
    const updateData = { ...body };
    if (
      updateData.loanSubmissionDate &&
      typeof updateData.loanSubmissionDate === "string"
    ) {
      updateData.loanSubmissionDate = new Date(updateData.loanSubmissionDate);
    }

    // Update lead (without tenant filter)
    const updatedLead = await prisma.lead.update({
      where: {
        id: leadId,
      },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    console.log("Lead updated successfully:", {
      id: updatedLead.id,
      fineractLoanId: (updatedLead as any).fineractLoanId,
      fineractClientId: (updatedLead as any).fineractClientId,
    });

    return NextResponse.json(updatedLead);
  } catch (error) {
    console.error("=== ERROR UPDATING LEAD ===");
    console.error(
      "Error type:",
      error instanceof Error ? error.constructor.name : typeof error
    );
    console.error(
      "Error message:",
      error instanceof Error ? error.message : String(error)
    );
    console.error("Full error:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
