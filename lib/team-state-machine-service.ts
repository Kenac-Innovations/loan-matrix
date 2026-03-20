import { prisma } from "./prisma";
import type { AssignmentStrategy, AssignmentConfig } from "@/shared/defaults/team-config";

export interface StateTransitionRequest {
  leadId: string;
  targetStageId: string;
  event?: string;
  context?: any;
  triggeredBy: string;
  reason?: string;
}

export interface StateTransitionResult {
  success: boolean;
  message: string;
  lead?: any;
  transition?: any;
  assignedTeam?: any;
  assignedMember?: { id: string; userId: string; name: string } | null;
}

export interface TeamPermissionCheck {
  canTransition: boolean;
  assignedTeam?: any;
  teamMembers?: any[];
  message: string;
}

interface AssignmentResult {
  memberId: string;
  memberUserId: string;
  memberName: string;
  teamId: string;
  teamName: string;
}

export class TeamAwareStateMachineService {
  /**
   * Execute a full state transition: validate -> move stage -> auto-assign -> audit trail
   */
  static async executeTransition(
    request: StateTransitionRequest
  ): Promise<StateTransitionResult> {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: request.leadId },
        include: { currentStage: true },
      });

      if (!lead) {
        return { success: false, message: "Lead not found" };
      }

      // 1. Validate the transition (stage rules + team permissions)
      const validation = await this.validateTransitionWithTeams(
        lead.currentStageId,
        request.targetStageId,
        lead.tenantId,
        request.triggeredBy
      );

      if (!validation.isValid) {
        return { success: false, message: validation.message };
      }

      // 2. Determine assignment for the target stage
      const assignment = await this.resolveAssignment(
        request.leadId,
        request.targetStageId,
        lead.tenantId
      );

      // 3. Move the lead to the new stage + assign in one transaction
      const [updatedLead, transition] = await prisma.$transaction([
        prisma.lead.update({
          where: { id: request.leadId },
          data: {
            currentStageId: request.targetStageId,
            assignedToUserId: assignment ? (Number.isFinite(Number(assignment.memberUserId)) ? Number(assignment.memberUserId) : null) : null,
            assignedToUserName: assignment?.memberName ?? null,
            assignedAt: assignment ? new Date() : null,
            assignedByUserId: request.triggeredBy,
            stateMetadata: {
              lastTransition: new Date().toISOString(),
              lastTransitionEvent: request.event || "MANUAL_TRANSITION",
              reason: request.reason,
              assignedTeam: assignment
                ? { id: assignment.teamId, name: assignment.teamName }
                : null,
            },
            lastModified: new Date(),
          },
          include: { currentStage: true },
        }),
        prisma.stateTransition.create({
          data: {
            leadId: request.leadId,
            tenantId: lead.tenantId,
            fromStageId: lead.currentStageId,
            toStageId: request.targetStageId,
            event: request.event || "MANUAL_TRANSITION",
            triggeredBy: request.triggeredBy,
            metadata: {
              reason: request.reason,
              teamInfo: validation.teamInfo,
              assignment: assignment
                ? {
                    teamId: assignment.teamId,
                    teamName: assignment.teamName,
                    memberId: assignment.memberId,
                    memberName: assignment.memberName,
                  }
                : null,
              timestamp: new Date().toISOString(),
            },
          },
          include: { fromStage: true, toStage: true },
        }),
      ]);

      return {
        success: true,
        message: assignment
          ? `Lead moved to ${updatedLead.currentStage?.name} and assigned to ${assignment.memberName} (${assignment.teamName})`
          : `Lead moved to ${updatedLead.currentStage?.name}`,
        lead: updatedLead,
        transition,
        assignedTeam: validation.teamInfo,
        assignedMember: assignment
          ? { id: assignment.memberId, userId: assignment.memberUserId, name: assignment.memberName }
          : null,
      };
    } catch (error) {
      console.error("Error executing transition:", error);
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Resolve which team member should be assigned when a lead enters a stage.
   * Returns null if strategy is "manual" or no teams are configured.
   */
  static async resolveAssignment(
    leadId: string,
    targetStageId: string,
    tenantId: string
  ): Promise<AssignmentResult | null> {
    const teams = await this.getTeamsForStage(targetStageId, tenantId);

    if (teams.length === 0) return null;

    // Use the first team that owns this stage
    const team = teams[0];
    const activeMembers = team.members.filter((m: any) => m.isActive);

    if (activeMembers.length === 0) return null;

    const strategy = (team.assignmentStrategy || "round_robin") as AssignmentStrategy;
    const config = (team.assignmentConfig || {}) as AssignmentConfig;

    let selectedMember: any = null;

    switch (strategy) {
      case "round_robin":
        selectedMember = await this.assignRoundRobin(team, activeMembers, config);
        break;
      case "least_loaded":
        selectedMember = await this.assignLeastLoaded(team, activeMembers, tenantId);
        break;
      case "specific_member":
        selectedMember = this.assignSpecificMember(activeMembers, config);
        break;
      case "manual":
        return null;
      default:
        selectedMember = activeMembers[0];
    }

    if (!selectedMember) return null;

    return {
      memberId: selectedMember.id,
      memberUserId: selectedMember.userId,
      memberName: selectedMember.name,
      teamId: team.id,
      teamName: team.name,
    };
  }

  /**
   * Round robin: rotate through members in order, persisting the index.
   */
  private static async assignRoundRobin(
    team: any,
    members: any[],
    config: AssignmentConfig
  ): Promise<any> {
    const lastIndex = config.lastAssignedIndex ?? -1;
    const nextIndex = (lastIndex + 1) % members.length;

    await prisma.team.update({
      where: { id: team.id },
      data: {
        assignmentConfig: {
          ...config,
          lastAssignedIndex: nextIndex,
        },
      },
    });

    return members[nextIndex];
  }

  /**
   * Least loaded: assign to the member with the fewest active (non-final) leads.
   */
  private static async assignLeastLoaded(
    team: any,
    members: any[],
    tenantId: string
  ): Promise<any> {
    const finalStages = await prisma.pipelineStage.findMany({
      where: { tenantId, isFinalState: true },
      select: { id: true },
    });
    const finalStageIds = finalStages.map((s) => s.id);

    const counts = await Promise.all(
      members.map(async (member: any) => {
        const count = await prisma.lead.count({
          where: {
            tenantId,
            assignedToUserName: member.name,
            currentStageId: finalStageIds.length > 0
              ? { notIn: finalStageIds }
              : undefined,
          },
        });
        return { member, count };
      })
    );

    counts.sort((a, b) => a.count - b.count);
    return counts[0]?.member ?? members[0];
  }

  /**
   * Specific member: always assign to a configured person.
   */
  private static assignSpecificMember(
    members: any[],
    config: AssignmentConfig
  ): any {
    if (config.specificMemberId) {
      return members.find((m: any) => m.id === config.specificMemberId) ?? members[0];
    }
    return members[0];
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  static async validateTransitionWithTeams(
    currentStageId: string | null,
    targetStageId: string,
    tenantId: string,
    userId?: string
  ): Promise<{ isValid: boolean; message: string; teamInfo?: any }> {
    try {
      const basicValidation = await this.validateBasicTransition(
        currentStageId,
        targetStageId,
        tenantId
      );

      if (!basicValidation.isValid) {
        return basicValidation;
      }

      const teamPermission = await this.checkTeamPermissions(
        targetStageId,
        tenantId,
        userId
      );

      if (!teamPermission.canTransition) {
        return { isValid: false, message: teamPermission.message };
      }

      return {
        isValid: true,
        message: "Valid transition with team permissions",
        teamInfo: teamPermission.assignedTeam,
      };
    } catch (error) {
      console.error("Error validating transition with teams:", error);
      return { isValid: false, message: "Error validating transition" };
    }
  }

  static async validateBasicTransition(
    currentStageId: string | null,
    targetStageId: string,
    tenantId: string
  ): Promise<{ isValid: boolean; message: string }> {
    try {
      const currentStage = currentStageId
        ? await prisma.pipelineStage.findUnique({ where: { id: currentStageId } })
        : null;

      const targetStage = await prisma.pipelineStage.findUnique({
        where: { id: targetStageId },
      });

      if (!targetStage) {
        return { isValid: false, message: "Target stage not found" };
      }

      if (targetStage.tenantId !== tenantId) {
        return { isValid: false, message: "Target stage does not belong to the current tenant" };
      }

      if (!currentStage) {
        if (!targetStage.isInitialState) {
          return { isValid: false, message: "Can only transition to initial stages from no stage" };
        }
        return { isValid: true, message: "Valid initial transition" };
      }

      if (currentStage.isFinalState) {
        return { isValid: false, message: "Cannot transition from final states" };
      }

      if (!currentStage.allowedTransitions.includes(targetStageId)) {
        return {
          isValid: false,
          message: `Transition from ${currentStage.name} to ${targetStage.name} is not allowed`,
        };
      }

      return { isValid: true, message: "Valid transition" };
    } catch (error) {
      console.error("Error validating basic transition:", error);
      return { isValid: false, message: "Error validating transition" };
    }
  }

  static async checkTeamPermissions(
    stageId: string,
    tenantId: string,
    userId?: string
  ): Promise<TeamPermissionCheck> {
    try {
      const teams = await prisma.team.findMany({
        where: {
          tenantId,
          isActive: true,
          pipelineStageIds: { has: stageId },
        },
        include: { members: { where: { isActive: true } } },
      });

      if (teams.length === 0) {
        return { canTransition: true, message: "No team restrictions for this stage" };
      }

      if (!userId) {
        return {
          canTransition: true,
          assignedTeam: teams[0],
          teamMembers: teams[0].members,
          message: "Team assigned but no user validation required",
        };
      }

      const userTeams = teams.filter((team) =>
        team.members.some((member) => member.userId === userId)
      );

      if (userTeams.length === 0) {
        return {
          canTransition: false,
          assignedTeam: teams[0],
          teamMembers: teams[0].members,
          message: `User is not a member of teams assigned to this stage: ${teams
            .map((t) => t.name)
            .join(", ")}`,
        };
      }

      return {
        canTransition: true,
        assignedTeam: userTeams[0],
        teamMembers: userTeams[0].members,
        message: "User has team permissions for this stage",
      };
    } catch (error) {
      console.error("Error checking team permissions:", error);
      return { canTransition: false, message: "Error checking team permissions" };
    }
  }

  // ---------------------------------------------------------------------------
  // Query helpers
  // ---------------------------------------------------------------------------

  static async getTeamsForStage(stageId: string, tenantId: string) {
    return prisma.team.findMany({
      where: {
        tenantId,
        isActive: true,
        pipelineStageIds: { has: stageId },
      },
      include: { members: { where: { isActive: true } } },
    });
  }

  static async getTeamsWithStages(tenantId: string) {
    const teams = await prisma.team.findMany({
      where: { tenantId, isActive: true },
      include: { members: { where: { isActive: true } } },
    });

    const stages = await prisma.pipelineStage.findMany({
      where: { tenantId, isActive: true },
      orderBy: { order: "asc" },
    });

    return teams.map((team) => ({
      ...team,
      assignedStages: stages.filter((stage) =>
        team.pipelineStageIds.includes(stage.id)
      ),
    }));
  }

  /**
   * Get available transitions for a lead with team + assignment context.
   * This is what the UI calls to show the "Move to Next Stage" options.
   */
  static async getAvailableTransitionsWithTeams(
    leadId: string,
    userId?: string
  ) {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: { currentStage: true },
      });

      if (!lead || !lead.currentStage) return [];

      const results = [];

      for (const targetStageId of lead.currentStage.allowedTransitions) {
        const targetStage = await prisma.pipelineStage.findUnique({
          where: { id: targetStageId },
        });

        if (!targetStage || !targetStage.isActive) continue;

        const teams = await this.getTeamsForStage(targetStageId, lead.tenantId);
        const receivingTeam = teams[0] ?? null;

        results.push({
          stageId: targetStageId,
          stageName: targetStage.name,
          stageColor: targetStage.color,
          stageDescription: targetStage.description,
          isFinalState: targetStage.isFinalState,
          receivingTeam: receivingTeam
            ? {
                id: receivingTeam.id,
                name: receivingTeam.name,
                assignmentStrategy: receivingTeam.assignmentStrategy,
                memberCount: receivingTeam.members.length,
              }
            : null,
        });
      }

      return results;
    } catch (error) {
      console.error("Error getting available transitions:", error);
      return [];
    }
  }
}

export const teamAwareStateMachineService = new TeamAwareStateMachineService();
