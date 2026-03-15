import { prisma } from "./prisma";
import { stateMachineService } from "./state-machine-service";

/**
 * Lead State Manager
 * Handles manual state transitions for leads
 * CDE results are stored as recommendations only - all decisions require human approval
 */

export interface CDEResult {
  decision: "APPROVED" | "MANUAL_REVIEW" | "DECLINED";
  decisionTimestamp: string;
  scoringResult?: {
    creditScore: number;
    creditRating: string;
  };
  affordabilityResult?: {
    overallAffordabilityPassed: boolean;
    dtiRatio: number;
  };
  pricingResult?: {
    calculatedAPR: number;
    riskTier: string;
  };
  fraudCheck?: {
    riskLevel: string;
    fraudulent: boolean;
  };
  recommendation?: string;
}

export interface StateTransitionResult {
  success: boolean;
  newStage?: string;
  stageName?: string;
  requiresManualReview: boolean;
  message: string;
  errors?: string[];
}

export class LeadStateManager {
  /**
   * Process CDE result - stores recommendation only, no automatic transitions
   * All credit decisions require manual review and approval
   */
  async processCDEResult(
    leadId: string,
    cdeResult: CDEResult,
    userId: string = "system"
  ): Promise<StateTransitionResult> {
    console.log("=== CDE RESULT PROCESSED ===");
    console.log("Lead ID:", leadId);
    console.log("CDE Decision:", cdeResult.decision);
    console.log(
      "⚠️  Manual review required - CDE provides recommendation only"
    );

    // CDE result is stored in stateMetadata for display
    // No automatic transitions - all decisions require human approval
    return {
      success: true,
      requiresManualReview: true,
      message: "CDE evaluation completed - manual review required",
    };
  }

  /**
   * Manually transition a lead to a new stage
   */
  async manualTransition(
    leadId: string,
    targetStageName: string,
    userId: string,
    reason?: string,
    metadata?: any
  ): Promise<StateTransitionResult> {
    try {
      console.log("=== MANUAL STATE TRANSITION ===");
      console.log("Lead ID:", leadId);
      console.log("Target Stage:", targetStageName);
      console.log("User ID:", userId);
      console.log("Reason:", reason);

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          currentStage: true,
        },
      });

      if (!lead) {
        return {
          success: false,
          requiresManualReview: false,
          message: "Lead not found",
          errors: ["Lead not found"],
        };
      }

      // Find target stage
      const targetStage = await prisma.pipelineStage.findFirst({
        where: {
          tenantId: lead.tenantId,
          name: targetStageName,
          isActive: true,
        },
      });

      if (!targetStage) {
        return {
          success: false,
          requiresManualReview: false,
          message: `Target stage "${targetStageName}" not found`,
        };
      }

      // Check if transition is allowed
      const canTransition = await stateMachineService.canTransition(
        leadId,
        targetStage.id
      );

      if (!canTransition) {
        return {
          success: false,
          requiresManualReview: false,
          message: `Transition to ${targetStageName} not allowed from current stage ${lead.currentStage?.name}`,
        };
      }

      // Execute the transition
      const transitionResult = await this.transitionLead(
        leadId,
        targetStage.id,
        "MANUAL_TRANSITION",
        {
          manualTransition: true,
          reason,
          ...metadata,
        },
        userId
      );

      if (transitionResult.success) {
        return {
          success: true,
          newStage: targetStage.id,
          stageName: targetStage.name,
          requiresManualReview: false,
          message: `Lead manually transitioned to ${targetStage.name}`,
        };
      } else {
        return {
          success: false,
          requiresManualReview: false,
          message: "Failed to execute manual transition",
          errors: transitionResult.errors,
        };
      }
    } catch (error) {
      console.error("Error executing manual transition:", error);
      return {
        success: false,
        requiresManualReview: false,
        message: "Error executing manual transition",
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Get available transitions for a lead with CDE context
   */
  async getAvailableTransitions(leadId: string): Promise<{
    stages: Array<{
      id: string;
      name: string;
      description?: string;
      color: string;
      requiresApproval: boolean;
    }>;
    currentStage: string;
  }> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        currentStage: true,
      },
    });

    if (!lead || !lead.currentStage) {
      return { stages: [], currentStage: "" };
    }

    // Get all allowed transition stage IDs
    const allowedStageIds = lead.currentStage.allowedTransitions;

    // Fetch stage details
    const stages = await prisma.pipelineStage.findMany({
      where: {
        id: { in: allowedStageIds },
        isActive: true,
      },
      orderBy: { order: "asc" },
    });

    return {
      stages: stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        description: stage.description || undefined,
        color: stage.color,
        requiresApproval: this.doesStageRequireApproval(stage.name),
      })),
      currentStage: lead.currentStage.name,
    };
  }

  /**
   * Check if a stage requires manual approval
   */
  private doesStageRequireApproval(stageName: string): boolean {
    const approvalRequiredStages = [
      "Approved",
      "Pending Disbursement",
      "Disbursed",
    ];
    return approvalRequiredStages.includes(stageName);
  }

  /**
   * Execute lead transition
   */
  private async transitionLead(
    leadId: string,
    targetStageId: string,
    event: string,
    metadata: any,
    userId: string
  ): Promise<{ success: boolean; errors?: string[] }> {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { currentStageId: true, tenantId: true, stateMetadata: true },
      });

      if (!lead) {
        return { success: false, errors: ["Lead not found"] };
      }

      const currentMetadata = (lead.stateMetadata as any) || {};

      // Update lead
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          currentStageId: targetStageId,
          stateMetadata: {
            ...currentMetadata,
            lastTransition: new Date().toISOString(),
            lastTransitionEvent: event,
            lastTransitionMetadata: metadata,
          },
          lastModified: new Date(),
        },
      });

      // Record state transition
      await prisma.stateTransition.create({
        data: {
          leadId,
          tenantId: lead.tenantId,
          fromStageId: lead.currentStageId,
          toStageId: targetStageId,
          event,
          triggeredBy: userId,
          metadata,
        },
      });

      console.log(
        `Successfully transitioned lead ${leadId} to stage ${targetStageId}`
      );
      return { success: true };
    } catch (error) {
      console.error("Error in transitionLead:", error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Get state transition history for a lead
   */
  async getTransitionHistory(leadId: string): Promise<
    Array<{
      id: string;
      fromStage: string | null;
      toStage: string;
      event: string;
      triggeredBy: string;
      triggeredAt: Date;
      metadata: any;
    }>
  > {
    const transitions = await prisma.stateTransition.findMany({
      where: { leadId },
      include: {
        fromStage: true,
        toStage: true,
      },
      orderBy: { triggeredAt: "desc" },
    });

    return transitions.map((t) => ({
      id: t.id,
      fromStage: t.fromStage?.name || null,
      toStage: t.toStage.name,
      event: t.event,
      triggeredBy: t.triggeredBy,
      triggeredAt: t.triggeredAt,
      metadata: t.metadata,
    }));
  }
}

// Export singleton instance
export const leadStateManager = new LeadStateManager();
