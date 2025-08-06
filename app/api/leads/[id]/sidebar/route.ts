import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/app/generated/prisma";
import { getTenantBySlug } from "@/lib/tenant-service";

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    // Get tenant from x-tenant-slug header or default to "default"
    const tenantSlug = request.headers.get("x-tenant-slug") || "default";
    const tenant = await getTenantBySlug(tenantSlug);

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Fetch lead data with related information
    const lead = await prisma.lead.findUnique({
      where: {
        id: leadId,
        tenantId: tenant.id,
      },
      include: {
        currentStage: true,
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

    // Calculate time metrics
    const now = new Date();
    const createdAt = new Date(lead.createdAt);
    const totalTimeMs = now.getTime() - createdAt.getTime();
    const totalTimeHours = Math.floor(totalTimeMs / (1000 * 60 * 60));

    // Calculate time in current stage
    const lastTransition = lead.stateTransitions[0];
    const currentStageStartTime = lastTransition
      ? new Date(lastTransition.triggeredAt)
      : createdAt;
    const timeInCurrentStageMs =
      now.getTime() - currentStageStartTime.getTime();
    const timeInCurrentStageHours = Math.floor(
      timeInCurrentStageMs / (1000 * 60 * 60)
    );

    // Get pipeline stages for SLA information
    const stages = await prisma.pipelineStage.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
      },
      orderBy: { order: "asc" },
    });

    // Calculate stage times and SLA performance
    const stageTimes = [];
    const transitions = [...lead.stateTransitions].reverse(); // Oldest first

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const stageTransition = transitions.find(
        (t) => t.toStage.id === stage.id
      );

      if (stageTransition) {
        const transitionTime = new Date(stageTransition.triggeredAt);
        const previousTime =
          i === 0
            ? createdAt
            : new Date(
                transitions.find((t) => t.toStage.order === stage.order - 1)
                  ?.triggeredAt || createdAt
              );

        const timeSpentMs = transitionTime.getTime() - previousTime.getTime();
        const timeSpentHours = Math.floor(timeSpentMs / (1000 * 60 * 60));

        stageTimes.push({
          stageName: stage.name,
          timeSpent: timeSpentHours,
          slaHours: 72, // Default 3 days
          status:
            stage.id === lead.currentStage?.id ? "in_progress" : "completed",
        });
      } else if (stage.id === lead.currentStage?.id) {
        stageTimes.push({
          stageName: stage.name,
          timeSpent: timeInCurrentStageHours,
          slaHours: 72, // Default 3 days
          status: "in_progress",
        });
      } else {
        stageTimes.push({
          stageName: stage.name,
          timeSpent: 0,
          slaHours: 72, // Default 3 days
          status: "pending",
        });
      }
    }

    // Get actual team members assigned to this lead's current stage
    const teamMembers = [];

    if (lead.currentStage) {
      // Find teams responsible for the current stage
      const teamsForStage = await prisma.team.findMany({
        where: {
          tenantId: tenant.id,
          pipelineStageIds: {
            has: lead.currentStage.id,
          },
        },
        include: {
          members: true,
        },
      });

      // Get team members from all teams responsible for this stage
      for (const team of teamsForStage) {
        for (const member of team.members) {
          // Generate initials from name
          const nameParts = member.name.split(" ");
          const initials =
            nameParts.length >= 2
              ? nameParts[0].charAt(0) + nameParts[1].charAt(0)
              : nameParts[0].charAt(0) + (nameParts[0].charAt(1) || "");

          // Generate a consistent color based on the member's name
          const colors = [
            "bg-blue-500",
            "bg-green-500",
            "bg-purple-500",
            "bg-orange-500",
            "bg-pink-500",
            "bg-indigo-500",
            "bg-teal-500",
            "bg-red-500",
          ];
          const colorIndex = member.name.length % colors.length;

          teamMembers.push({
            id: member.id,
            name: member.name,
            role: member.role,
            status: "in_progress" as const, // You can enhance this based on actual task status
            initials: initials.toUpperCase(),
            color: colors[colorIndex],
          });
        }
      }
    }

    // If no team members found, show a default message
    if (teamMembers.length === 0) {
      teamMembers.push({
        id: "no-assignment",
        name: "No team assigned",
        role: "Unassigned",
        status: "pending" as const,
        initials: "NA",
        color: "bg-gray-500",
      });
    }

    // Get validation results from the validations API
    let validations = [];
    try {
      const validationsResponse = await fetch(
        `${request.nextUrl.origin}/api/leads/${leadId}/validations`,
        {
          headers: {
            "x-tenant-slug": tenantSlug,
          },
        }
      );

      if (validationsResponse.ok) {
        const validationsData = await validationsResponse.json();
        validations =
          validationsData.validations?.map((v: any) => ({
            name: v.name,
            status:
              v.status === "passed"
                ? "passed"
                : v.status === "failed"
                ? "failed"
                : "warning",
          })) || [];
      }
    } catch (error) {
      console.error("Error fetching validations:", error);
      // Fallback validations based on lead data
      validations = [
        {
          name: "Required Fields",
          status:
            lead.firstname && lead.lastname && lead.emailAddress
              ? "passed"
              : "failed",
        },
        {
          name: "Contact Information",
          status: lead.emailAddress && lead.mobileNo ? "passed" : "warning",
        },
      ];
    }

    const sidebarData = {
      currentStage: lead.currentStage?.name || "New Lead",
      timeInCurrentStage: timeInCurrentStageHours,
      totalTime: totalTimeHours,
      currentStageSLA: 72, // Default 3 days
      teamMembers,
      validations,
      stageTimes,
    };

    return NextResponse.json(sidebarData);
  } catch (error) {
    console.error("Error fetching sidebar data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
