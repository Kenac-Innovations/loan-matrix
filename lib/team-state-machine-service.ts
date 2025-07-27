import { PrismaClient } from "@/app/generated/prisma";

const prisma = new PrismaClient();

export interface StateTransitionRequest {
  leadId: string;
  targetStageId: string;
  event?: string;
  context?: any;
  triggeredBy: string;
}

export interface StateTransitionResult {
  success: boolean;
  message: string;
  lead?: any;
  transition?: any;
  assignedTeam?: any;
}

export interface TeamPermissionCheck {
  canTransition: boolean;
  assignedTeam?: any;
  teamMembers?: any[];
  message: string;
}

export class TeamAwareStateMachineService {
  /**
   * Validates if a state transition is allowed with team permissions
   */
  static async validateTransitionWithTeams(
    currentStageId: string | null,
    targetStageId: string,
    tenantId: string,
    userId?: string
  ): Promise<{ isValid: boolean; message: string; teamInfo?: any }> {
    try {
      // First validate basic state machine rules
      const basicValidation = await this.validateBasicTransition(
        currentStageId,
        targetStageId,
        tenantId
      );

      if (!basicValidation.isValid) {
        return basicValidation;
      }

      // Check team permissions for the target stage
      const teamPermission = await this.checkTeamPermissions(
        targetStageId,
        tenantId,
        userId
      );

      if (!teamPermission.canTransition) {
        return {
          isValid: false,
          message: teamPermission.message,
        };
      }

      return {
        isValid: true,
        message: "Valid transition with team permissions",
        teamInfo: teamPermission.assignedTeam,
      };
    } catch (error) {
      console.error("Error validating transition with teams:", error);
      return {
        isValid: false,
        message: "Error validating transition",
      };
    }
  }

  /**
   * Basic state machine validation (without team checks)
   */
  static async validateBasicTransition(
    currentStageId: string | null,
    targetStageId: string,
    tenantId: string
  ): Promise<{ isValid: boolean; message: string }> {
    try {
      // Get the current stage (if any)
      const currentStage = currentStageId
        ? await prisma.pipelineStage.findUnique({
            where: { id: currentStageId },
          })
        : null;

      // Get the target stage
      const targetStage = await prisma.pipelineStage.findUnique({
        where: { id: targetStageId },
      });

      if (!targetStage) {
        return {
          isValid: false,
          message: "Target stage not found",
        };
      }

      if (targetStage.tenantId !== tenantId) {
        return {
          isValid: false,
          message: "Target stage does not belong to the current tenant",
        };
      }

      // If no current stage, can only transition to initial stages
      if (!currentStage) {
        if (!targetStage.isInitialState) {
          return {
            isValid: false,
            message: "Can only transition to initial stages from no stage",
          };
        }
        return { isValid: true, message: "Valid initial transition" };
      }

      // Cannot transition from final states
      if (currentStage.isFinalState) {
        return {
          isValid: false,
          message: "Cannot transition from final states",
        };
      }

      // Check if the transition is allowed
      if (!currentStage.allowedTransitions.includes(targetStageId)) {
        return {
          isValid: false,
          message: `Transition from ${currentStage.name} to ${targetStage.name} is not allowed`,
        };
      }

      return { isValid: true, message: "Valid transition" };
    } catch (error) {
      console.error("Error validating basic transition:", error);
      return {
        isValid: false,
        message: "Error validating transition",
      };
    }
  }

  /**
   * Check team permissions for a stage transition
   */
  static async checkTeamPermissions(
    stageId: string,
    tenantId: string,
    userId?: string
  ): Promise<TeamPermissionCheck> {
    try {
      // Find teams responsible for this stage
      const teams = await prisma.team.findMany({
        where: {
          tenantId,
          isActive: true,
          pipelineStageIds: {
            has: stageId,
          },
        },
        include: {
          members: {
            where: { isActive: true },
          },
        },
      });

      if (teams.length === 0) {
        // No teams assigned to this stage - allow transition
        return {
          canTransition: true,
          message: "No team restrictions for this stage",
        };
      }

      // If no userId provided, return team info but allow transition
      if (!userId) {
        return {
          canTransition: true,
          assignedTeam: teams[0],
          teamMembers: teams[0].members,
          message: "Team assigned but no user validation required",
        };
      }

      // Check if user is a member of any assigned team
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
      return {
        canTransition: false,
        message: "Error checking team permissions",
      };
    }
  }

