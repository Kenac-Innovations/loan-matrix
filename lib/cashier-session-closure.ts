/**
 * Pure functions for two-step cashier session closure (Phase 3).
 * No Prisma, no side effects; suitable for unit testing.
 */

export const PENDING_CLOSURE = "PENDING_CLOSURE";

/**
 * Parse a value as a cash amount, allowing undefined/null/"" to return null.
 * Must be a finite non-negative number.
 */
export function parseCashAmount(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const num = Number(value);
  return isValidCashAmount(num) ? num : null;
}

/**
 * Check if a number is a valid cash amount (finite, non-negative).
 */
export function isValidCashAmount(n: unknown): boolean {
  const num = Number(n);
  return Number.isFinite(num) && num >= 0;
}

/**
 * Round to 2 decimal places (cents).
 */
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/**
 * Classify variance between expected and counted cash.
 *
 * @param input.expected - System-calculated expected balance (reliable)
 * @param input.counted - Branch manager's physical count
 * @param input.tolerance - Variance tolerance in absolute currency units (e.g. 50 for 50 ZMW)
 * @returns { difference: counted - expected (rounded to 2dp),
 *            raise: true if |difference| > max(tolerance, 0.005),
 *            type: "SHORTAGE" | "OVERAGE" | null (null if no variance),
 *            amount: |difference| }
 */
export function classifyVariance(input: {
  expected: number;
  counted: number;
  tolerance: number;
}): { difference: number; raise: boolean; type: "SHORTAGE" | "OVERAGE" | null; amount: number } {
  const { expected, counted, tolerance } = input;
  const difference = round2(counted - expected);

  // Raise if absolute difference exceeds tolerance or minimum threshold (half a cent).
  const raise = Math.abs(difference) > Math.max(tolerance, 0.005);

  let type: "SHORTAGE" | "OVERAGE" | null = null;
  if (difference < 0) {
    type = "SHORTAGE";
  } else if (difference > 0) {
    type = "OVERAGE";
  }

  return {
    difference,
    raise,
    type,
    amount: Math.abs(difference),
  };
}

/**
 * Determine the closure workflow mode based on tenant module flag.
 */
export function closureWorkflow(moduleOn: boolean): "TWO_STEP" | "LEGACY" {
  return moduleOn ? "TWO_STEP" : "LEGACY";
}

/**
 * Authorize initiation of cashier session closure.
 * Only the cashier themselves may initiate (not a manager).
 *
 * @returns { ok: true } if authorized
 *          { ok: false; status: 403 | 503; code: string; error: string } otherwise
 */
export function authorizeClosureInitiation(input: {
  staff: { status: "OK"; staffId: number } | { status: "NO_STAFF" } | { status: "ERROR" };
  cashierStaffId: number;
}): { ok: true } | { ok: false; status: 403 | 503; code: string; error: string } {
  const { staff, cashierStaffId } = input;

  if (staff.status === "ERROR") {
    return {
      ok: false,
      status: 503,
      code: "STAFF_LOOKUP_FAILED",
      error: "Could not verify cashier identity",
    };
  }

  if (staff.status === "NO_STAFF") {
    return {
      ok: false,
      status: 403,
      code: "NOT_CASHIER",
      error: "Only the cashier can initiate closure",
    };
  }

  if (staff.staffId !== cashierStaffId) {
    return {
      ok: false,
      status: 403,
      code: "NOT_CASHIER",
      error: "Only the cashier can initiate closure",
    };
  }

  return { ok: true };
}

/**
 * Authorize manager completion or rejection of cashier session closure.
 * Must have manager permission, not be the cashier, and not be the initiator.
 *
 * @returns { ok: true } if authorized
 *          { ok: false; status: 403 | 503; code: string; error: string } otherwise
 */
export function authorizeManagerClosure(input: {
  hasManagerPermission: boolean;
  staff: { status: "OK"; staffId: number } | { status: "NO_STAFF" } | { status: "ERROR" };
  cashierStaffId: number;
  actorId: string;
  initiatorId: string | null;
}): { ok: true } | { ok: false; status: 403 | 503; code: string; error: string } {
  const { hasManagerPermission, staff, cashierStaffId, actorId, initiatorId } = input;

  if (!hasManagerPermission) {
    return {
      ok: false,
      status: 403,
      code: "PERMISSION_DENIED",
      error: "Insufficient permission. Only branch managers can close sessions.",
    };
  }

  if (staff.status === "ERROR") {
    return {
      ok: false,
      status: 503,
      code: "STAFF_LOOKUP_FAILED",
      error: "Could not verify user identity",
    };
  }

  // NO_STAFF is allowed for manager (not the cashier)
  if (staff.status === "OK" && staff.staffId === cashierStaffId) {
    return {
      ok: false,
      status: 403,
      code: "PERMISSION_DENIED",
      error: "A different user with branch manager rights must close this session",
    };
  }

  if (actorId === initiatorId) {
    return {
      ok: false,
      status: 403,
      code: "PERMISSION_DENIED",
      error: "A different user with branch manager rights must close this session",
    };
  }

  return { ok: true };
}
