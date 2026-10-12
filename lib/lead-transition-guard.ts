/**
 * Server-side lifecycle checks for transitions that operate on a Fineract
 * loan.  This module is deliberately pure so the state-machine guard can be
 * tested without importing Prisma or making a Fineract request.
 */

export type LeadFineractAction =
  | "approve"
  | "reject"
  | "disburse"
  | "payout";

export type LeadTransitionGuardLead = {
  fineractLoanId?: number | null;
  facilityType?: string | null;
  fineractSavingsAccountId?: number | null;
};

export type LeadTransitionGuardLoan = {
  status?: unknown;
  loanStatus?: unknown;
  timeline?: {
    actualDisbursementDate?: unknown;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

export type LeadTransitionGuardResult = {
  allowed: boolean;
  message?: string;
};

const GUARDED_ACTIONS = new Set<LeadFineractAction>([
  "approve",
  "reject",
  "disburse",
  "payout",
]);

function normalizeToken(value: unknown): string {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/[_-]+/g, " ")
    : "";
}

function normalizeAction(value: unknown): LeadFineractAction | null {
  const action = normalizeToken(value);
  return GUARDED_ACTIONS.has(action as LeadFineractAction)
    ? (action as LeadFineractAction)
    : null;
}

function getStatusObjectValues(status: unknown): {
  text: string;
  pendingApproval: boolean;
  waitingForDisbursal: boolean;
  active: boolean;
  rejected: boolean;
  withdrawn: boolean;
} {
  if (typeof status === "string") {
    return {
      text: normalizeToken(status),
      pendingApproval: false,
      waitingForDisbursal: false,
      active: false,
      rejected: false,
      withdrawn: false,
    };
  }

  if (!status || typeof status !== "object") {
    return {
      text: "",
      pendingApproval: false,
      waitingForDisbursal: false,
      active: false,
      rejected: false,
      withdrawn: false,
    };
  }

  const statusRecord = status as Record<string, unknown>;
  const text = [statusRecord.value, statusRecord.code]
    .map(normalizeToken)
    .filter(Boolean)
    .join(" ");

  return {
    text,
    pendingApproval: statusRecord.pendingApproval === true,
    waitingForDisbursal: statusRecord.waitingForDisbursal === true,
    active: statusRecord.active === true,
    rejected: statusRecord.rejected === true,
    withdrawn: statusRecord.withdrawn === true,
  };
}

function hasWord(text: string, word: string): boolean {
  return new RegExp(`(?:^|\\s)${word}(?:$|\\s)`).test(text);
}

function hasPendingApproval(status: ReturnType<typeof getStatusObjectValues>): boolean {
  return (
    status.pendingApproval ||
    status.text.includes("pending approval") ||
    status.text.includes("pendingapproval")
  );
}

function hasWaitingForDisbursal(status: ReturnType<typeof getStatusObjectValues>): boolean {
  return (
    status.waitingForDisbursal ||
    status.text.includes("waiting for disbursal") ||
    status.text.includes("waitingfordisbursal") ||
    hasWord(status.text, "approved")
  );
}

function hasActiveOrDisbursed(
  status: ReturnType<typeof getStatusObjectValues>,
  loan: LeadTransitionGuardLoan
): boolean {
  const actualDisbursementDate = loan.timeline?.actualDisbursementDate;
  return (
    status.active ||
    hasWord(status.text, "active") ||
    status.text.includes("disbursed") ||
    (actualDisbursementDate !== null && actualDisbursementDate !== undefined &&
      actualDisbursementDate !== "")
  );
}

function isTerminal(
  status: ReturnType<typeof getStatusObjectValues>,
  loan: LeadTransitionGuardLoan
): boolean {
  const loanStatus = getStatusObjectValues(loan.loanStatus);
  const text = `${status.text} ${loanStatus.text}`.trim();

  return (
    status.rejected ||
    status.withdrawn ||
    loanStatus.rejected ||
    loanStatus.withdrawn ||
    text.includes("reject") ||
    text.includes("withdraw")
  );
}

function getLifecycleState(
  loan: LeadTransitionGuardLoan
): {
  pendingApproval: boolean;
  waitingForDisbursal: boolean;
  activeOrDisbursed: boolean;
  terminal: boolean;
  known: boolean;
} {
  const status = getStatusObjectValues(loan.status);
  const loanStatus = getStatusObjectValues(loan.loanStatus);
  const combined = {
    text: `${status.text} ${loanStatus.text}`.trim(),
    pendingApproval: status.pendingApproval || loanStatus.pendingApproval,
    waitingForDisbursal:
      status.waitingForDisbursal || loanStatus.waitingForDisbursal,
    active: status.active || loanStatus.active,
    rejected: status.rejected || loanStatus.rejected,
    withdrawn: status.withdrawn || loanStatus.withdrawn,
  };

  const pendingApproval = hasPendingApproval(combined);
  const waitingForDisbursal = hasWaitingForDisbursal(combined);
  const activeOrDisbursed = hasActiveOrDisbursed(combined, loan);
  const terminal = isTerminal(combined, loan);

  return {
    pendingApproval,
    waitingForDisbursal,
    activeOrDisbursed,
    terminal,
    known: pendingApproval || waitingForDisbursal || activeOrDisbursed || terminal,
  };
}

/**
 * Return only actions that operate on a Fineract loan.  RCF approval is a
 * savings-account operation when the lead has no loan link, so it is kept out
 * of the loan lifecycle guard.  `activate_revolving` is likewise a client /
 * savings operation and is not part of this action set.
 */
export function getLeadFineractGuardActions(
  lead: LeadTransitionGuardLead,
  stageActions: unknown[]
): LeadFineractAction[] {
  const actions = stageActions
    .map(normalizeAction)
    .filter((action): action is LeadFineractAction => action !== null);

  const isSavingsOnlyRcf =
    normalizeToken(lead.facilityType) === "revolving credit" &&
    lead.fineractSavingsAccountId != null &&
    lead.fineractLoanId == null;

  return isSavingsOnlyRcf
    ? actions.filter((action) => action !== "approve")
    : actions;
}

/**
 * Validate the remote Fineract lifecycle before any local assignment, action,
 * inventory mutation, or state-machine commit is attempted.
 */
export function validateLeadFineractTransition(args: {
  lead: LeadTransitionGuardLead;
  actions: unknown[];
  remoteLoan?: LeadTransitionGuardLoan | null;
}): LeadTransitionGuardResult {
  const actions = getLeadFineractGuardActions(args.lead, args.actions);
  if (actions.length === 0) return { allowed: true };

  if (args.lead.fineractLoanId == null) {
    return {
      allowed: false,
      message: `Cannot execute Fineract ${actions[0]}: lead has no linked Fineract loan.`,
    };
  }

  if (!args.remoteLoan || typeof args.remoteLoan !== "object") {
    return {
      allowed: false,
      message:
        `Cannot execute Fineract ${actions[0]}: linked loan lifecycle could not be verified. ` +
        "The local transition was blocked.",
    };
  }

  const lifecycle = getLifecycleState(args.remoteLoan);
  if (!lifecycle.known) {
    return {
      allowed: false,
      message:
        `Cannot execute Fineract ${actions[0]}: linked loan lifecycle is unknown. ` +
        "The local transition was blocked.",
    };
  }

  let current = lifecycle;
  for (const action of actions) {
    if (current.terminal) {
      return {
        allowed: false,
        message:
          `Cannot execute Fineract ${action}: the linked loan is rejected or withdrawn; ` +
          "forward transitions are blocked.",
      };
    }

    switch (action) {
      case "approve":
      case "reject":
        if (!current.pendingApproval) {
          return {
            allowed: false,
            message:
              `Cannot execute Fineract ${action}: the linked loan is not pending approval.`,
          };
        }
        current =
          action === "approve"
            ? {
                ...current,
                pendingApproval: false,
                waitingForDisbursal: true,
                terminal: false,
                known: true,
              }
            : {
                ...current,
                pendingApproval: false,
                waitingForDisbursal: false,
                terminal: true,
                known: true,
              };
        break;
      case "disburse":
        if (!current.waitingForDisbursal) {
          return {
            allowed: false,
            message:
              "Cannot execute Fineract disburse: the linked loan is not approved and waiting for disbursement.",
          };
        }
        current = {
          ...current,
          pendingApproval: false,
          waitingForDisbursal: false,
          activeOrDisbursed: true,
          known: true,
        };
        break;
      case "payout":
        if (!current.activeOrDisbursed) {
          return {
            allowed: false,
            message:
              "Cannot execute Fineract payout: the linked loan is not active or disbursed.",
          };
        }
        break;
    }
  }

  return { allowed: true };
}
