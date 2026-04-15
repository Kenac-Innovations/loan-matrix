import { prisma } from "./prisma";
import { getFineractServiceWithSession } from "./fineract-api";
import { applyTopupDisbursementCharges } from "./topup-disbursement-charge-service";
import type { AssignmentStrategy, AssignmentConfig } from "@/shared/defaults/team-config";

export interface FineractOverrides {
  approvalDate?: string;
  disbursementDate?: string;
  approvedAmount?: number;
  note?: string;
  paymentTypeId?: number;
  accountNumber?: string;
  checkNumber?: string;
  routingCode?: string;
  receiptNumber?: string;
  bankNumber?: string;
  rejectionDate?: string;
  // Payout fields
  payoutMethod?: "CASH" | "MOBILE_MONEY" | "BANK_TRANSFER";
  tellerId?: string;
  cashierId?: string;
}

export interface StateTransitionRequest {
  leadId: string;
  targetStageId: string;
  event?: string;
  context?: any;
  triggeredBy: string;
  reason?: string;
  fineractOverrides?: FineractOverrides;
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

      // 1b. Approval gate: if the CURRENT stage requires multiple approvals,
      //     verify enough unique approvals have been collected before allowing transition.
      const currentRequiredApprovals = lead.currentStage?.requiredApprovals ?? 1;
      if (currentRequiredApprovals > 1 && lead.currentStageId) {
        const approvalCount = await prisma.stageApproval.count({
          where: { leadId: request.leadId, stageId: lead.currentStageId },
        });
        if (approvalCount < currentRequiredApprovals) {
          return {
            success: false,
            message: `${approvalCount} of ${currentRequiredApprovals} approvals collected. ${currentRequiredApprovals - approvalCount} more needed before this lead can move forward.`,
          };
        }
      }

      // 1c. Skip check: if TARGET stage has skipBelowAmount and the loan qualifies,
      //     find the next eligible stage in the pipeline.
      let resolvedTargetStageId = request.targetStageId;
      const skippedStages: string[] = [];

      const candidateStage = await prisma.pipelineStage.findUnique({
        where: { id: resolvedTargetStageId },
      });

      // Resolve loan amount: use local requestedAmount, fall back to Fineract principal
      let loanAmount = lead.requestedAmount;
      if (loanAmount == null && candidateStage?.skipBelowAmount && lead.fineractLoanId) {
        try {
          const fineract = await getFineractServiceWithSession();
          const loanDetails = await fineract.getLoan(lead.fineractLoanId);
          loanAmount =
            loanDetails?.approvedPrincipal ||
            loanDetails?.principal ||
            loanDetails?.proposedPrincipal ||
            null;
          console.log(`[StateTransition] Resolved loan amount from Fineract: ${loanAmount}`);
        } catch {
          console.warn("[StateTransition] Could not fetch Fineract loan for skip check");
        }
      }

      if (
        candidateStage?.skipBelowAmount &&
        loanAmount !== null &&
        loanAmount !== undefined &&
        loanAmount < candidateStage.skipBelowAmount
      ) {
        const allStages = await prisma.pipelineStage.findMany({
          where: { tenantId: lead.tenantId, isActive: true },
          orderBy: { order: "asc" },
        });

        let currentOrder = candidateStage.order;
        let nextStage = candidateStage;
        while (
          nextStage?.skipBelowAmount &&
          loanAmount < nextStage.skipBelowAmount
        ) {
          skippedStages.push(nextStage.id);
          const following = allStages.find((s) => s.order > currentOrder);
          if (!following) break;
          nextStage = following;
          currentOrder = following.order;
        }

        if (skippedStages.length > 0 && nextStage.id !== candidateStage.id) {
          console.log(
            `[StateTransition] Auto-skipping ${skippedStages.length} stage(s) for amount ${loanAmount} < thresholds`
          );
          resolvedTargetStageId = nextStage.id;
        }
      }

