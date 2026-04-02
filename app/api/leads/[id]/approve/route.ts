import { NextRequest, NextResponse } from "next/server";
import { getSession as getCustomSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFineractServiceWithSession } from "@/lib/fineract-api";

async function resolveLoanAmount(lead: { requestedAmount: number | null; fineractLoanId: number | null }): Promise<number | null> {
  if (lead.requestedAmount != null) return lead.requestedAmount;
  if (!lead.fineractLoanId) return null;
  try {
    const fineract = await getFineractServiceWithSession();
    const loan = await fineract.getLoan(lead.fineractLoanId);
    return loan?.approvedPrincipal || loan?.principal || loan?.proposedPrincipal || null;
  } catch {
    return null;
  }
}

/**
 * GET /api/leads/[id]/approve
 * Fetch approval status for the lead's current stage
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const session = await getCustomSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { currentStage: true },
    });

    if (!lead || !lead.currentStageId || !lead.currentStage) {
      return NextResponse.json({
        requiredApprovals: 1,
        approvals: [],
        isFullyApproved: true,
        userCanApprove: false,
        userHasApproved: false,
        userApprovalLimit: null,
      });
    }

    const stage = lead.currentStage;
    const requiredApprovals = stage.requiredApprovals ?? 1;

    if (requiredApprovals <= 1) {
      return NextResponse.json({
        requiredApprovals: 1,
        approvals: [],
        isFullyApproved: true,
        userCanApprove: false,
        userHasApproved: false,
        userApprovalLimit: null,
      });
    }

    const approvals = await prisma.stageApproval.findMany({
      where: { leadId, stageId: lead.currentStageId },
      orderBy: { approvedAt: "asc" },
    });

    const teams = await prisma.team.findMany({
      where: {
        tenantId: lead.tenantId,
        isActive: true,
        pipelineStageIds: { has: lead.currentStageId },
      },
      include: { members: { where: { isActive: true } } },
    });

    const currentUserMember = teams
      .flatMap((t) => t.members)
      .find((m) => m.userId === session.user.id);

    const userCanApprove = !!currentUserMember;
    const userHasApproved = approvals.some((a) => a.userId === session.user.id);

    let userApprovalLimit: number | null = null;
    let amountExceedsLimit = false;
    const loanAmount = await resolveLoanAmount(lead);

    if (currentUserMember) {
      userApprovalLimit = currentUserMember.approvalLimit;
      if (
        userApprovalLimit !== null &&
        loanAmount !== null &&
        loanAmount > userApprovalLimit
      ) {
        amountExceedsLimit = true;
      }
    }

    return NextResponse.json({
      requiredApprovals,
      approvals: approvals.map((a) => ({
        id: a.id,
        userId: a.userId,
        userName: a.userName,
        note: a.note,
        approvedAt: a.approvedAt,
      })),
      isFullyApproved: approvals.length >= requiredApprovals,
      userCanApprove,
      userHasApproved,
      userApprovalLimit,
      amountExceedsLimit,
      requestedAmount: loanAmount,
    });
  } catch (error) {
    console.error("Error fetching approval status:", error);
    return NextResponse.json(
      { error: "Failed to fetch approval status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leads/[id]/approve
 * Record an approval for the lead's current stage
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const session = await getCustomSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { note } = body as { note?: string };

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { currentStage: true },
    });

    if (!lead || !lead.currentStageId || !lead.currentStage) {
      return NextResponse.json({ error: "Lead or stage not found" }, { status: 404 });
    }

    const stage = lead.currentStage;
    const requiredApprovals = stage.requiredApprovals ?? 1;

    if (requiredApprovals <= 1) {
      return NextResponse.json(
        { error: "This stage does not require multi-approval" },
        { status: 400 }
      );
    }

    const teams = await prisma.team.findMany({
      where: {
        tenantId: lead.tenantId,
        isActive: true,
        pipelineStageIds: { has: lead.currentStageId },
      },
      include: { members: { where: { isActive: true } } },
    });

    const member = teams
      .flatMap((t) => t.members)
      .find((m) => m.userId === session.user.id);

    if (!member) {
      return NextResponse.json(
        { error: "You are not a member of the team for this stage" },
        { status: 403 }
      );
    }

    const postLoanAmount = await resolveLoanAmount(lead);
    if (
      member.approvalLimit !== null &&
      postLoanAmount !== null &&
      postLoanAmount > member.approvalLimit
    ) {
      return NextResponse.json(
        {
          error: `Loan amount exceeds your approval limit. Your limit: ${member.approvalLimit}, Requested: ${postLoanAmount}`,
        },
        { status: 403 }
      );
    }

    const existing = await prisma.stageApproval.findUnique({
      where: {
        leadId_stageId_userId: {
          leadId,
          stageId: lead.currentStageId,
          userId: session.user.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You have already approved this stage" },
        { status: 409 }
      );
    }

    await prisma.stageApproval.create({
      data: {
        leadId,
        stageId: lead.currentStageId,
        tenantId: lead.tenantId,
        userId: session.user.id,
        userName: session.user.name || session.user.email || "Unknown",
        note: note || null,
      },
    });

    const currentCount = await prisma.stageApproval.count({
      where: { leadId, stageId: lead.currentStageId },
    });

    return NextResponse.json({
      approved: true,
      currentCount,
      requiredCount: requiredApprovals,
      isFullyApproved: currentCount >= requiredApprovals,
    });
  } catch (error) {
    console.error("Error recording approval:", error);
    return NextResponse.json(
      { error: "Failed to record approval" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/leads/[id]/approve
 * Withdraw own approval
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await context.params;
    const session = await getCustomSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { currentStageId: true },
    });

    if (!lead?.currentStageId) {
      return NextResponse.json({ error: "Lead or stage not found" }, { status: 404 });
    }

    await prisma.stageApproval.deleteMany({
      where: {
        leadId,
        stageId: lead.currentStageId,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ withdrawn: true });
  } catch (error) {
    console.error("Error withdrawing approval:", error);
    return NextResponse.json(
      { error: "Failed to withdraw approval" },
      { status: 500 }
    );
  }
}
