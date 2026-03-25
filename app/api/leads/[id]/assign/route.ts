import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// POST /api/leads/[id]/assign - Assign or reassign a lead to a Mifos user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { mifosUserId, mifosUserName, assignedByUserId } = body;

    // Get current session for "assigned by" info
    const session = await getSession();
    const assignedByName = session?.user?.name || "System";
    const currentUserId = session?.user?.id;

    if (!mifosUserId || !mifosUserName) {
      return NextResponse.json(
        { error: "mifosUserId and mifosUserName are required" },
        { status: 400 }
      );
    }

    // Check if lead exists and is submitted
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        status: true,
        currentStageId: true,
        loanSubmittedToFineract: true,
        assignedToUserId: true,
        assignedToUserName: true,
        firstname: true,
        lastname: true,
        requestedAmount: true,
        fineractLoanId: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Only allow assignment for submitted leads
    if (!lead.loanSubmittedToFineract) {
      return NextResponse.json(
        { error: "Only submitted leads can be assigned" },
        { status: 400 }
      );
    }

    // Check that the requesting user belongs to the team owning the current stage
    if (lead.currentStageId && currentUserId) {
      const stageTeam = await prisma.team.findFirst({
        where: {
          tenantId: lead.tenantId,
          pipelineStageIds: { has: lead.currentStageId },
        },
        include: { members: true },
      });

      if (stageTeam) {
        const isMember = stageTeam.members.some(
          (m: { userId: string }) => String(m.userId) === currentUserId
        );
        if (!isMember) {
          return NextResponse.json(
            {
              error: `You must be a member of the "${stageTeam.name}" team to assign leads at this stage`,
            },
            { status: 403 }
          );
        }
      }
    }

    // Check if this is a reassignment (different user)
    const isReassignment = lead.assignedToUserId !== null && lead.assignedToUserId !== mifosUserId;
    const previousAssignee = lead.assignedToUserName;

    // Update the lead with assignment info
    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        assignedToUserId: mifosUserId,
        assignedToUserName: mifosUserName,
        assignedAt: new Date(),
        assignedByUserId: assignedByUserId || null,
      },
    });

    // Create alert for the newly assigned user
    const clientName = [lead.firstname, lead.lastname].filter(Boolean).join(" ") || "Unknown Client";
    const loanAmount = lead.requestedAmount ? `$${lead.requestedAmount.toLocaleString()}` : "N/A";

    await prisma.alert.create({
      data: {
        tenantId: lead.tenantId,
        mifosUserId: mifosUserId,
        type: "TASK",
        title: isReassignment ? "Lead Reassigned to You" : "New Lead Assigned",
        message: `${clientName} - Loan amount: ${loanAmount}${isReassignment ? ` (previously assigned to ${previousAssignee})` : ""}`,
        actionUrl: `/leads/${id}`,
        actionLabel: "View Lead",
        metadata: {
          leadId: id,
          clientName,
          requestedAmount: lead.requestedAmount,
          fineractLoanId: lead.fineractLoanId,
          assignedBy: assignedByName,
          isReassignment,
        },
        createdBy: assignedByName,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Lead assigned to ${mifosUserName}`,
      lead: {
        id: updatedLead.id,
        assignedToUserId: updatedLead.assignedToUserId,
        assignedToUserName: updatedLead.assignedToUserName,
        assignedAt: updatedLead.assignedAt,
      },
    });
  } catch (error) {
    console.error("Error assigning lead:", error);
    return NextResponse.json(
      { error: "Failed to assign lead" },
      { status: 500 }
    );
  }
}

// DELETE /api/leads/[id]/assign - Unassign a lead
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getSession();
    const currentUserId = session?.user?.id;

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, tenantId: true, currentStageId: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Check that the requesting user belongs to the team owning the current stage
    if (lead.currentStageId && currentUserId) {
      const stageTeam = await prisma.team.findFirst({
        where: {
          tenantId: lead.tenantId,
          pipelineStageIds: { has: lead.currentStageId },
        },
        include: { members: true },
      });

      if (stageTeam) {
        const isMember = stageTeam.members.some(
          (m: { userId: string }) => String(m.userId) === currentUserId
        );
        if (!isMember) {
          return NextResponse.json(
            {
              error: `You must be a member of the "${stageTeam.name}" team to manage assignments at this stage`,
            },
            { status: 403 }
          );
        }
      }
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        assignedToUserId: null,
        assignedToUserName: null,
        assignedAt: null,
        assignedByUserId: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Lead unassigned",
      lead: {
        id: updatedLead.id,
      },
    });
  } catch (error) {
    console.error("Error unassigning lead:", error);
    return NextResponse.json(
      { error: "Failed to unassign lead" },
      { status: 500 }
    );
  }
}
