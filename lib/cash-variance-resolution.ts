/**
 * Pure logic for resolving cash variance events (shortages/overages).
 * No Prisma dependencies; all logic is testable via node:assert.
 */

export const RESOLUTION_TYPES = [
  "CASHIER_REPAID",
  "RETURNED_TO_CLIENT",
  "COUNTING_ERROR",
  "WRITTEN_OFF",
  "SALARY_RECOVERY",
  "POSTED_TO_SUSPENSE",
] as const;

export type ResolutionType = (typeof RESOLUTION_TYPES)[number];
export type VarianceType = "SHORTAGE" | "OVERAGE";
export type VarianceAction = "start-review" | "add-note" | "resolve" | "reopen";

/**
 * Check if a resolution type is allowed for a given variance type.
 *
 * Rules:
 * - CASHIER_REPAID only for SHORTAGE
 * - RETURNED_TO_CLIENT only for OVERAGE
 * - All others (COUNTING_ERROR, WRITTEN_OFF, SALARY_RECOVERY, POSTED_TO_SUSPENSE) for both
 */
export function isResolutionAllowed(
  varianceType: string,
  resolutionType: string
): boolean {
  if (!RESOLUTION_TYPES.includes(resolutionType as ResolutionType)) {
    return false;
  }

  if (resolutionType === "CASHIER_REPAID") {
    return varianceType === "SHORTAGE";
  }

  if (resolutionType === "RETURNED_TO_CLIENT") {
    return varianceType === "OVERAGE";
  }

  return true;
}

/**
 * Calculate the vault adjustment amount for a resolution.
 *
 * - CASHIER_REPAID: +amount (cashier pays back the shortage)
 * - RETURNED_TO_CLIENT: -amount (client gets refund from vault)
 * - All others: 0 (no vault adjustment)
 */
export function vaultAdjustmentFor(
  varianceType: string,
  resolutionType: string,
  amount: number
): number {
  if (resolutionType === "CASHIER_REPAID") {
    return amount;
  }

  if (resolutionType === "RETURNED_TO_CLIENT") {
    return -amount;
  }

  return 0;
}

/**
 * Plan a variance action (state transition + log action).
 *
 * Rules:
 * - start-review: OPEN -> UNDER_REVIEW
 * - add-note: any status, notes required, status unchanged
 * - resolve: OPEN|UNDER_REVIEW -> RESOLVED, resolutionType required+valid+allowed, notes required
 * - reopen: RESOLVED -> OPEN, notes required
 *
 * Returns either success with planned transition or error.
 */