      // Update request to use the resolved target
      request.targetStageId = resolvedTargetStageId;

      // 1d. Execute Fineract actions from skipped stages in pipeline order
      const skippedActionResults: string[] = [];
      if (skippedStages.length > 0 && lead.fineractLoanId) {
        const skippedStageRecords = await prisma.pipelineStage.findMany({
          where: { id: { in: skippedStages } },
          orderBy: { order: "asc" },
        });

        for (const skipped of skippedStageRecords) {
          if (skipped.fineractAction && skipped.fineractAction !== "payout") {
            console.log(
              `[StateTransition] Executing skipped stage action: ${skipped.fineractAction} from "${skipped.name}"`
            );
            try {
              // Use today's date as default; Fineract fallback dates will also be used
              const autoOverrides = {
                approvalDate: new Date().toISOString().split("T")[0],
                disbursementDate: new Date().toISOString().split("T")[0],
                rejectionDate: new Date().toISOString().split("T")[0],
                note: `Auto-executed: ${skipped.fineractAction} (stage "${skipped.name}" skipped — loan amount below threshold)`,
              };
              const result = await this.triggerFineractAction(
                skipped.fineractAction,
                lead.fineractLoanId,
                autoOverrides,
                lead,
                request.triggeredBy
              );
              skippedActionResults.push(
                `${skipped.name}: ${skipped.fineractAction} succeeded`
              );
              console.log(
                `[StateTransition] Skipped stage action succeeded: ${result}`
              );
            } catch (err: any) {
              const errorDetail =
                err?.response?.data?.errors?.[0]?.defaultUserMessage ||
                err?.response?.data?.defaultUserMessage ||
                (err instanceof Error ? err.message : "Unknown error");
              console.error(
                `[StateTransition] Skipped stage action failed: ${errorDetail}`
              );
              return {
                success: false,
                message: `Auto-skip failed at "${skipped.name}" (${skipped.fineractAction}): ${errorDetail}`,
              };
            }
          }
        }
      }

      // 2. Determine assignment for the target stage
      const assignment = await this.resolveAssignment(
        request.leadId,
        request.targetStageId,
        lead.tenantId
      );

      // 3. Determine if moving backward from a stage that had a Fineract action.
      //    If the CURRENT stage executed an action (approve/disburse/payout),
      //    undo it before proceeding.
      const targetStage = await prisma.pipelineStage.findUnique({
        where: { id: request.targetStageId },
      });

      let fineractResult: string | null = null;
      const currentFineractAction = lead.currentStage?.fineractAction;
      const isBackward = targetStage && lead.currentStage
        && (targetStage.order ?? 999) < (lead.currentStage.order ?? 0);

      if (isBackward && currentFineractAction && lead.fineractLoanId) {
        console.log(`[StateTransition] Backward move detected: undoing ${currentFineractAction} for loan ${lead.fineractLoanId}`);
        try {
          const undoResult = await this.undoFineractAction(
            currentFineractAction,
            lead.fineractLoanId,
            lead,
            request.reason
          );
          console.log(`[StateTransition] Undo succeeded: ${undoResult}`);
          fineractResult = undoResult;
        } catch (undoError: any) {
          const errorDetail =
            undoError?.response?.data?.errors?.[0]?.defaultUserMessage
            || undoError?.response?.data?.defaultUserMessage
            || (undoError instanceof Error ? undoError.message : "Unknown error");
          console.error("[StateTransition] Undo Fineract action failed — blocking transition:", errorDetail);
          return {
            success: false,
            message: `Cannot move back: undo ${currentFineractAction} failed — ${errorDetail}`,
          };
        }
      }

      // 3a. If the TARGET stage requires a Fineract action, execute it FIRST
      //     so the transition is blocked if Fineract rejects the operation.
      //     Payout is an internal action and is handled separately.
      const isFineractAction = targetStage?.fineractAction
        && targetStage.fineractAction !== "payout"
        && lead.fineractLoanId
        && !isBackward;

