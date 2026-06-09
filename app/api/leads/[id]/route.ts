import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  applyLeadVisibilityScope,
  getLeadViewerAccessContext,
} from "@/lib/lead-policy";

async function getReadableLeadWhere(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, tenantId: true },
  });

  if (!lead) {
    return null;
  }

  return {
    id: leadId,
    tenantId: lead.tenantId,
  };
}

async function getWritableLeadWhere(
  leadId: string,
  options: {
    fineractUserId?: number | null;
    ownerUserId?: string | null;
  }
) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, tenantId: true, status: true, userId: true },
  });

  if (!lead) {
    return null;
  }

  if (
    lead.status === "DRAFT" &&
    options.ownerUserId &&
    lead.userId === options.ownerUserId
  ) {
    return {
      id: leadId,
      tenantId: lead.tenantId,
    };
  }

  const leadAccess = await getLeadViewerAccessContext(
    lead.tenantId,
    options.fineractUserId
  );

  return applyLeadVisibilityScope(
    {
      id: leadId,
      tenantId: lead.tenantId,
    },
    leadAccess.visibleOfficeIds
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scopedWhere = await getReadableLeadWhere(id);

    if (!scopedWhere) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const lead = await prisma.lead.findFirst({
      where: scopedWhere,
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
    const session = await getSession();

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const scopedWhere = await getWritableLeadWhere(id, {
      fineractUserId: session.user.userId,
      ownerUserId: session.user.id,
    });

    if (!scopedWhere) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const existingLead = await prisma.lead.findFirst({
      where: scopedWhere,
      select: { id: true },
    });

    if (!existingLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const updatedLead = await prisma.lead.update({
      where: {
        id: existingLead.id,
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
    const session = await getSession();

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("=== PATCH LEAD ===");
    console.log("Lead ID:", leadId);

    const body = await request.json();
    console.log("Update data:", body);

    const scopedWhere = await getWritableLeadWhere(leadId, {
      fineractUserId: session.user.userId,
      ownerUserId: session.user.id,
    });

    if (!scopedWhere) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const lead = await prisma.lead.findFirst({
      where: scopedWhere,
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

    const updatedLead = await prisma.lead.update({
      where: {
        id: lead.id,
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
