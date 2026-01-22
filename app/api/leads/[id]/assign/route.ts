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
        loanSubmittedToFineract: true,
        assignedToUserId: true,
        assignedToUserName: true,
        firstname: true,
        lastname: true,
        loanAmount: true,
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
    const loanAmount = lead.loanAmount ? `$${lead.loanAmount.toLocaleString()}` : "N/A";

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
          loanAmount: lead.loanAmount,
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

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
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