  /**
   * Execute a state transition with team validation
   */
  static async executeTransition(
    request: StateTransitionRequest
  ): Promise<StateTransitionResult> {
    try {
      // Get the lead
      const lead = await prisma.lead.findUnique({
        where: { id: request.leadId },
        include: { currentStage: true },
      });

      if (!lead) {
        return {
          success: false,
          message: "Lead not found",
        };
      }

      // Validate the transition with team permissions
      const validation = await this.validateTransitionWithTeams(
        lead.currentStageId,
        request.targetStageId,
        lead.tenantId,
        request.triggeredBy
      );

      if (!validation.isValid) {
        return {
          success: false,
          message: validation.message,
        };
      }

      // Execute the transition
      const updatedLead = await prisma.lead.update({
        where: { id: request.leadId },
        data: {
          currentStageId: request.targetStageId,
          stateContext: request.context || lead.stateContext,
          lastModified: new Date(),
        },
        include: { currentStage: true },
      });

      // Record the state transition
      const transition = await prisma.stateTransition.create({
        data: {
          leadId: request.leadId,
          tenantId: lead.tenantId,
          fromStageId: lead.currentStageId,
          toStageId: request.targetStageId,
          event: request.event || "MANUAL_TRANSITION",
          context: request.context,
          triggeredBy: request.triggeredBy,
          metadata: {
            teamInfo: validation.teamInfo,
            timestamp: new Date(),
          },
        },
        include: {
          fromStage: true,
          toStage: true,
        },
      });

      return {
        success: true,
        message: "Transition executed successfully",
        lead: updatedLead,
        transition,
        assignedTeam: validation.teamInfo,
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
   * Get teams assigned to a specific stage
   */
  static async getTeamsForStage(stageId: string, tenantId: string) {
    return await prisma.team.findMany({
      where: {
        tenantId,
        isActive: true,
        pipelineStageIds: {
          has: stageId,
        },
      },
      include: {
        members: {
          where: { isActive: true },
        },
      },
    });
  }

  /**
   * Get all teams for a tenant with their assigned stages
   */
  static async getTeamsWithStages(tenantId: string) {
    const teams = await prisma.team.findMany({
      where: { tenantId, isActive: true },
      include: {
        members: {
          where: { isActive: true },
        },
      },
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
   * Auto-assign lead to team when transitioning to a stage
   */
  static async autoAssignToTeam(leadId: string, stageId: string) {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { tenantId: true },
      });

      if (!lead) return null;

      const teams = await this.getTeamsForStage(stageId, lead.tenantId);

      if (teams.length > 0) {
        // For now, assign to the first team
        // In the future, this could be more sophisticated (load balancing, etc.)
        return teams[0];
      }

      return null;
    } catch (error) {
      console.error("Error auto-assigning to team:", error);
      return null;
    }
  }

  /**
   * Get available transitions for a lead with team context
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

      if (!lead || !lead.currentStage) {
        return [];
      }

      const availableTransitions = [];

      for (const targetStageId of lead.currentStage.allowedTransitions) {
        const validation = await this.validateTransitionWithTeams(
          lead.currentStageId,
          targetStageId,
          lead.tenantId,
          userId
        );

        if (validation.isValid) {
          const targetStage = await prisma.pipelineStage.findUnique({
            where: { id: targetStageId },
          });

          const teams = await this.getTeamsForStage(
            targetStageId,
            lead.tenantId
          );

          availableTransitions.push({
            stageId: targetStageId,
            stageName: targetStage?.name,
            stageColor: targetStage?.color,
            assignedTeams: teams,
            canTransition: validation.isValid,
            message: validation.message,
          });
        }
      }

      return availableTransitions;
    } catch (error) {
      console.error("Error getting available transitions:", error);
      return [];
    }
  }
}

// Export singleton instance
export const teamAwareStateMachineService = new TeamAwareStateMachineService();
