import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/leads/[id]/assign - Assign or reassign a lead to a Mifos user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { mifosUserId, mifosUserName, assignedByUserId } = body;

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
        status: true,
        loanSubmittedToFineract: true,
        assignedToUserId: true,
        assignedToUserName: true,
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
