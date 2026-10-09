/**
 * Cashier session disbursement gate.
 *
 * Blocks CASH loan disbursements/payouts when an enrolled cashier has an unclosed
 * session from an earlier business day. Pure and async functions for checking the gate.
 */

import { prisma } from "@/lib/prisma";
import { getCashierSessionTenantSettings } from "@/lib/cashier-session-settings";
import { resolveSessionClosureEnforcement } from "@/lib/cashier-session-enforcement-policy";
import { resolveStaffIdForFineractUser } from "@/lib/current-user-cashier";
import { getPaymentTypeInfo } from "@/lib/cash-repayment-teller";
import {
  sessionBusinessDateString,
  findBlockingSessions,
} from "@/lib/cashier-session-disbursement-rules";

// Re-export helpers for backward compatibility
export type { GateSession } from "@/lib/cashier-session-disbursement-rules";
export { sessionBusinessDateString, findBlockingSessions } from "@/lib/cashier-session-disbursement-rules";

export interface CashDisbursementGateInput {
  tenantId: string;
  isCash: boolean;
  fineractUserId?: string | number | null;
  cashierIds?: Array<string | null | undefined>;
  now?: Date;
}

export type CashDisbursementGateResult =
  | { allowed: true }
  | {
      allowed: false;
      status: 409 | 503;
      code: "PREVIOUS_SESSION_NOT_CLOSED" | "STAFF_LOOKUP_FAILED" | "PAYMENT_TYPE_LOOKUP_FAILED";
      message: string;
      blockingSessions: Array<{
        sessionId: string;
        cashierId: string;
        cashierName: string;
        tellerName: string | null;
        businessDate: string;
        sessionStatus: string;
      }>;
    };

/**
 * Check if a cash disbursement is allowed given the cashier's session status.
 *
 * Steps:
 * 1. If !isCash -> allowed (non-cash never touches the drawer)
 * 2. Load tenant settings; if module off -> allowed
 * 3. Collect cashier records from:
 *    - Explicit cashierIds (DB ids; ignore falsy)
 *    - If fineractUserId given, resolve staff and load all Cashier rows for that staff
 * 4. For each cashier, check for blocking sessions and aggregate
 * 5. If any blocking -> return error with oldest blocking session detail and count
 */
/**
 * Check if a cash disbursement is allowed given the cashier's session status.
 *
 * Steps:
 * 1. If !isCash -> allowed (non-cash never touches the drawer)
 * 2. Load tenant settings; if module off -> allowed
 * 3. If the tenant default is off and no cashier is set to enforce, allow early
 *    (skips the Fineract staff lookup).
 * 4. Collect cashier records from:
 *    - Explicit cashierIds (DB ids; ignore falsy)
 *    - If fineractUserId given, resolve staff and load all Cashier rows for that staff
 * 5. Determine which cashiers are enforced; load sessions for all in one query
 * 6. Check each cashier's sessions and aggregate blocks
 * 7. If any blocking -> return error with oldest blocking session detail and count
 */
