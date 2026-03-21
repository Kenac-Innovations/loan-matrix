import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTenantBySlug, extractTenantSlugFromRequest } from "@/lib/tenant-service";
import { getSession } from "@/lib/auth";
import { getFineractTenantId } from "@/lib/fineract-tenant-service";

const FINERACT_BASE_URL = process.env.FINERACT_BASE_URL || "http://10.10.0.143";

interface LoanActionInfo {
  approvedBy: string | null;
  approvedOnDate: string | null;
  disbursedBy: string | null;
  disbursedOnDate: string | null;
  loanStatus: string | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    const tenantSlug = extractTenantSlugFromRequest(request);
    let tenant = await getTenantBySlug(tenantSlug);

    // If tenant not found, try to create default tenant
    if (!tenant) {
      const { getOrCreateDefaultTenant } = await import("@/lib/tenant-service");
      tenant = await getOrCreateDefaultTenant();
    }

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

    // Calculate time metrics (in minutes for precision)
    const now = new Date();
    const createdAt = new Date(lead.createdAt);
    const totalTimeMins = Math.floor((now.getTime() - createdAt.getTime()) / 60000);

    // Calculate time in current stage
    const lastTransition = lead.stateTransitions[0];
    const currentStageStartTime = lastTransition
      ? new Date(lastTransition.triggeredAt)
      : createdAt;
    const timeInCurrentStageMins = Math.floor(
      (now.getTime() - currentStageStartTime.getTime()) / 60000
    );