      if (isFineractAction) {
        console.log(`[StateTransition] Triggering Fineract action: ${targetStage.fineractAction} for loan ${lead.fineractLoanId}`, request.fineractOverrides);
        try {
          fineractResult = await this.triggerFineractAction(
            targetStage.fineractAction!,
            lead.fineractLoanId!,
            request.fineractOverrides,
            lead,
            request.triggeredBy
          );
          console.log(`[StateTransition] Fineract action succeeded: ${fineractResult}`);
        } catch (fineractError: any) {
          const errorDetail =
            fineractError?.response?.data?.errors?.[0]?.defaultUserMessage
            || fineractError?.response?.data?.defaultUserMessage
            || (fineractError instanceof Error ? fineractError.message : "Unknown error");
          console.error("[StateTransition] Fineract action failed — blocking transition:", errorDetail);
          return {
            success: false,
            message: `Fineract ${targetStage.fineractAction} failed: ${errorDetail}`,
          };
        }
      }

      // 3b. Internal payout — process BEFORE the DB transition so we can block on failure
      if (targetStage?.fineractAction === "payout" && lead.fineractLoanId && !isBackward) {
        console.log(`[StateTransition] Processing internal payout for loan ${lead.fineractLoanId}`);
        try {
          fineractResult = await this.processInternalPayout(
            lead,
            request.fineractOverrides,
            request.triggeredBy
          );
          console.log(`[StateTransition] Internal payout succeeded: ${fineractResult}`);
        } catch (payoutError: any) {
          const errorDetail =
            payoutError?.response?.data?.errors?.[0]?.defaultUserMessage
            || payoutError?.response?.data?.defaultUserMessage
            || (payoutError instanceof Error ? payoutError.message : "Unknown error");
          console.error("[StateTransition] Payout failed — blocking transition:", errorDetail);
          return {
            success: false,
            message: `Payout failed: ${errorDetail}`,
          };
        }
      }

      // 4. Actions succeeded (or weren't needed) — now commit the DB transition
      const [updatedLead, transition] = await prisma.$transaction([
        prisma.lead.update({
          where: { id: request.leadId },
          data: {
            currentStageId: request.targetStageId,
            assignedToUserId: null,
            assignedToUserName: null,
            assignedAt: null,
            assignedByUserId: null,
            stateMetadata: {
              lastTransition: new Date().toISOString(),
              lastTransitionEvent: request.event || "MANUAL_TRANSITION",
              reason: request.reason,
              previousAssignment: {
                userId: lead.assignedToUserId,
                userName: lead.assignedToUserName,
              },
              fineractResult: fineractResult || undefined,
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
              fineractResult: fineractResult || undefined,
              timestamp: new Date().toISOString(),
            },
          },
          include: { fromStage: true, toStage: true },
        }),
      ]);

      // 5. Cleanup approvals after successful transition
      if (lead.currentStageId) {
        if (isBackward) {
          // Moving backward: clear approvals for all stages at or above the target order
          const stagesToClear = await prisma.pipelineStage.findMany({
            where: {
              tenantId: lead.tenantId,
              isActive: true,
              order: { gte: targetStage?.order ?? 0 },
            },
            select: { id: true },
          });
          if (stagesToClear.length > 0) {
            await prisma.stageApproval.deleteMany({
              where: {
                leadId: request.leadId,
                stageId: { in: stagesToClear.map((s) => s.id) },
              },
            });
          }
        } else {
          // Moving forward: clear approvals for the old stage (consumed)
          await prisma.stageApproval.deleteMany({
            where: { leadId: request.leadId, stageId: lead.currentStageId },
          });
        }
      }

