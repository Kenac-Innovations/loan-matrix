import { createMachine, assign, StateMachine } from "xstate";
import { PrismaClient } from "@/app/generated/prisma";

const prisma = new PrismaClient();

export interface LeadContext {
  leadId: string;
  tenantId: string;
  leadData: any;
  validationErrors: string[];
  slaTimers: Record<string, Date>;
}

export interface LeadEvent {
  type: string;
  data?: any;
  userId?: string;
}

export interface PipelineStageConfig {
  id: string;
  name: string;
  description?: string;
  order: number;
  color: string;
  isActive: boolean;
  isInitialState: boolean;
  isFinalState: boolean;
  allowedTransitions: string[];
}

export interface ValidationRuleConfig {
  id: string;
  name: string;
  conditions: any;
  actions: any;
  severity: string;
  enabled: boolean;
  pipelineStageId?: string | null;
}

export interface SLAConfig {
  id: string;
  name: string;
  timeframe: number;
  timeUnit: string;
  escalationRules: any;
  notificationRules: any;
  enabled: boolean;
  pipelineStageId: string;
}

export class StateMachineService {
  private machines: Map<string, any> = new Map();

  /**
   * Get or generate state machine for a tenant
   */
  async getStateMachine(tenantId: string): Promise<any> {
    if (this.machines.has(tenantId)) {
      return this.machines.get(tenantId)!;
    }

    const machine = await this.generateStateMachine(tenantId);
    this.machines.set(tenantId, machine);
    return machine;
  }

  /**
   * Generate state machine from tenant configuration
   */
  async generateStateMachine(tenantId: string): Promise<any> {
    const [pipelineStages, validationRules, slaConfigs] = await Promise.all([
      this.getPipelineStages(tenantId),
      this.getValidationRules(tenantId),
      this.getSLAConfigs(tenantId),
    ]);

    const initialState =
      pipelineStages.find((stage) => stage.isInitialState)?.id ||
      pipelineStages[0]?.id;

    if (!initialState) {
      throw new Error(`No pipeline stages found for tenant ${tenantId}`);
    }

    const machine = createMachine({
      id: `lead-workflow-${tenantId}`,
      initial: initialState,
      context: {
        leadId: "",
        tenantId,
        leadData: {},
        validationErrors: [],
        slaTimers: {},
      },
      states: this.generateStates(pipelineStages, validationRules, slaConfigs),
    });

    return machine;
  }

  /**
   * Generate states configuration from pipeline stages
   */
  private generateStates(
    stages: PipelineStageConfig[],
    validationRules: ValidationRuleConfig[],
    slaConfigs: SLAConfig[]
  ) {
    const states: any = {};

    stages.forEach((stage) => {
      const stageValidations = validationRules.filter(
        (rule) => !rule.pipelineStageId || rule.pipelineStageId === stage.id
      );
      const stageSLAs = slaConfigs.filter(
        (sla) => sla.pipelineStageId === stage.id
      );

      states[stage.id] = {
        meta: {
          name: stage.name,
          description: stage.description,
          color: stage.color,
          order: stage.order,
        },
        entry: [
          // Log state entry
          assign({
            slaTimers: (context: LeadContext) => ({
              ...context.slaTimers,
              [stage.id]: new Date(),
            }),
          }),
          // Start SLA timers
          ...stageSLAs.map((sla) => `startSLATimer_${sla.id}`),
          // Entry notifications
          `notifyStageEntry_${stage.id}`,
        ],
        exit: [
          // Clear SLA timers
          ...stageSLAs.map((sla) => `clearSLATimer_${sla.id}`),
          // Exit notifications
          `notifyStageExit_${stage.id}`,
        ],
        on: this.generateTransitions(stage, stageValidations),
        type: stage.isFinalState ? "final" : undefined,
      };
    });

    return states;
  }

  /**
   * Generate transitions for a stage
   */
  private generateTransitions(
    stage: PipelineStageConfig,
    validations: ValidationRuleConfig[]
  ) {
    const transitions: any = {};

    // Add transitions to allowed stages
    stage.allowedTransitions.forEach((targetStageId) => {
      const eventName = `TRANSITION_TO_${targetStageId}`;
      transitions[eventName] = {
        target: targetStageId,
        cond: `canTransitionTo_${targetStageId}`,
        actions: [
          `logTransition`,
          `validateTransition_${targetStageId}`,
          `recordStateTransition`,
        ],
      };
    });

    // Add SLA breach events
    transitions.SLA_BREACH = {
      actions: ["handleSLABreach", "notifySLABreach"],
    };

    // Add validation failure events
    transitions.VALIDATION_FAILED = {
      actions: ["handleValidationFailure", "notifyValidationFailure"],
    };

    return transitions;
  }