export function planVarianceAction(input: {
  status: string;
  action: VarianceAction;
  varianceType: string;
  resolutionType?: unknown;
  notes?: unknown;
}): 
  | {
      ok: true;
      fromStatus: string;
      toStatus: string;
      logAction: "STATUS_CHANGED" | "NOTE_ADDED" | "RESOLVED" | "REOPENED";
      resolutionType?: ResolutionType;
      notes: string | null;
    }
  | { ok: false; status: 400 | 409; error: string; code: string } {
  const { status, action, varianceType, resolutionType, notes } = input;

  // Trim notes if present; notes must be a string if provided
  let trimmedNotes: string | null = null;
  if (notes !== undefined) {
    if (typeof notes !== "string") {
      return {
        ok: false,
        status: 400,
        error: "Notes must be a string",
        code: "INVALID_NOTES_TYPE",
      };
    }
    const notesStr = notes.trim();
    if (notesStr) {
      if (notesStr.length > 2000) {
        return {
          ok: false,
          status: 400,
          error: "Notes must not exceed 2000 characters",
          code: "NOTES_TOO_LONG",
        };
      }
      trimmedNotes = notesStr;
    }
  }

  if (action === "start-review") {
    if (status !== "OPEN") {
      return {
        ok: false,
        status: 409,
        error: `Cannot start review on a ${status} variance; must be OPEN`,
        code: "INVALID_STATUS_TRANSITION",
      };
    }
    return {
      ok: true,
      fromStatus: "OPEN",
      toStatus: "UNDER_REVIEW",
      logAction: "STATUS_CHANGED",
      notes: trimmedNotes, // Accept optional notes
    };
  }

  if (action === "add-note") {
    if (!trimmedNotes) {
      return {
        ok: false,
        status: 400,
        error: "Notes are required for add-note action",
        code: "NOTES_REQUIRED",
      };
    }
    return {
      ok: true,
      fromStatus: status,
      toStatus: status,
      logAction: "NOTE_ADDED",
      notes: trimmedNotes,
    };
  }

  if (action === "resolve") {
    if (!["OPEN", "UNDER_REVIEW"].includes(status)) {
      return {
        ok: false,
        status: 409,
        error: `Cannot resolve a ${status} variance; must be OPEN or UNDER_REVIEW`,
        code: "INVALID_STATUS_TRANSITION",
      };
    }

    if (!resolutionType) {
      return {
        ok: false,
        status: 400,
        error: "Resolution type is required",
        code: "RESOLUTION_TYPE_REQUIRED",
      };
    }

    const resolutionTypeStr = String(resolutionType).toUpperCase();
    if (!RESOLUTION_TYPES.includes(resolutionTypeStr as ResolutionType)) {
      return {
        ok: false,
        status: 400,
        error: `Invalid resolution type: ${resolutionTypeStr}`,
        code: "INVALID_RESOLUTION_TYPE",
      };
    }

    if (!isResolutionAllowed(varianceType, resolutionTypeStr)) {
      return {
        ok: false,
        status: 400,
        error: `Resolution type ${resolutionTypeStr} not allowed for ${varianceType}`,
        code: "INVALID_RESOLUTION_TYPE",
      };
    }

    if (!trimmedNotes) {
      return {
        ok: false,
        status: 400,
        error: "Notes are required for resolve action",
        code: "NOTES_REQUIRED",
      };
    }

    return {
      ok: true,
      fromStatus: status,
      toStatus: "RESOLVED",
      logAction: "RESOLVED",
      resolutionType: resolutionTypeStr as ResolutionType,
      notes: trimmedNotes,
    };
  }

  if (action === "reopen") {
    if (status !== "RESOLVED") {
      return {
        ok: false,
        status: 409,
        error: `Cannot reopen a ${status} variance; must be RESOLVED`,
        code: "INVALID_STATUS_TRANSITION",
      };
    }

    if (!trimmedNotes) {
      return {
        ok: false,
        status: 400,
        error: "Notes are required for reopen action",
        code: "NOTES_REQUIRED",
      };
    }

    return {
      ok: true,
      fromStatus: "RESOLVED",
      toStatus: "OPEN",
      logAction: "REOPENED",
      notes: trimmedNotes,
    };
  }

  return {
    ok: false,
    status: 400,
    error: `Unknown action: ${action}`,
    code: "INVALID_ACTION",
  };
}

/**
 * Authorize a variance action based on user permissions and staff role.
 *
 * Rules:
 * - No permission -> 403 PERMISSION_DENIED
 * - Staff lookup error -> 503 STAFF_LOOKUP_FAILED
 * - Staff OK and equals event's cashier staff ID -> 403 OWN_VARIANCE
 * - NO_STAFF is OK (system user)
 */
export function authorizeVarianceAction(input: {
  hasPermission: boolean;
  staff:
    | { status: "OK"; staffId: number }
    | { status: "NO_STAFF" }
    | { status: "ERROR" };
  eventCashierStaffId: number;
}): { ok: true } | { ok: false; status: 403 | 503; code: string; error: string } {
  const { hasPermission, staff, eventCashierStaffId } = input;

  if (!hasPermission) {
    return {
      ok: false,
      status: 403,
      code: "PERMISSION_DENIED",
      error: "You do not have permission to resolve cash variances",
    };
  }

  if (staff.status === "ERROR") {
    return {
      ok: false,
      status: 503,
      code: "STAFF_LOOKUP_FAILED",
      error: "Failed to look up staff information",
    };
  }

  if (staff.status === "OK" && staff.staffId === eventCashierStaffId) {
    return {
      ok: false,
      status: 403,
      code: "OWN_VARIANCE",
      error: "You can't resolve a variance on your own session",
    };
  }

  return { ok: true };
}