      // Record AUTO_SKIPPED transitions for any bypassed stages
      if (skippedStages.length > 0) {
        await prisma.stateTransition.createMany({
          data: skippedStages.map((skippedId) => ({
            leadId: request.leadId,
            tenantId: lead.tenantId,
            fromStageId: lead.currentStageId,
            toStageId: skippedId,
            event: "AUTO_SKIPPED",
            triggeredBy: request.triggeredBy,
            metadata: {
              reason: `Auto-skipped: loan amount ${loanAmount} below stage threshold`,
              timestamp: new Date().toISOString(),
            },
          })),
        });
      }

      const skipNote = skippedActionResults.length > 0
        ? ` (auto-skipped: ${skippedActionResults.join(", ")})`
        : skippedStages.length > 0
        ? ` (${skippedStages.length} stage(s) auto-skipped)`
        : "";
      const baseMsg = fineractResult
        ? `Lead moved to ${targetStage?.name}. ${fineractResult}${skipNote}`
        : `Lead moved to ${targetStage?.name} — awaiting assignment${skipNote}`;

      // Post transition note to Fineract loan if available
      if (lead.fineractLoanId && request.reason) {
        const noteText = `[Stage Transition] ${transition.fromStage?.name || "Unknown"} → ${transition.toStage?.name || "Unknown"}\n${request.reason}`;
        this.postFineractNote(lead.fineractLoanId, noteText).catch((err) =>
          console.error("[StateTransition] Failed to post Fineract note:", err)
        );
      }

      // Notify team members of the receiving stage
      this.notifyTeamMembers(
        lead.tenantId,
        request.targetStageId,
        lead,
        targetStage?.name || "Unknown Stage",
        request.triggeredBy
      ).catch((err) => console.error("[StateTransition] Failed to send notifications:", err));