export async function checkCashDisbursementSessionGate(
  input: CashDisbursementGateInput
): Promise<CashDisbursementGateResult> {
  const { tenantId, isCash, fineractUserId, cashierIds = [], now = new Date() } = input;

  // Non-cash never touches the drawer
  if (!isCash) {
    return { allowed: true };
  }

  // Load tenant settings
  const settings = await getCashierSessionTenantSettings(tenantId);

  // Module off -> allowed (legacy behavior)
  if (!settings.isTellerManagementModuleOn) {
    return { allowed: true };
  }


  // Nobody can be enrolled when the tenant default is off and no cashier is set to
  // enforce: allow without the Fineract staff lookup.
  if (!settings.enforceSessionClosureByDefault) {
    const enforceCount = await prisma.cashier.count({
      where: { tenantId, enforceSessionClosure: true, isActive: true },
    });
    if (enforceCount === 0) {
      return { allowed: true };
    }
  }

  // Collect explicit cashier records
  let cashierRecords = await prisma.cashier.findMany({
    where: {
      tenantId,
      id: {
        in: cashierIds.filter((id) => id != null),
      },
      isActive: true,
    },
    select: {
      id: true,
      staffId: true,
      staffName: true,
      enforceSessionClosure: true,
      sessionClosureEnforcedFrom: true,
      sessionClosureFlagUpdatedAt: true,
      createdAt: true,
      teller: {
        select: {
          name: true,
        },
      },
    },
  });

  // Also check every cashier record of the acting user, so an unclosed session on
  // one teller blocks cash payouts through another.
  const hasExplicitCashiers = cashierRecords.length > 0;
  if (fineractUserId != null) {
    const staffResult = await resolveStaffIdForFineractUser(fineractUserId);

    // Without explicit cashiers we can't tell whether the user is enrolled: fail closed.
    if (staffResult.status === "ERROR" && !hasExplicitCashiers) {
      return {
        allowed: false,
        status: 503,
        code: "STAFF_LOOKUP_FAILED",
        message:
          "Could not verify the cashier's session status. Please try again.",
        blockingSessions: [],
      };
    }

    if (staffResult.status === "OK") {
      const staffCashiers = await prisma.cashier.findMany({
        where: {
          tenantId,
          staffId: staffResult.staffId,
          isActive: true,
        },
        select: {
          id: true,
          staffId: true,
          staffName: true,
          enforceSessionClosure: true,
          sessionClosureEnforcedFrom: true,
          sessionClosureFlagUpdatedAt: true,
          createdAt: true,
          teller: {
            select: {
              name: true,
            },
          },
        },
      });

      cashierRecords = cashierRecords.concat(staffCashiers);
    }
  }

  // Dedupe by cashier id
  const uniqueCashiers = Array.from(
    new Map(cashierRecords.map((c) => [c.id, c])).values()
  );

  // Determine which cashiers are enforced
  const enforcedCashiers: Array<{
    cashier: (typeof uniqueCashiers)[0];
    enforcement: ReturnType<typeof resolveSessionClosureEnforcement>;
  }> = [];

  for (const cashier of uniqueCashiers) {
    const enforcement = resolveSessionClosureEnforcement(settings, {
      enforceSessionClosure: cashier.enforceSessionClosure,
      sessionClosureEnforcedFrom: cashier.sessionClosureEnforcedFrom,
      sessionClosureFlagUpdatedAt: cashier.sessionClosureFlagUpdatedAt,
      createdAt: cashier.createdAt,
    });

    if (enforcement.enforced) {
      enforcedCashiers.push({ cashier, enforcement });
    }
  }

  // If no cashiers are enforced, return allowed
  if (enforcedCashiers.length === 0) {
    return { allowed: true };
  }

  // Load sessions for all enforced cashiers in one query
  const sessions = await prisma.cashierSession.findMany({
    where: {
      tenantId,
      cashierId: {
        in: enforcedCashiers.map((c) => c.cashier.id),
      },
      sessionStatus: { in: ["ACTIVE", "PENDING_CLOSURE"] },
    },
    select: {
      id: true,
      cashierId: true,
      sessionStatus: true,
      businessDate: true,
      sessionStartTime: true,
      createdAt: true,
    },
  });

  // Group sessions by cashier and find blocking sessions
  const allBlockingSessions: Array<{
    sessionId: string;
    cashierId: string;
    cashierName: string;
    tellerName: string | null;
    businessDate: string;
    sessionStatus: string;
  }> = [];

  for (const { cashier, enforcement } of enforcedCashiers) {
    const cashierSessions = sessions.filter((s) => s.cashierId === cashier.id);
    // enforcement is guaranteed to have enforced: true and enforcedFrom here
    const enforcedFrom = (enforcement as Extract<typeof enforcement, { enforced: true }>).enforcedFrom;
    const blocking = findBlockingSessions(cashierSessions, enforcedFrom, now);

    for (const session of blocking) {
      allBlockingSessions.push({
        sessionId: session.id,
        cashierId: session.cashierId,
        cashierName: cashier.staffName,
        tellerName: cashier.teller.name ?? null,
        businessDate: sessionBusinessDateString(session),
        sessionStatus: session.sessionStatus,
      });
    }
  }

  // If any blocking sessions, return error
  if (allBlockingSessions.length > 0) {
    // Sort by businessDate (ascending) to get the oldest
    const oldestSession = allBlockingSessions.sort(
      (a, b) => a.businessDate.localeCompare(b.businessDate)
    )[0];

    const extraCount =
      allBlockingSessions.length > 1
        ? ` (${allBlockingSessions.length} unclosed sessions)`
        : "";

    const message =
      `Cash disbursement blocked: ${oldestSession.cashierName}'s session for ${oldestSession.businessDate}` +
      (oldestSession.tellerName ? ` (${oldestSession.tellerName})` : "") +
      ` has not been closed. Initiate closure and have a branch manager close it before disbursing cash.` +
      extraCount;

    return {
      allowed: false,
      status: 409,
      code: "PREVIOUS_SESSION_NOT_CLOSED",
      message,
      blockingSessions: allBlockingSessions,
    };
  }

  return { allowed: true };
}


/**
 * Error class for disbursement gate failures.
 */
export class CashDisbursementBlockedError extends Error {
  constructor(
    public readonly result: Extract<CashDisbursementGateResult, { allowed: false }>
  ) {
    super(result.message);
    this.name = "CashDisbursementBlockedError";
  }
}

/**
 * Assert that a cash disbursement is allowed; throw CashDisbursementBlockedError if not.
 */
export async function assertCashDisbursementAllowed(
  input: CashDisbursementGateInput
): Promise<void> {
  const result = await checkCashDisbursementSessionGate(input);
  if (!result.allowed) {
    throw new CashDisbursementBlockedError(result);
  }
}

/**
 * Gate a disbursement/payout whose cash-ness is known from a payout method or a
 * Fineract payment type. Reads the module setting first, so module-off tenants
 * make no Fineract calls; fails closed when the payment type can't be read.
 */
export async function assertCashPaymentGate(input: {
  tenantId: string;
  payoutMethod?: string | null;
  paymentTypeId?: number | string | null;
  fineractUserId?: string | number | null;
  cashierIds?: Array<string | null | undefined>;
}): Promise<void> {
  const settings = await getCashierSessionTenantSettings(input.tenantId);
  if (!settings.isTellerManagementModuleOn) return;

  let isCash = false;
  if (input.payoutMethod) {
    isCash = input.payoutMethod === "CASH";
  } else if (input.paymentTypeId) {
    const info = await getPaymentTypeInfo(Number(input.paymentTypeId));
    if (!info) {
      throw new CashDisbursementBlockedError({
        allowed: false,
        status: 503,
        code: "PAYMENT_TYPE_LOOKUP_FAILED",
        message: "Could not verify the payment type. Please try again.",
        blockingSessions: [],
      });
    }
    isCash = info.isCashPayment === true;
  }
  if (!isCash) return;

  await assertCashDisbursementAllowed({
    tenantId: input.tenantId,
    isCash: true,
    // "system" (auto-progress/USSD) resolves no staff; only explicit cashiers are checked.
    fineractUserId: input.fineractUserId === "system" ? undefined : input.fineractUserId,
    cashierIds: input.cashierIds,
  });
}