  /**
   * Get pipeline stages for tenant
   */
  private async getPipelineStages(
    tenantId: string
  ): Promise<PipelineStageConfig[]> {
    const stages = await prisma.pipelineStage.findMany({
      where: { tenantId, isActive: true },
      orderBy: { order: "asc" },
    });

    return stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      description: stage.description || undefined,
      order: stage.order,
      color: stage.color,
      isActive: stage.isActive,
      isInitialState: stage.isInitialState,
      isFinalState: stage.isFinalState,
      allowedTransitions: stage.allowedTransitions,
    }));
  }

  /**
   * Get validation rules for tenant
   */
  private async getValidationRules(
    tenantId: string
  ): Promise<ValidationRuleConfig[]> {
    const rules = await prisma.validationRule.findMany({
      where: { tenantId, enabled: true },
      orderBy: { order: "asc" },
    });

    return rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      conditions: rule.conditions,
      actions: rule.actions,
      severity: rule.severity,
      enabled: rule.enabled,
      pipelineStageId: rule.pipelineStageId,
    }));
  }

  /**
   * Get SLA configurations for tenant
   */
  private async getSLAConfigs(tenantId: string): Promise<SLAConfig[]> {
    const slas = await prisma.sLAConfig.findMany({
      where: { tenantId, enabled: true },
    });

    return slas.map((sla) => ({
      id: sla.id,
      name: sla.name,
      timeframe: sla.timeframe,
      timeUnit: sla.timeUnit,
      escalationRules: sla.escalationRules,
      notificationRules: sla.notificationRules,
      enabled: sla.enabled,
      pipelineStageId: sla.pipelineStageId,
    }));
  }

  /**
   * Execute state transition for a lead
   */
  async executeTransition(
    leadId: string,
    event: string,
    data?: any,
    userId?: string
  ): Promise<{ success: boolean; newState?: string; errors?: string[] }> {
    try {
      // Get lead with current state
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: { currentStage: true },
      });

      if (!lead) {
        return { success: false, errors: ["Lead not found"] };
      }

      // Get state machine for tenant
      const machine = await this.getStateMachine(lead.tenantId);

      // Create machine instance with current context
      const stateMetadata = lead.stateMetadata as any;
      const currentState = machine.resolveState({
        value: lead.currentStageId || "",
        context: {
          leadId,
          tenantId: lead.tenantId,
          leadData: lead,
          validationErrors: [],
          slaTimers: stateMetadata?.slaTimers || {},
        },
      });

      // Execute transition
      const nextState = machine.transition(currentState, {
        type: event,
        data,
        userId,
      });

      if (nextState.changed) {
        // Update lead in database
        await this.updateLeadState(
          leadId,
          nextState.value as string,
          nextState.context,
          event,
          userId
        );

        return {
          success: true,
          newState: nextState.value as string,
        };
      } else {
        return {
          success: false,
          errors: ["Invalid transition"],
        };
      }
    } catch (error) {
      console.error("Error executing transition:", error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      };
    }
  }

  /**
   * Update lead state in database
   */
  private async updateLeadState(
    leadId: string,
    newStageId: string,
    context: LeadContext,
    event: string,
    userId?: string
  ) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { currentStageId: true, tenantId: true },
    });

    if (!lead) throw new Error("Lead not found");

    // Update lead
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        currentStageId: newStageId,
        stateContext: context.leadData,
        stateMetadata: {
          slaTimers: context.slaTimers,
          lastTransition: new Date(),
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
        toStageId: newStageId,
        event,
        triggeredBy: userId || "system",
        context: context.leadData,
        metadata: {
          timestamp: new Date(),
          slaTimers: context.slaTimers,
        },
      },
    });
  }

  /**
   * Clear cached state machine for tenant
   */
  clearCache(tenantId: string) {
    this.machines.delete(tenantId);
  }

  /**
   * Clear all cached state machines
   */
  clearAllCache() {
    this.machines.clear();
  }

  /**
   * Get available transitions for a lead
   */
  async getAvailableTransitions(leadId: string): Promise<string[]> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { currentStage: true },
    });

    if (!lead || !lead.currentStage) {
      return [];
    }

    return lead.currentStage.allowedTransitions;
  }

  /**
   * Validate if a transition is allowed
   */
  async canTransition(leadId: string, targetStageId: string): Promise<boolean> {
    const availableTransitions = await this.getAvailableTransitions(leadId);
    return availableTransitions.includes(targetStageId);
  }
}

// Export singleton instance
export const stateMachineService = new StateMachineService();