      return {
        success: true,
        message: baseMsg,
        lead: updatedLead,
        transition,
        assignedTeam: validation.teamInfo,
        assignedMember: null,
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

      // Permission check is against the CURRENT stage's team:
      // only members of the team owning the current stage can push the lead forward.
      if (currentStageId) {
        const teamPermission = await this.checkTeamPermissions(
          currentStageId,
          tenantId,
          userId
        );

        if (!teamPermission.canTransition) {
          return { isValid: false, message: teamPermission.message };
        }
      }

      // Look up the receiving team (for audit/assignment purposes only)
      const receivingTeams = await this.getTeamsForStage(targetStageId, tenantId);
      const receivingTeam = receivingTeams[0] ?? null;

      return {
        isValid: true,
        message: "Valid transition with team permissions",
        teamInfo: receivingTeam,
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

  /**
   * Checks whether the user belongs to a team that owns the given stage.
   * Called with the CURRENT stage so only the team handling the lead right now
   * can push it forward — regardless of which team owns the target stage.
   */
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
          message: `You are not a member of the team currently handling this stage (${teams
            .map((t) => t.name)
            .join(", ")})`,
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
  // Fineract integration
  // ---------------------------------------------------------------------------

  private static async triggerFineractAction(
    action: string,
    fineractLoanId: number,
    overrides?: FineractOverrides,
    lead?: any,
    triggeredBy?: string
  ): Promise<string> {
    const fineract = await getFineractServiceWithSession();

    const formatDateForFineract = (isoDate: string): string => {
      const d = new Date(isoDate);
      const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    const formatFineractDateArr = (dateArr: number[] | undefined): string | undefined => {
      if (!dateArr || dateArr.length < 3) return undefined;
      const [y, m, d] = dateArr;
      const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      return `${d} ${months[m - 1]} ${y}`;
    };

    // Fetch loan details as fallback for dates
    let loanDetails: any = null;
    try {
      loanDetails = await fineract.getLoan(fineractLoanId);
    } catch (e) {
      console.warn("[StateTransition] Could not fetch loan details for date resolution:", e);
    }

    switch (action) {
      case "approve": {
        const approveDate = overrides?.approvalDate
          ? formatDateForFineract(overrides.approvalDate)
          : formatFineractDateArr(loanDetails?.timeline?.submittedOnDate);
        await fineract.approveLoan(fineractLoanId, approveDate);
        return `Fineract loan #${fineractLoanId} approved`;
      }
      case "disburse": {
        const disburseDate = overrides?.disbursementDate
          ? formatDateForFineract(overrides.disbursementDate)
          : formatFineractDateArr(loanDetails?.timeline?.expectedDisbursementDate)
            || formatFineractDateArr(loanDetails?.timeline?.approvedOnDate);
        await fineract.disburseLoan(fineractLoanId, disburseDate, {
          paymentTypeId: overrides?.paymentTypeId,
          accountNumber: overrides?.accountNumber,
          checkNumber: overrides?.checkNumber,
          routingCode: overrides?.routingCode,
          receiptNumber: overrides?.receiptNumber,
          bankNumber: overrides?.bankNumber,
          note: overrides?.note,
        });

        // Non-blocking: disbursement succeeds even when charge application fails.
        if (lead?.tenantId) {
          try {
            await applyTopupDisbursementCharges({
              loanId: fineractLoanId,
              tenantId: String(lead.tenantId),
              source: "state-transition",
            });
          } catch (error) {
            console.error("[StateTransition] Failed to apply topup disbursement charges:", error);
          }
        }

        return `Fineract loan #${fineractLoanId} disbursed`;
      }
      case "reject": {
        const rejectDate = overrides?.rejectionDate
          ? formatDateForFineract(overrides.rejectionDate)
          : formatFineractDateArr(loanDetails?.timeline?.submittedOnDate);
        await fineract.rejectLoan(fineractLoanId, rejectDate, overrides?.note);
        return `Fineract loan #${fineractLoanId} rejected`;
      }
      default:
        console.warn(`Unknown fineractAction: ${action}`);
        return `Unknown Fineract action: ${action}`;
    }
  }

  // ---------------------------------------------------------------------------
  // Fineract undo actions (backward transitions)
  // ---------------------------------------------------------------------------

  private static async undoFineractAction(
    action: string,
    fineractLoanId: number,
    lead: any,
    reason?: string
  ): Promise<string> {
    const { fetchFineractAPI } = await import("@/lib/api");

    switch (action) {
      case "approve": {
        await fetchFineractAPI(`/loans/${fineractLoanId}?command=undoapproval`, {
          method: "POST",
          body: JSON.stringify({ note: reason || "Approval undone — lead moved back" }),
        });
        return `Fineract loan #${fineractLoanId} approval undone`;
      }
      case "disburse": {
        await fetchFineractAPI(`/loans/${fineractLoanId}?command=undodisbursal`, {
          method: "POST",
          body: JSON.stringify({ note: reason || "Disbursement undone — lead moved back" }),
        });
        return `Fineract loan #${fineractLoanId} disbursement undone`;
      }
      case "payout": {
        // Reverse the payout: find the payout record, reverse the cashier transaction, and mark as reversed
        const payout = await prisma.loanPayout.findUnique({
          where: {
            tenantId_fineractLoanId: { tenantId: lead.tenantId, fineractLoanId },
          },
        });

        if (payout && payout.status === "PAID") {
          // If it was a cash payout with a cashier transaction, reverse the journal entry
          if (payout.fineractTransactionId) {
            try {
              await fetchFineractAPI(
                `/journalentries/${payout.fineractTransactionId}?command=reverse`,
                {
                  method: "POST",
                  body: JSON.stringify({
                    comments: reason || "Payout reversed — lead moved back",
                  }),
                }
              );
            } catch (err) {
              console.warn(`[Undo Payout] Could not reverse journal entry ${payout.fineractTransactionId}:`, err);
            }
          }

          // Mark payout as reversed
          await prisma.loanPayout.update({
            where: { id: payout.id },
            data: {
              status: "REVERSED",
              notes: `${payout.notes || ""}\n[REVERSED] ${reason || "Lead moved back"}`.trim(),
            },
          });
        }

        return `Payout reversed for loan #${fineractLoanId}`;
      }
      case "reject": {
        console.warn("[Undo] Cannot undo rejection in Fineract — skipping");
        return `Rejection cannot be undone in Fineract for loan #${fineractLoanId}`;
      }
      default:
        console.warn(`[Undo] Unknown fineractAction to undo: ${action}`);
        return `No undo needed for action: ${action}`;
    }
  }

  // ---------------------------------------------------------------------------
  // In-app notifications
  // ---------------------------------------------------------------------------

  private static async postFineractNote(fineractLoanId: number, note: string) {
    try {
      const { fetchFineractAPI } = await import("@/lib/api");
      await fetchFineractAPI(`/loans/${fineractLoanId}/notes`, {
        method: "POST",
        body: JSON.stringify({ note }),
      });
      console.log(`[StateTransition] Posted note to Fineract loan #${fineractLoanId}`);
    } catch (err) {
      console.error(`[StateTransition] Failed to post note to Fineract loan #${fineractLoanId}:`, err);
    }
  }

  private static async notifyTeamMembers(
    tenantId: string,
    targetStageId: string,
    lead: any,
    stageName: string,
    triggeredBy: string
  ): Promise<void> {
    const teams = await prisma.team.findMany({
      where: {
        tenantId,
        isActive: true,
        pipelineStageIds: { has: targetStageId },
      },
      include: { members: { where: { isActive: true } } },
    });

    const clientName = lead.firstname
      ? [lead.firstname, lead.middlename, lead.lastname].filter(Boolean).join(" ")
      : lead.externalId || "Unknown";

    const alerts = teams.flatMap((team) =>
      team.members
        .filter((m) => m.userId && String(m.userId) !== String(triggeredBy))
        .map((m) => ({
          tenantId,
          mifosUserId: Number(m.userId),
          type: "TASK" as const,
          title: `New lead in ${stageName}`,
          message: `${clientName} has moved to ${stageName} and is awaiting action.`,
          actionUrl: `/leads/${lead.id}`,
          actionLabel: "View Lead",
          metadata: {
            leadId: lead.id,
            stageId: targetStageId,
            stageName,
            teamId: team.id,
            teamName: team.name,
          },
          createdBy: "system",
        }))
    );

    if (alerts.length > 0) {
      await prisma.alert.createMany({ data: alerts });
      console.log(`[StateTransition] Sent ${alerts.length} notification(s) to team members for stage ${stageName}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal payout (not a Fineract action)
  // ---------------------------------------------------------------------------

  private static async processInternalPayout(
    lead: any,
    overrides?: FineractOverrides,
    triggeredBy?: string
  ): Promise<string> {
    const fineractLoanId = lead.fineractLoanId;

    // Check if already paid out — skip re-processing
    const existingPayout = await prisma.loanPayout.findUnique({
      where: {
        tenantId_fineractLoanId: { tenantId: lead.tenantId, fineractLoanId },
      },
    });
    if (existingPayout?.status === "PAID") {
      console.log(`[Payout] Loan ${fineractLoanId} already paid out — skipping`);
      return `Payout already processed for loan #${fineractLoanId}`;
    }

    if (!overrides?.payoutMethod) {
      throw new Error("Payment method is required for payout");
    }
    const clientName = lead.firstname
      ? [lead.firstname, lead.middlename, lead.lastname].filter(Boolean).join(" ")
      : "Client";

    // Get loan details from Fineract, with lead.requestedAmount as fallback
    let amount = 0;
    let currencyCode = "ZMW";
    let accountNo = "";
    try {
      const fineract = await getFineractServiceWithSession();
      const loanDetails = await fineract.getLoan(fineractLoanId);
      amount =
        loanDetails?.netDisbursalAmount ||
        loanDetails?.approvedPrincipal ||
        loanDetails?.principal ||
        loanDetails?.proposedPrincipal ||
        0;
      currencyCode = loanDetails?.currency?.code || "ZMW";
      accountNo = loanDetails?.accountNo || "";
      console.log(`[Payout] Fineract loan ${fineractLoanId} amounts:`, {
        netDisbursalAmount: loanDetails?.netDisbursalAmount,
        approvedPrincipal: loanDetails?.approvedPrincipal,
        principal: loanDetails?.principal,
        proposedPrincipal: loanDetails?.proposedPrincipal,
        resolved: amount,
      });
    } catch (e) {
      console.warn("[Payout] Could not fetch loan details, using defaults:", e);
    }

    // Fallback to lead's requested amount if Fineract returned 0
    if (!amount && lead.requestedAmount) {
      amount = lead.requestedAmount;
      console.log(`[Payout] Using lead.requestedAmount as fallback: ${amount}`);
    }

    if (!amount) {
      throw new Error("Could not determine payout amount — loan amount is 0");
    }

    if (overrides.payoutMethod === "CASH") {
      if (!overrides.tellerId || !overrides.cashierId) {
        throw new Error("Teller and cashier are required for cash payout");
      }

      // Resolve teller — the UI sends Fineract teller IDs
      const fineractTellerId = Number(overrides.tellerId);
      const teller = await prisma.teller.findFirst({
        where: {
          tenantId: lead.tenantId,
          fineractTellerId,
        },
      });

      if (!teller) {
        throw new Error(`Teller not found for Fineract ID ${fineractTellerId}`);
      }

      // Resolve cashier — the UI sends DB cashier IDs (dbId) or Fineract IDs
      const cashierIdStr = String(overrides.cashierId);
      let cashier = await prisma.cashier.findFirst({
        where: { id: cashierIdStr, tellerId: teller.id, tenantId: lead.tenantId },
      });
      if (!cashier) {
        const numId = Number(cashierIdStr);
        if (!isNaN(numId)) {
          cashier = await prisma.cashier.findFirst({
            where: { fineractCashierId: numId, tellerId: teller.id, tenantId: lead.tenantId },
          });
        }
      }

      const fineractCashierId = cashier?.fineractCashierId || Number(cashierIdStr);

      // Format date for Fineract
      const now = new Date();
      const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const txnDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

      // Settle via Fineract teller/cashier
      const fineract = await getFineractServiceWithSession();
      await fineract.settleCashForCashier(
        teller.fineractTellerId!,
        fineractCashierId,
        {
          txnAmount: String(amount),
          currencyCode,
          txnNote: overrides.note || `Loan Disbursement Payout — ${clientName}`,
          txnDate,
        }
      );

      // Create / update payout record
      await prisma.loanPayout.upsert({
        where: {
          tenantId_fineractLoanId: { tenantId: lead.tenantId, fineractLoanId },
        },
        create: {
          tenantId: lead.tenantId,
          fineractLoanId,
          fineractClientId: lead.fineractClientId,
          clientName,
          loanAccountNo: accountNo,
          amount,
          currency: currencyCode,
          status: "PAID",
          paymentMethod: "CASH",
          paidAt: new Date(),
          paidBy: triggeredBy || "system",
          notes: overrides.note || "Cash payout via teller",
        },
        update: {
          status: "PAID",
          paymentMethod: "CASH",
          paidAt: new Date(),
          paidBy: triggeredBy || "system",
          notes: overrides.note || "Cash payout via teller",
        },
      });

      return `Payout of ${currencyCode} ${amount.toLocaleString()} processed via Cash`;
    } else {
      // Non-cash (Mobile Money / Bank Transfer)
      const methodLabel = overrides.payoutMethod === "MOBILE_MONEY" ? "Mobile Money" : "Bank Transfer";

      await prisma.loanPayout.upsert({
        where: {
          tenantId_fineractLoanId: { tenantId: lead.tenantId, fineractLoanId },
        },
        create: {
          tenantId: lead.tenantId,
          fineractLoanId,
          fineractClientId: lead.fineractClientId,
          clientName,
          loanAccountNo: accountNo,
          amount,
          currency: currencyCode,
          status: "PAID",
          paymentMethod: overrides.payoutMethod,
          paidAt: new Date(),
          paidBy: triggeredBy || "system",
          notes: overrides.note || `Payout via ${methodLabel}`,
        },
        update: {
          status: "PAID",
          paymentMethod: overrides.payoutMethod,
          paidAt: new Date(),
          paidBy: triggeredBy || "system",
          notes: overrides.note || `Payout via ${methodLabel}`,
        },
      });

      return `Payout of ${currencyCode} ${amount.toLocaleString()} marked as paid via ${methodLabel}`;
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

      const currentOrder = lead.currentStage.order ?? 0;
      const currentFineractAction = lead.currentStage.fineractAction || null;

      // Resolve loan amount for skip detection
      let loanAmount = lead.requestedAmount;
      if (loanAmount == null && lead.fineractLoanId) {
        try {
          const fineract = await getFineractServiceWithSession();
          const loanDetails = await fineract.getLoan(lead.fineractLoanId);
          loanAmount =
            loanDetails?.approvedPrincipal ||
            loanDetails?.principal ||
            loanDetails?.proposedPrincipal ||
            null;
        } catch {
          // Non-blocking
        }
      }

      // Pre-fetch all stages for skip resolution
      const allStages = await prisma.pipelineStage.findMany({
        where: { tenantId: lead.tenantId, isActive: true },
        orderBy: { order: "asc" },
      });

      const results = [];

      for (const targetStageId of lead.currentStage.allowedTransitions) {
        const targetStage = await prisma.pipelineStage.findUnique({
          where: { id: targetStageId },
        });

        if (!targetStage || !targetStage.isActive) continue;

        const isBackward = (targetStage.order ?? 999) < currentOrder;

        // Determine if this stage would be skipped
        let willSkip = false;
        let skipToStageId: string | null = null;
        let skipToStageName: string | null = null;
        let skipToStageColor: string | null = null;
        let skipToFineractAction: string | null = null;

        const skippedActions: { stageName: string; action: string }[] = [];

        if (
          !isBackward &&
          targetStage.skipBelowAmount &&
          loanAmount !== null &&
          loanAmount !== undefined &&
          loanAmount < targetStage.skipBelowAmount
        ) {
          willSkip = true;
          let nextStage = targetStage;
          let nextOrder = targetStage.order;
          while (
            nextStage.skipBelowAmount &&
            loanAmount < nextStage.skipBelowAmount
          ) {
            if (nextStage.fineractAction) {
              skippedActions.push({
                stageName: nextStage.name,
                action: nextStage.fineractAction,
              });
            }
            const following = allStages.find((s) => s.order > nextOrder);
            if (!following) break;
            nextStage = following;
            nextOrder = following.order;
          }
          if (nextStage.id !== targetStage.id) {
            skipToStageId = nextStage.id;
            skipToStageName = nextStage.name;
            skipToStageColor = nextStage.color;
            skipToFineractAction = nextStage.fineractAction || null;
          }
        }

        // Resolve the effective destination for team info
        const effectiveTargetId = skipToStageId || targetStageId;
        const teams = await this.getTeamsForStage(effectiveTargetId, lead.tenantId);
        const receivingTeam = teams[0] ?? null;

        results.push({
          stageId: targetStageId,
          stageName: targetStage.name,
          stageColor: targetStage.color,
          stageDescription: targetStage.description,
          isFinalState: targetStage.isFinalState,
          fineractAction: targetStage.fineractAction || null,
          isBackward,
          undoAction: isBackward && currentFineractAction ? currentFineractAction : null,
          willSkip,
          skipToStageId,
          skipToStageName,
          skipToStageColor,
          skipToFineractAction,
          skippedActions,
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
