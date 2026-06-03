import { prisma } from "./prisma";
import { getFineractServiceWithSession } from "./fineract-api";
import { applyTopupDisbursementCharges } from "./topup-disbursement-charge-service";
import { getPaymentTypeInfo, isPaymentTypeCash } from "./cash-repayment-teller";
import { resolveCurrentUserCashierContext } from "./current-user-cashier";
import {
  createSavingsAccount,
  approveSavingsAccount,
  activateSavingsAccount,
  formatFineractDate,
} from "./fineract-savings-service";
import {
  getPendingFacilityForClient,
  getActiveFacilityForClient,
  getFacilityLoanLink,
  updateFacility,
} from "./fineract-credit-facility";
import {
  recordMobileMoneyPayout,
  reverseMobileMoneyPayout,
} from "./mobile-money-transactions";
import type { AssignmentStrategy, AssignmentConfig } from "@/shared/defaults/team-config";

export interface FineractOverrides {
  approvalDate?: string;
  disbursementDate?: string;
  approvedAmount?: number;
  note?: string;
  payoutNote?: string;
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
  private static normalizeRoleName(roleName: string | null | undefined): string {
    return (roleName || "")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
  }

  private static normalizeOfficeName(officeName: string | null | undefined): string {
    return (officeName || "").trim().toLowerCase();
  }

  private static getLeadDisplayName(lead: any): string {
    return lead.firstname
      ? [lead.firstname, lead.middlename, lead.lastname].filter(Boolean).join(" ")
      : lead.fullname || lead.tradingName || lead.externalId || "Unknown Client";
  }

  private static getUserRoleNames(user: any): string[] {
    const roles = Array.isArray(user?.selectedRoles)
      ? user.selectedRoles
      : Array.isArray(user?.roles)
        ? user.roles
        : [];

    return roles
      .map((role: any) =>
        typeof role === "string" ? role : role?.name
      )
      .filter(Boolean)
      .map((roleName: string) => this.normalizeRoleName(roleName));
  }

  private static userMatchesLeadOffice(user: any, lead: any): boolean {
    if (lead.officeId != null && user?.officeId != null) {
      return Number(user.officeId) === Number(lead.officeId);
    }

    return (
      this.normalizeOfficeName(user?.officeName) !== "" &&
      this.normalizeOfficeName(user?.officeName) ===
        this.normalizeOfficeName(lead.officeName)
    );
  }

