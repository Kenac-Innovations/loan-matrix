import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  decideLeadAccess,
  getLeadVisibilityScope,
} from "@/lib/lead-access";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch lead by ID without tenant filter.
    // The middleware that sets x-tenant-slug does not run for API routes,
    // so client-side fetches would default to the wrong tenant.
    // Lead IDs are UUIDs and globally unique, so tenant filtering is unnecessary here.
    const lead = await prisma.lead.findUnique({
      where: {
        id,
      },
      include: {
        currentStage: true,
        familyMembers: true,
        entityStakeholders: {
          orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
          include: {
            proofOfResidenceDocument: true,
          },
        },
        entityBankAccounts: {
          orderBy: { sortOrder: "asc" },
        },
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

    // Determine the current user's access level for this lead. Out-of-scope
    // users still get the lead back (read-only fallback per product spec) but
    // can use the `access` block to render a banner / hide edit controls.
    const accessScope = lead.tenantId
      ? await getLeadVisibilityScope(lead.tenantId)
      : null;
    const accessDecision = accessScope
      ? decideLeadAccess(accessScope, lead)
      : { level: "full" as const };

    // Fetch tenant settings for email-optional check
    const tenant = lead.tenantId
      ? await prisma.tenant.findUnique({
          where: { id: lead.tenantId },
          select: { settings: true },
        })
      : null;
    const tenantSettings = tenant?.settings as any;
    const emailOptional = !!tenantSettings?.locale?.emailOptional;

    // Calculate some derived fields
    const timeInCurrentStage =
      lead.currentStage && lead.stateTransitions.length > 0
        ? Date.now() - new Date(lead.stateTransitions[0].triggeredAt).getTime()
        : Date.now() - new Date(lead.createdAt).getTime();

    const totalTime = Date.now() - new Date(lead.createdAt).getTime();

    // Format the response with additional computed fields
    const response = {
      ...lead,
      access: accessDecision,
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
          (emailOptional || lead.emailAddress)
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

    const body = await request.json();

    // Access check: block out-of-scope users from mutating the lead, even
    // though they can fetch it read-only via GET.
    const existing = await prisma.lead.findUnique({
      where: { id },
      select: {
        tenantId: true,
        userId: true,
        assignedToUserId: true,
        officeName: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (existing.tenantId) {
      const scope = await getLeadVisibilityScope(existing.tenantId);
      const decision = decideLeadAccess(scope, existing);
      if (decision.level !== "full") {
        return NextResponse.json(
          { error: "You do not have permission to edit this lead." },
          { status: 403 }
        );
      }
    }

    // Update lead by ID (without tenant filter to support cross-tenant client-side fetches)
    const updatedLead = await prisma.lead.update({
      where: {
        id,
      },
      data: {
        ...body,
        updatedAt: new Date(),
      },
      include: {
        currentStage: true,
        familyMembers: true,
        entityStakeholders: {
          orderBy: [{ role: "asc" }, { sortOrder: "asc" }],
          include: { proofOfResidenceDocument: true },
        },
        entityBankAccounts: { orderBy: { sortOrder: "asc" } },
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
      select: {
        id: true,
        tenantId: true,
        userId: true,
        assignedToUserId: true,
        officeName: true,
      },
    });

    if (!lead) {
      console.error("Lead not found:", leadId);
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Access check: block out-of-scope users from mutating the lead.
    if (lead.tenantId) {
      const scope = await getLeadVisibilityScope(lead.tenantId);
      const decision = decideLeadAccess(scope, lead);
      if (decision.level !== "full") {
        return NextResponse.json(
          { error: "You do not have permission to edit this lead." },
          { status: 403 }
        );
      }
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