    // Get pipeline stages with SLA configurations
    const stages = await prisma.pipelineStage.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
      },
      include: {
        slaConfigs: {
          where: {
            enabled: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1, // Get the most recent enabled SLA config for each stage
        },
      },
      orderBy: { order: "asc" },
    });

    // Helper function to convert SLA timeframe to hours
    const getSlaHours = (
      slaConfig: { timeframe: number; timeUnit: string } | undefined
    ): number => {
      if (!slaConfig) return 72; // Default 3 days if no SLA config

      const { timeframe, timeUnit } = slaConfig;
      switch (timeUnit.toLowerCase()) {
        case "minutes":
          return Math.ceil(timeframe / 60);
        case "hours":
          return timeframe;
        case "days":
          return timeframe * 24;
        case "weeks":
          return timeframe * 24 * 7;
        default:
          return timeframe; // Assume hours if unknown unit
      }
    };

    // Calculate stage times and SLA performance (all in minutes)
    const stageTimes = [];
    const transitions = [...lead.stateTransitions].reverse(); // Oldest first

    for (const stage of stages) {
      const slaConfig = stage.slaConfigs[0];
      const slaMins = getSlaHours(slaConfig) * 60;
      const isCurrent = stage.id === lead.currentStage?.id;

      // Find when lead entered this stage (transition with toStage = this stage)
      const enteredTransition = transitions.find(
        (t) => t.toStage.id === stage.id
      );
      // Find when lead left this stage (transition with fromStageId = this stage)
      const exitedTransition = transitions.find(
        (t) => t.fromStageId === stage.id
      );

      if (isCurrent) {
        const enteredAt = enteredTransition
          ? new Date(enteredTransition.triggeredAt)
          : createdAt;
        const timeSpentMins = Math.floor((now.getTime() - enteredAt.getTime()) / 60000);
        stageTimes.push({
          stageName: stage.name,
          timeSpent: timeSpentMins,
          slaMins,
          status: "in_progress",
        });
      } else if (enteredTransition && exitedTransition) {
        const enteredAt = new Date(enteredTransition.triggeredAt);
        const exitedAt = new Date(exitedTransition.triggeredAt);
        const timeSpentMins = Math.floor((exitedAt.getTime() - enteredAt.getTime()) / 60000);
        stageTimes.push({
          stageName: stage.name,
          timeSpent: timeSpentMins,
          slaMins,
          status: "completed",
        });
      } else if (!enteredTransition && exitedTransition) {
        const exitedAt = new Date(exitedTransition.triggeredAt);
        const timeSpentMins = Math.floor((exitedAt.getTime() - createdAt.getTime()) / 60000);
        stageTimes.push({
          stageName: stage.name,
          timeSpent: timeSpentMins,
          slaMins,
          status: "completed",
        });
      } else {
        stageTimes.push({
          stageName: stage.name,
          timeSpent: 0,
          slaMins,
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
            userId: member.userId,
            name: member.name,
            role: member.role,
            status: "in_progress" as const,
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
            origin: request.headers.get("origin") || "",
            referer: request.headers.get("referer") || "",
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
      const tenantSettings = tenant.settings as any;
      const emailOptional = !!tenantSettings?.locale?.emailOptional;
      validations = [
        {
          name: "Required Fields",
          status:
            lead.firstname && lead.lastname && (emailOptional || lead.emailAddress)
              ? "passed"
              : "failed",
        },
        {
          name: "Contact Information",
          status: (emailOptional || lead.emailAddress) && lead.mobileNo ? "passed" : "warning",
        },
      ];
    }

    // Fetch loan action info from Fineract if loan is submitted
    let loanActionInfo: LoanActionInfo = {
      approvedBy: null,
      approvedOnDate: null,
      disbursedBy: null,
      disbursedOnDate: null,
      loanStatus: null,
    };

    if (lead.loanSubmittedToFineract && lead.fineractLoanId) {
      try {
        const session = await getSession();
        const accessToken =
          (session as any)?.base64EncodedAuthenticationKey ||
          (session as any)?.accessToken;

        if (accessToken) {
          const fineractTenantId = await getFineractTenantId();
          const loanResponse = await fetch(
            `${FINERACT_BASE_URL}/fineract-provider/api/v1/loans/${lead.fineractLoanId}`,
            {
              headers: {
                Authorization: `Basic ${accessToken}`,
                "Fineract-Platform-TenantId": fineractTenantId,
                Accept: "application/json",
              },
              cache: "no-store",
            }
          );

          if (loanResponse.ok) {
            const loanData = await loanResponse.json();
            const timeline = loanData.timeline || {};

            // Get loan status
            loanActionInfo.loanStatus = loanData.status?.value || null;

            // Get approved by info
            if (timeline.approvedByFirstname || timeline.approvedByLastname) {
              loanActionInfo.approvedBy = `${
                timeline.approvedByFirstname || ""
              } ${timeline.approvedByLastname || ""}`.trim();
            } else if (timeline.approvedByUsername) {
              loanActionInfo.approvedBy = timeline.approvedByUsername;
            }

            // Get approved on date
            if (timeline.approvedOnDate) {
              if (Array.isArray(timeline.approvedOnDate)) {
                const [year, month, day] = timeline.approvedOnDate;
                loanActionInfo.approvedOnDate = new Date(
                  year,
                  month - 1,
                  day
                ).toISOString();
              } else {
                loanActionInfo.approvedOnDate = timeline.approvedOnDate;
              }
            }

            // Get disbursed by info
            if (timeline.disbursedByFirstname || timeline.disbursedByLastname) {
              loanActionInfo.disbursedBy = `${
                timeline.disbursedByFirstname || ""
              } ${timeline.disbursedByLastname || ""}`.trim();
            } else if (timeline.disbursedByUsername) {
              loanActionInfo.disbursedBy = timeline.disbursedByUsername;
            }

            // Get disbursed on date
            if (timeline.actualDisbursementDate) {
              if (Array.isArray(timeline.actualDisbursementDate)) {
                const [year, month, day] = timeline.actualDisbursementDate;
                loanActionInfo.disbursedOnDate = new Date(
                  year,
                  month - 1,
                  day
                ).toISOString();
              } else {
                loanActionInfo.disbursedOnDate =
                  timeline.actualDisbursementDate;
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching loan action info:", error);
      }
    }

    // Get current stage SLA from the stages we already fetched (in minutes)
    const currentStageData = stages.find((s) => s.id === lead.currentStage?.id);
    const currentStageSLAMins = currentStageData
      ? getSlaHours(currentStageData.slaConfigs[0]) * 60
      : 72 * 60;

    // Check if the current user is a member of the team owning the current stage
    const session = await getSession();
    const currentUserId = session?.user?.id;
    let isUserInStageTeam = false;

    if (lead.currentStage && currentUserId) {
      const stageTeams = await prisma.team.findMany({
        where: {
          tenantId: tenant.id,
          pipelineStageIds: { has: lead.currentStage.id },
        },
        include: { members: true },
      });

      isUserInStageTeam = stageTeams.some((team) =>
        team.members.some((m: { userId: string }) => String(m.userId) === currentUserId)
      );
    }

    const isFinalStageCompleted = lead.currentStage?.isFinalState === true;

    const sidebarData = {
      currentStage: lead.currentStage?.name || "New Lead",
      timeInCurrentStage: timeInCurrentStageMins,
      totalTime: totalTimeMins,
      currentStageSLA: currentStageSLAMins,
      isFinalStageCompleted,
      teamMembers,
      validations,
      stageTimes,
      // Assignment info
      isSubmitted: lead.loanSubmittedToFineract || false,
      assignment: {
        userId: lead.assignedToUserId,
        userName: lead.assignedToUserName,
        assignedAt: lead.assignedAt?.toISOString() || null,
      },
      // Loan action info
      loanActionInfo,
      // Team membership for current user
      isUserInStageTeam,
      // Team members eligible for assignment at the current stage
      stageTeamMembers: teamMembers
        .filter((m) => m.id !== "no-assignment")
        .map((m) => ({ id: m.id, name: m.name, role: m.role, userId: m.userId })),
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