  private static async getPreDisbursementStage(
    tenantId: string
  ): Promise<any | null> {
    const disbursementStage = await prisma.pipelineStage.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { fineractAction: "disburse" },
          { fineractStatus: { contains: "disburs", mode: "insensitive" } },
          { name: { contains: "disburs", mode: "insensitive" } },
        ],
      },
      orderBy: { order: "asc" },
    });

    if (!disbursementStage) {
      return null;
    }

    return prisma.pipelineStage.findFirst({
      where: {
        tenantId,
        isActive: true,
        order: { lt: disbursementStage.order },
      },
      orderBy: { order: "desc" },
    });
  }

  private static isRejectedStage(stage: any | null | undefined): boolean {
    if (!stage) return false;

    const fineractAction = this.normalizeRoleName(stage.fineractAction);
    const fineractStatus = this.normalizeRoleName(stage.fineractStatus);
    const stageName = this.normalizeRoleName(stage.name);

    return (
      fineractAction === "REJECT" ||
      fineractStatus.includes("REJECT") ||
      stageName.includes("REJECT")
    );
  }

  private static async notifyLoanOfficersAndBranchManagers(
    tenantId: string,
    lead: any,
    targetStage: any,
    triggeredBy: string
  ): Promise<void> {
    const preDisbursementStage = await this.getPreDisbursementStage(tenantId);
    const isApprovalReadyStage =
      preDisbursementStage && preDisbursementStage.id === targetStage?.id;
    const isRejectedStage = this.isRejectedStage(targetStage);

    if (!isApprovalReadyStage && !isRejectedStage) {
      return;
    }

    const fineractService = await getFineractServiceWithSession();
    const users = await fineractService.getUsers();
    const numericTriggeredBy = Number(triggeredBy);
    const clientName = this.getLeadDisplayName(lead);

    const recipients = new Map<number, any>();

    for (const user of users) {
      const userId = Number(user?.id);
      if (!Number.isFinite(userId) || userId === numericTriggeredBy) {
        continue;
      }

      const roleNames = this.getUserRoleNames(user);
      const isBranchManager = roleNames.includes("BRANCH_MANAGER");
      const isLoanOfficer = roleNames.includes("LOAN_OFFICER");

      if (!isBranchManager && !isLoanOfficer) {
        continue;
      }

      if (isBranchManager && this.userMatchesLeadOffice(user, lead)) {
        recipients.set(userId, user);
        continue;
      }

      if (isLoanOfficer) {
        const primaryLoanOfficerId =
          lead.loanOfficerId != null
            ? Number(lead.loanOfficerId)
            : lead.assignedToUserId != null
              ? Number(lead.assignedToUserId)
              : null;

        if (primaryLoanOfficerId != null && userId === primaryLoanOfficerId) {
          recipients.set(userId, user);
          continue;
        }

        if (primaryLoanOfficerId == null && this.userMatchesLeadOffice(user, lead)) {
          recipients.set(userId, user);
        }
      }
    }

    if (recipients.size === 0) {
      return;
    }

    const title = isRejectedStage
      ? "Lead Rejected"
      : "Lead Ready for Disbursement";
    const message = isRejectedStage
      ? `${clientName} has been rejected.`
      : `${clientName} has been ${targetStage?.name || "approved"} and is ready for disbursement.`;
    const type = isRejectedStage ? "WARNING" : "SUCCESS";

    await prisma.alert.createMany({
      data: Array.from(recipients.values()).map((user) => ({
        tenantId,
        mifosUserId: Number(user.id),
        type,
        title,
        message,
        actionUrl: `/leads/${lead.id}`,
        actionLabel: "View Lead",
        metadata: {
          leadId: lead.id,
          leadOfficeId: lead.officeId ?? null,
          leadOfficeName: lead.officeName ?? null,
          loanOfficerId: lead.loanOfficerId ?? null,
          assignedToUserId: lead.assignedToUserId ?? null,
          targetStageId: targetStage?.id ?? null,
          targetStageName: targetStage?.name ?? null,
          notificationType: isRejectedStage
            ? "LEAD_REJECTED"
            : "LEAD_READY_FOR_DISBURSEMENT",
        },
        createdBy: "system",
      })),
      skipDuplicates: false,
    });

    console.log(
      `[StateTransition] Sent ${recipients.size} loan-officer/branch-manager notification(s) for lead ${lead.id} entering ${targetStage?.name}`
    );
  }

  private static async derivePayoutMethod(
    paymentTypeId?: number
  ): Promise<"CASH" | "MOBILE_MONEY" | "BANK_TRANSFER" | undefined> {
    if (!paymentTypeId) return undefined;

    const paymentType = await getPaymentTypeInfo(paymentTypeId);
    const paymentTypeIsCash = paymentType?.isCashPayment ?? (await isPaymentTypeCash(paymentTypeId));

    if (paymentTypeIsCash) {
      return "CASH";
    }

    const normalizedName = (paymentType?.name || "").trim().toUpperCase();
    if (
      normalizedName.includes("MOBILE") ||
      normalizedName.includes("MOMO") ||
      normalizedName.includes("AIRTEL") ||
      normalizedName.includes("MTN")
    ) {
      return "MOBILE_MONEY";
    }

    return "BANK_TRANSFER";
  }

  private static async validateCombinedDisbursementPayout(
    lead: any,
    overrides?: FineractOverrides,
    triggeredBy?: string
  ): Promise<FineractOverrides | undefined> {
    if (!overrides?.payoutMethod && overrides?.paymentTypeId) {
      overrides = {
        ...overrides,
        payoutMethod: await this.derivePayoutMethod(overrides.paymentTypeId),
      };
    }

    if (!overrides?.payoutMethod) {
      return overrides;
    }

    if (!overrides.paymentTypeId) {
      throw new Error("Payment type is required when combining disbursement and payout");
    }

    const paymentTypeIsCash = await isPaymentTypeCash(overrides.paymentTypeId);

    if (overrides.payoutMethod === "CASH") {
      if (!paymentTypeIsCash) {
        throw new Error("Cash payout requires a cash disbursement payment type");
      }

      // Resolve the logged-in cashier up front so we can block before disbursement.
      if (!overrides.tellerId || !overrides.cashierId) {
        const cashierContext = await resolveCurrentUserCashierContext(
          lead.tenantId,
          triggeredBy
        );

        if (!cashierContext.isCashier) {
          throw new Error(
            cashierContext.reason || "Only an active cashier can process a cash payout"
          );
        }

        if (!cashierContext.hasActiveSession) {
          throw new Error(
            cashierContext.reason || "Cashier must have an active session to process a cash payout"
          );
        }

        return {
          ...overrides,
          tellerId: cashierContext.fineractTellerId?.toString() || cashierContext.tellerId || undefined,
          cashierId: cashierContext.cashierId || cashierContext.fineractCashierId?.toString(),
        };
      }

      return overrides;
    }

    if (paymentTypeIsCash) {
      throw new Error("Non-cash payout requires a non-cash disbursement payment type");
    }

    return overrides;
  }

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
      const currentFineractAction = lead.currentStage?.fineractAction;
      const isBackward = targetStage && lead.currentStage
        && (targetStage.order ?? 999) < (lead.currentStage.order ?? 0);
      const combinedPayoutWithDisbursement =
        targetStage?.fineractAction === "disburse" &&
        !isBackward &&
        Boolean(request.fineractOverrides?.payoutMethod);

      if (combinedPayoutWithDisbursement) {
        request.fineractOverrides = await this.validateCombinedDisbursementPayout(
          lead,
          request.fineractOverrides,
          request.triggeredBy
        );
      }

      let fineractResult: string | null = null;

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

      // 3a-r. RCF approve — approve+activate the savings account already created at submission
      const isRcfApprove = targetStage?.fineractAction === "approve"
        && (lead as any).facilityType === "REVOLVING_CREDIT"
        && (lead as any).fineractSavingsAccountId
        && !isBackward;

      if (isRcfApprove) {
        console.log(`[StateTransition] Approving revolving credit savings account for lead ${lead.id}`);
        try {
          fineractResult = await this.approveRevolvingFacility(lead);
          console.log(`[StateTransition] RCF approval succeeded: ${fineractResult}`);
        } catch (err: any) {
          const errorDetail =
            err?.response?.data?.errors?.[0]?.defaultUserMessage
            || err?.response?.data?.defaultUserMessage
            || (err instanceof Error ? err.message : "Unknown error");
          console.error("[StateTransition] RCF approval failed — blocking transition:", errorDetail);
          return {
            success: false,
            message: `RCF savings account approval failed: ${errorDetail}`,
          };
        }
      }

      // 3a-r2. Revolving credit activation — no loan ID required, uses savings account
      if (targetStage?.fineractAction === "activate_revolving" && !isBackward) {
        console.log(`[StateTransition] Activating revolving credit facility for lead ${lead.id}`);
        try {
          fineractResult = await this.activateRevolvingFacility(lead);
          console.log(`[StateTransition] Revolving activation succeeded: ${fineractResult}`);
        } catch (err: any) {
          const errorDetail =
            err?.response?.data?.errors?.[0]?.defaultUserMessage
            || err?.response?.data?.defaultUserMessage
            || (err instanceof Error ? err.message : "Unknown error");
          console.error("[StateTransition] Revolving activation failed — blocking transition:", errorDetail);
          return {
            success: false,
            message: `Revolving facility activation failed: ${errorDetail}`,
          };
        }
      }

      // 3aa. Combined disbursement + payout — process payout immediately after
      // successful disbursement so the user completes both in one action.
      if (
        combinedPayoutWithDisbursement &&
        lead.fineractLoanId &&
        request.fineractOverrides?.payoutMethod
      ) {
        try {
          const payoutResult = await this.processInternalPayout(
            lead,
            request.fineractOverrides,
            request.triggeredBy
          );
          fineractResult = fineractResult
            ? `${fineractResult}. ${payoutResult}`
            : payoutResult;
        } catch (payoutError: any) {
          const errorDetail =
            payoutError?.response?.data?.errors?.[0]?.defaultUserMessage
            || payoutError?.response?.data?.defaultUserMessage
            || (payoutError instanceof Error ? payoutError.message : "Unknown error");

          let rollbackMessage = "";
          try {
            if (lead.fineractLoanId) {
              await this.undoFineractAction(
                "disburse",
                lead.fineractLoanId,
                lead,
                "Combined disbursement+payout failed; disbursement rolled back"
              );
              rollbackMessage = " Disbursement was rolled back.";
            }
          } catch (rollbackError: any) {
            const rollbackDetail =
              rollbackError?.response?.data?.errors?.[0]?.defaultUserMessage
              || rollbackError?.response?.data?.defaultUserMessage
              || (rollbackError instanceof Error ? rollbackError.message : "Unknown error");
            rollbackMessage = ` Disbursement rollback also failed: ${rollbackDetail}`;
          }

          console.error("[StateTransition] Combined payout failed — blocking transition:", errorDetail);
          return {
            success: false,
            message: `Payout failed after disbursement: ${errorDetail}.${rollbackMessage}`.replace(/\.\s*\./g, "."),
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

      this.notifyLoanOfficersAndBranchManagers(
        lead.tenantId,
        updatedLead,
        targetStage,
        request.triggeredBy
      ).catch((err) =>
        console.error(
          "[StateTransition] Failed to send loan officer/branch manager notifications:",
          err
        )
      );

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

        // Activate PENDING credit facility on loan approval (non-blocking)
        if (lead?.fineractClientId) {
          try {
            const pendingFacility = await getPendingFacilityForClient(lead.fineractClientId);
            if (pendingFacility) {
              await updateFacility(lead.fineractClientId, pendingFacility.id, { status: "ACTIVE" });
              console.log(`[StateTransition] Credit facility ${pendingFacility.facility_ref} activated`);
            }
          } catch (facilityErr) {
            console.error("[StateTransition] Failed to activate credit facility:", facilityErr);
          }
        }

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

        // Update credit facility utilization counters (non-blocking)
        if (lead?.fineractClientId) {
          try {
            const facility = await getActiveFacilityForClient(lead.fineractClientId);
            if (facility) {
              const disbursedAmount = loanDetails?.approvedPrincipal ?? loanDetails?.principal ?? 0;
              const newUtilized = facility.utilized_amount + disbursedAmount;
              const newTranches = facility.disbursed_tranches + 1;
              const shouldClose = newUtilized >= facility.credit_limit || newTranches >= facility.drawdown_tranches;
              await updateFacility(lead.fineractClientId, facility.id, {
                utilized_amount: newUtilized,
                disbursed_tranches: newTranches,
                ...(shouldClose ? { status: "CLOSED" } : {}),
              });
              console.log(`[StateTransition] Credit facility ${facility.facility_ref} utilization updated${shouldClose ? " — facility CLOSED (fully utilized)" : ""}`);
            }
          } catch (facilityErr) {
            console.error("[StateTransition] Failed to update credit facility utilization:", facilityErr);
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
      case "activate_revolving": {
        // Handled by the dedicated activateRevolvingFacility path — no-op here
        return `Revolving activation is handled separately`;
      }
      default:
        console.warn(`Unknown fineractAction: ${action}`);
        return `Unknown Fineract action: ${action}`;
    }
  }

  // ---------------------------------------------------------------------------
  // Revolving credit facility — approve savings account created at submission
  // ---------------------------------------------------------------------------

  private static async approveRevolvingFacility(lead: any): Promise<string> {
    const savingsId: number = lead.fineractSavingsAccountId;
    if (!savingsId) {
      throw new Error("Cannot approve revolving facility: no savings account ID on lead");
    }

    const creditLimit: number = lead.requestedAmount;
    if (!creditLimit || creditLimit <= 0) {
      throw new Error("Cannot approve revolving facility: credit limit (requestedAmount) must be greater than 0");
    }

    const today = formatFineractDate(new Date());

    await approveSavingsAccount(savingsId, today);
    await activateSavingsAccount(savingsId, today);

    const existing = await prisma.revolvingCreditFacility.findUnique({ where: { leadId: lead.id } });
    if (!existing) {
      await prisma.revolvingCreditFacility.create({
        data: {
          leadId: lead.id,
          tenantId: lead.tenantId,
          creditLimit,
          availableBalance: creditLimit,
          fineractSavingsAccountId: savingsId,
          savingsProductId: lead.savingsProductId,
          maxDrawdowns: (lead.stateMetadata as any)?.maxDrawdowns ?? 10,
        },
      });
    }

    return `RCF savings account #${savingsId} approved and activated with credit limit ${creditLimit}`;
  }

  // ---------------------------------------------------------------------------
  // Revolving credit facility activation (legacy path — no prior submission)
  // ---------------------------------------------------------------------------

  private static async activateRevolvingFacility(lead: any): Promise<string> {
    if (!lead?.fineractClientId) {
      throw new Error("Cannot activate revolving facility: lead has no Fineract client ID");
    }
    if (!lead?.savingsProductId) {
      throw new Error("Cannot activate revolving facility: no savings product selected on lead");
    }
    const creditLimit: number = lead?.requestedAmount;
    if (!creditLimit || creditLimit <= 0) {
      throw new Error("Cannot activate revolving facility: credit limit (requestedAmount) must be greater than 0");
    }

    // If the savings account was already created at wizard submission time, skip creation
    if (lead.fineractSavingsAccountId) {
      const existing = await prisma.revolvingCreditFacility.findUnique({ where: { leadId: lead.id } });
      if (existing) {
        return `Revolving facility already active, savings account #${lead.fineractSavingsAccountId}`;
      }
    }

    const today = formatFineractDate(new Date());

    const { savingsId } = await createSavingsAccount({
      clientId: lead.fineractClientId,
      productId: lead.savingsProductId,
      submittedOnDate: today,
      fieldOfficerId: (lead.stateMetadata as any)?.fieldOfficerId ?? undefined,
    });

    await approveSavingsAccount(savingsId, today);
    await activateSavingsAccount(savingsId, today);

    await prisma.lead.update({
      where: { id: lead.id },
      data: { fineractSavingsAccountId: savingsId },
    });

    await prisma.revolvingCreditFacility.create({
      data: {
        leadId: lead.id,
        tenantId: lead.tenantId,
        creditLimit,
        availableBalance: creditLimit,
        fineractSavingsAccountId: savingsId,
        savingsProductId: lead.savingsProductId,
        maxDrawdowns: (lead.stateMetadata as any)?.maxDrawdowns ?? 10,
      },
    });

    return `Revolving facility activated, savings account #${savingsId} opened with credit limit ${creditLimit}`;
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

        // Deduct from credit facility if loan was linked to one (non-blocking)
        if (lead?.fineractClientId) {
          try {
            const [link, facility] = await Promise.all([
              getFacilityLoanLink(fineractLoanId),
              getActiveFacilityForClient(lead.fineractClientId),
            ]);
            if (link && facility) {
              const loanDetails = await fetchFineractAPI(`/loans/${fineractLoanId}`);
              const disbursedAmount = loanDetails?.approvedPrincipal ?? loanDetails?.principal ?? 0;
              await updateFacility(lead.fineractClientId, facility.id, {
                utilized_amount: Math.max(0, facility.utilized_amount - disbursedAmount),
                disbursed_tranches: Math.max(0, facility.disbursed_tranches - 1),
              });
              console.log(`[StateTransition] Credit facility ${facility.facility_ref} utilization decremented`);
            }
          } catch (facilityErr) {
            console.error("[StateTransition] Failed to decrement credit facility on undo:", facilityErr);
          }
        }

        return `Fineract loan #${fineractLoanId} disbursement undone`;
      }
      case "payout": {
        // Reverse the payout: branch by payment method so mobile money returns to the pool
        const payout = await prisma.loanPayout.findUnique({
          where: {
            tenantId_fineractLoanId: { tenantId: lead.tenantId, fineractLoanId },
          },
        });

        if (payout && payout.status === "PAID") {
          if (payout.paymentMethod === "MOBILE_MONEY") {
            await reverseMobileMoneyPayout({
              tenantId: lead.tenantId,
              loanPayoutId: payout.id,
              reversedBy: "system",
              reason: reason || "Lead moved back",
            });
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
        const cashierContext = await resolveCurrentUserCashierContext(
          lead.tenantId,
          triggeredBy
        );

        if (!cashierContext.isCashier) {
          throw new Error(
            cashierContext.reason || "Only an active cashier can process a cash payout"
          );
        }

        if (!cashierContext.hasActiveSession) {
          throw new Error(
            cashierContext.reason || "Cashier must have an active session to process a cash payout"
          );
        }

        overrides = {
          ...overrides,
          tellerId:
            cashierContext.fineractTellerId?.toString() || cashierContext.tellerId || undefined,
          cashierId:
            cashierContext.cashierId || cashierContext.fineractCashierId?.toString(),
        };
      }

      // Resolve teller — the UI sends Fineract teller IDs
      const fineractTellerId = Number(overrides?.tellerId);
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
      const cashierIdStr = String(overrides?.cashierId);
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
          tellerId: teller.id,
          cashierId: cashier?.id || null,
          paidAt: new Date(),
          paidBy: triggeredBy || "system",
          notes: overrides.payoutNote || overrides.note || "Cash payout via teller",
        },
        update: {
          status: "PAID",
          paymentMethod: "CASH",
          tellerId: teller.id,
          cashierId: cashier?.id || null,
          paidAt: new Date(),
          paidBy: triggeredBy || "system",
          notes: overrides.payoutNote || overrides.note || "Cash payout via teller",
        },
      });

      return `Payout of ${currencyCode} ${amount.toLocaleString()} processed via Cash`;
    } else {
      // Non-cash (Mobile Money / Bank Transfer)
      const methodLabel = overrides.payoutMethod === "MOBILE_MONEY" ? "Mobile Money" : "Bank Transfer";

      const payoutRecord = await prisma.loanPayout.upsert({
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
          notes: overrides.payoutNote || overrides.note || `Payout via ${methodLabel}`,
        },
        update: {
          status: "PAID",
          paymentMethod: overrides.payoutMethod,
          paidAt: new Date(),
          paidBy: triggeredBy || "system",
          notes: overrides.payoutNote || overrides.note || `Payout via ${methodLabel}`,
        },
      });

      if (overrides.payoutMethod === "MOBILE_MONEY") {
        await recordMobileMoneyPayout({
          tenantId: lead.tenantId,
          loanPayoutId: payoutRecord.id,
          fineractLoanId,
          fineractClientId: lead.fineractClientId,
          clientName,
          loanAccountNo: accountNo,
          amount,
          currency: currencyCode,
          notes: payoutRecord.notes,
          createdBy: triggeredBy || "system",
        });
      }

      return `Payout of ${currencyCode} ${amount.toLocaleString()} marked as paid via ${methodLabel}`;
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

// Export singleton instance
export const teamAwareStateMachineService = new TeamAwareStateMachineService();
