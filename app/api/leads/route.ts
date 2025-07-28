import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/app/generated/prisma";
import { getTenantBySlug } from "@/lib/tenant-service";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get tenant from x-tenant-slug header or default to "default"
    const tenantSlug = request.headers.get("x-tenant-slug") || "default";
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const stage = searchParams.get("stage");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: any = {
      tenantId: tenant.id,
    };

    if (stage) {
      where.currentStageId = stage;
    }

    if (status) {
      where.status = status;
    }

    // Get leads with related data
    const leads = await prisma.lead.findMany({
      where,
      include: {
        currentStage: true,
        stateTransitions: {
          orderBy: { triggeredAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Get pipeline stages for this tenant
    const pipelineStages = await prisma.pipelineStage.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { order: "asc" },
    });

    // Get SLA configs for calculating time in stage
    const slaConfigs = await prisma.sLAConfig.findMany({
      where: { tenantId: tenant.id, enabled: true },
    });

    // Get team members for assignee information
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        team: {
          tenantId: tenant.id,
          isActive: true,
        },
        isActive: true,
      },
      include: {
        team: true,
      },
    });

    // Transform leads data for frontend
    const transformedLeads = leads.map((lead) => {
      const stageTransition = lead.stateTransitions[0];
      const timeInStage = stageTransition
        ? new Date().getTime() - new Date(stageTransition.triggeredAt).getTime()
        : new Date().getTime() - new Date(lead.createdAt).getTime();

      // Calculate time in stage in days and hours
      const days = Math.floor(timeInStage / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (timeInStage % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const timeInStageFormatted = `${days}d ${hours}h`;

      // Get SLA for current stage
      const stageSLA = slaConfigs.find(
        (sla) => sla.pipelineStageId === lead.currentStageId
      );

      let slaFormatted = "N/A";
      let slaStatus = "normal";

      if (stageSLA) {
        const slaTimeMs =
          stageSLA.timeframe *
          (stageSLA.timeUnit === "days"
            ? 24 * 60 * 60 * 1000
            : stageSLA.timeUnit === "hours"
            ? 60 * 60 * 1000
            : 60 * 1000);

        slaFormatted =
          stageSLA.timeUnit === "days"
            ? `${stageSLA.timeframe}d`
            : stageSLA.timeUnit === "hours"
            ? `${stageSLA.timeframe}h`
            : `${stageSLA.timeframe}m`;

        // Determine SLA status
        if (timeInStage > slaTimeMs) {
          slaStatus = "overdue";
        } else if (timeInStage > slaTimeMs * 0.8) {
          slaStatus = "warning";
        }
      }

      // Find assignee (for now, assign based on stage and team)
      const stageTeamMember = teamMembers.find((member) =>
        member.team.pipelineStageIds.includes(lead.currentStageId || "")
      );

      const assignee = stageTeamMember
        ? {
            initials: stageTeamMember.name
              .split(" ")
              .map((n) => n[0])
              .join(""),
            name: stageTeamMember.name,
            color: getColorForUser(stageTeamMember.userId),
          }
        : {
            initials: "UN",
            name: "Unassigned",
            color: "#6B7280",
          };

      // Calculate loan amount (for now using a placeholder)
      const amount = `$${(Math.random() * 300000 + 50000)
        .toFixed(0)
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

      // Determine loan type based on amount
      const amountNum = parseInt(amount.replace(/[$,]/g, ""));
      const loanType =
        amountNum > 200000
          ? "Mortgage"
          : amountNum > 100000
          ? "Business Loan"
          : "Personal Loan";

      return {
        id: lead.id,
        client:
          `${lead.firstname || ""} ${lead.lastname || ""}`.trim() ||
          "Unknown Client",
        amount,
        type: loanType,
        stage: lead.currentStageId,
        timeInStage: timeInStageFormatted,
        sla: slaFormatted,
        status: slaStatus,
        assignee: assignee.initials,
        assigneeName: assignee.name,
        assigneeColor: assignee.color,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      };
    });

    // Get total count for pagination
    const totalCount = await prisma.lead.count({ where });

    return NextResponse.json({
      leads: transformedLeads,
      pipelineStages,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Failed to fetch leads" },
      { status: 500 }
    );
  }
}

// Helper function to generate consistent colors for users
function getColorForUser(userId: string): string {
  const colors = [
    "#3B82F6", // blue
    "#A855F7", // purple
    "#EAB308", // yellow
    "#22C55E", // green
    "#14B8A6", // teal
    "#F59E0B", // amber
    "#EF4444", // red
    "#8B5CF6", // violet
  ];

  // Simple hash function to get consistent color for user
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
  }

  return colors[Math.abs(hash) % colors.length];
}
