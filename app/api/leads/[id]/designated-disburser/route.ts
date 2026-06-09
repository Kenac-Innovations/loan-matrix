import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  applyLeadVisibilityScope,
  getLeadViewerAccessContext,
} from "@/lib/lead-policy";
import { prisma } from "@/lib/prisma";

async function getAccessibleLeadContext(leadId: string, fineractUserId: number) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      tenantId: true,
    },
  });

  if (!lead) {
    return null;
  }

  const leadAccess = await getLeadViewerAccessContext(
    lead.tenantId,
    fineractUserId
  );

  const accessibleLead = await prisma.lead.findFirst({
    where: applyLeadVisibilityScope(
      {
        id: leadId,
        tenantId: lead.tenantId,
      },
      leadAccess.visibleOfficeIds
    ),
    select: {
      id: true,
      tenantId: true,
      firstname: true,
      lastname: true,
      designatedDisburserUserId: true,
      designatedDisburserUserName: true,
    },
  });

  if (!accessibleLead) {
    return null;
  }

  return {
    lead: accessibleLead,
    leadAccess,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: leadId } = await params;
    const context = await getAccessibleLeadContext(leadId, session.user.userId);

    if (!context) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!context.leadAccess.canOverrideInitiatorDisbursement) {
      return NextResponse.json(
        { error: "You do not have permission to set the designated disburser." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const mifosUserId = Number(body?.mifosUserId);
    const mifosUserName =
      typeof body?.mifosUserName === "string" ? body.mifosUserName.trim() : "";

    if (!Number.isFinite(mifosUserId) || !mifosUserName) {
      return NextResponse.json(
        { error: "mifosUserId and mifosUserName are required" },
        { status: 400 }
      );
    }

    const updatedLead = await prisma.lead.update({
      where: { id: context.lead.id },
      data: {
        designatedDisburserUserId: mifosUserId,
        designatedDisburserUserName: mifosUserName,
        designatedDisburserAssignedByUserId: String(session.user.userId),
        designatedDisburserAssignedAt: new Date(),
      },
      select: {
        id: true,
        designatedDisburserUserId: true,
        designatedDisburserUserName: true,
        designatedDisburserAssignedAt: true,
      },
    });

    const clientName =
      [context.lead.firstname, context.lead.lastname].filter(Boolean).join(" ") ||
      "the lead";

    await prisma.alert.create({
      data: {
        tenantId: context.lead.tenantId,
        mifosUserId,
        type: "TASK",
        title: "You Were Set as Designated Disburser",
        message: `You are now the designated disburser for ${clientName}.`,
        actionUrl: `/leads/${context.lead.id}`,
        actionLabel: "View Lead",
        metadata: {
          leadId: context.lead.id,
          designatedDisburserUserId: mifosUserId,
          designatedByUserId: session.user.userId,
        },
        createdBy: session.user.name || "System",
      },
    });

    return NextResponse.json({
      success: true,
      lead: {
        id: updatedLead.id,
        designatedDisburserUserId: updatedLead.designatedDisburserUserId,
        designatedDisburserUserName: updatedLead.designatedDisburserUserName,
        designatedDisburserAssignedAt:
          updatedLead.designatedDisburserAssignedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Error setting designated disburser:", error);
    return NextResponse.json(
      { error: "Failed to set designated disburser" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session?.user?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: leadId } = await params;
    const context = await getAccessibleLeadContext(leadId, session.user.userId);

    if (!context) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!context.leadAccess.canOverrideInitiatorDisbursement) {
      return NextResponse.json(
        { error: "You do not have permission to clear the designated disburser." },
        { status: 403 }
      );
    }

    const updatedLead = await prisma.lead.update({
      where: { id: context.lead.id },
      data: {
        designatedDisburserUserId: null,
        designatedDisburserUserName: null,
        designatedDisburserAssignedByUserId: String(session.user.userId),
        designatedDisburserAssignedAt: new Date(),
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json({
      success: true,
      lead: {
        id: updatedLead.id,
      },
    });
  } catch (error) {
    console.error("Error clearing designated disburser:", error);
    return NextResponse.json(
      { error: "Failed to clear designated disburser" },
      { status: 500 }
    );
  }
}
