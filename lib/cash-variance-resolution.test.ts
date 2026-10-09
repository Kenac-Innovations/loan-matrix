import assert from "node:assert/strict";
import {
  RESOLUTION_TYPES,
  isResolutionAllowed,
  vaultAdjustmentFor,
  planVarianceAction,
  authorizeVarianceAction,
} from "./cash-variance-resolution";

function run() {
  // RESOLUTION_TYPES constant
  assert.deepEqual(RESOLUTION_TYPES, [
    "CASHIER_REPAID",
    "RETURNED_TO_CLIENT",
    "COUNTING_ERROR",
    "WRITTEN_OFF",
    "SALARY_RECOVERY",
    "POSTED_TO_SUSPENSE",
  ]);

  // isResolutionAllowed - CASHIER_REPAID only for SHORTAGE
  assert.equal(isResolutionAllowed("SHORTAGE", "CASHIER_REPAID"), true);
  assert.equal(isResolutionAllowed("OVERAGE", "CASHIER_REPAID"), false);

  // isResolutionAllowed - RETURNED_TO_CLIENT only for OVERAGE
  assert.equal(isResolutionAllowed("OVERAGE", "RETURNED_TO_CLIENT"), true);
  assert.equal(isResolutionAllowed("SHORTAGE", "RETURNED_TO_CLIENT"), false);

  // isResolutionAllowed - Others work for both
  assert.equal(isResolutionAllowed("SHORTAGE", "COUNTING_ERROR"), true);
  assert.equal(isResolutionAllowed("OVERAGE", "COUNTING_ERROR"), true);
  assert.equal(isResolutionAllowed("SHORTAGE", "WRITTEN_OFF"), true);
  assert.equal(isResolutionAllowed("OVERAGE", "WRITTEN_OFF"), true);
  assert.equal(isResolutionAllowed("SHORTAGE", "SALARY_RECOVERY"), true);
  assert.equal(isResolutionAllowed("OVERAGE", "SALARY_RECOVERY"), true);
  assert.equal(isResolutionAllowed("SHORTAGE", "POSTED_TO_SUSPENSE"), true);
  assert.equal(isResolutionAllowed("OVERAGE", "POSTED_TO_SUSPENSE"), true);

  // isResolutionAllowed - Invalid type
  assert.equal(isResolutionAllowed("SHORTAGE", "INVALID_TYPE"), false);

  // vaultAdjustmentFor - CASHIER_REPAID => +amount
  assert.equal(vaultAdjustmentFor("SHORTAGE", "CASHIER_REPAID", 100), 100);
  assert.equal(vaultAdjustmentFor("SHORTAGE", "CASHIER_REPAID", 0), 0);

  // vaultAdjustmentFor - RETURNED_TO_CLIENT => -amount
  assert.equal(vaultAdjustmentFor("OVERAGE", "RETURNED_TO_CLIENT", 100), -100);
  assert.equal(vaultAdjustmentFor("OVERAGE", "RETURNED_TO_CLIENT", 50), -50);

  // vaultAdjustmentFor - Others => 0
  assert.equal(vaultAdjustmentFor("SHORTAGE", "COUNTING_ERROR", 100), 0);
  assert.equal(vaultAdjustmentFor("OVERAGE", "WRITTEN_OFF", 200), 0);

  // planVarianceAction - start-review OPEN->UNDER_REVIEW without notes
  assert.deepEqual(
    planVarianceAction({
      status: "OPEN",
      action: "start-review",
      varianceType: "SHORTAGE",
    }),
    {
      ok: true,
      fromStatus: "OPEN",
      toStatus: "UNDER_REVIEW",
      logAction: "STATUS_CHANGED",
      notes: null,
    }
  );

  // planVarianceAction - start-review with optional notes
  assert.deepEqual(
    planVarianceAction({
      status: "OPEN",
      action: "start-review",
      varianceType: "SHORTAGE",
      notes: "Initial investigation",
    }),
    {
      ok: true,
      fromStatus: "OPEN",
      toStatus: "UNDER_REVIEW",
      logAction: "STATUS_CHANGED",
      notes: "Initial investigation",
    }
  );

  // planVarianceAction - start-review from non-OPEN status
  assert.deepEqual(
    planVarianceAction({
      status: "UNDER_REVIEW",
      action: "start-review",
      varianceType: "SHORTAGE",
    }),
    {
      ok: false,
      status: 409,
      error: "Cannot start review on a UNDER_REVIEW variance; must be OPEN",
      code: "INVALID_STATUS_TRANSITION",
    }
  );

  // planVarianceAction - add-note with notes
  assert.deepEqual(
    planVarianceAction({
      status: "OPEN",
      action: "add-note",
      varianceType: "SHORTAGE",
      notes: "  Initial observation  ",
    }),
    {
      ok: true,
      fromStatus: "OPEN",
      toStatus: "OPEN",
      logAction: "NOTE_ADDED",
      notes: "Initial observation",
    }
  );

  // planVarianceAction - add-note without notes
  assert.deepEqual(
    planVarianceAction({
      status: "UNDER_REVIEW",
      action: "add-note",
      varianceType: "SHORTAGE",
    }),
    {
      ok: false,
      status: 400,
      error: "Notes are required for add-note action",
      code: "NOTES_REQUIRED",
    }
  );

  // planVarianceAction - add-note with empty notes
  assert.deepEqual(
    planVarianceAction({
      status: "RESOLVED",
      action: "add-note",
      varianceType: "OVERAGE",
      notes: "   ",
    }),
    {
      ok: false,
      status: 400,
      error: "Notes are required for add-note action",
      code: "NOTES_REQUIRED",
    }
  );

  // planVarianceAction - resolve from OPEN
  assert.deepEqual(
    planVarianceAction({
      status: "OPEN",
      action: "resolve",
      varianceType: "SHORTAGE",
      resolutionType: "CASHIER_REPAID",
      notes: "Cashier paid back the difference",
    }),
    {
      ok: true,
      fromStatus: "OPEN",
      toStatus: "RESOLVED",
      logAction: "RESOLVED",
      resolutionType: "CASHIER_REPAID",
      notes: "Cashier paid back the difference",
    }
  );

  // planVarianceAction - resolve from UNDER_REVIEW
  assert.deepEqual(
    planVarianceAction({
      status: "UNDER_REVIEW",
      action: "resolve",
      varianceType: "SHORTAGE",
      resolutionType: "COUNTING_ERROR",
      notes: "Recount confirmed discrepancy",
    }),
    {
      ok: true,
      fromStatus: "UNDER_REVIEW",
      toStatus: "RESOLVED",
      logAction: "RESOLVED",
      resolutionType: "COUNTING_ERROR",
      notes: "Recount confirmed discrepancy",
    }
  );

  // planVarianceAction - resolve with case-insensitive resolution type
  assert.deepEqual(
    planVarianceAction({
      status: "OPEN",
      action: "resolve",
      varianceType: "SHORTAGE",
      resolutionType: "written_off",
      notes: "Bad debt",
    }),
    {
      ok: true,
      fromStatus: "OPEN",
      toStatus: "RESOLVED",
      logAction: "RESOLVED",
      resolutionType: "WRITTEN_OFF",
      notes: "Bad debt",
    }
  );

  // planVarianceAction - resolve from invalid status
  assert.deepEqual(
    planVarianceAction({
      status: "RESOLVED",
      action: "resolve",
      varianceType: "SHORTAGE",
      resolutionType: "COUNTING_ERROR",
      notes: "Test",
    }),
    {
      ok: false,
      status: 409,
      error: "Cannot resolve a RESOLVED variance; must be OPEN or UNDER_REVIEW",
      code: "INVALID_STATUS_TRANSITION",
    }
  );

  // planVarianceAction - resolve without resolution type
  assert.deepEqual(
    planVarianceAction({
      status: "OPEN",
      action: "resolve",
      varianceType: "SHORTAGE",
      notes: "Test",
    }),
    {
      ok: false,
      status: 400,
      error: "Resolution type is required",
      code: "RESOLUTION_TYPE_REQUIRED",
    }
  );

  // planVarianceAction - resolve with invalid resolution type
  assert.deepEqual(
    planVarianceAction({
      status: "OPEN",
      action: "resolve",
      varianceType: "SHORTAGE",
      resolutionType: "INVALID_TYPE",
      notes: "Test",
    }),
    {
      ok: false,
      status: 400,
      error: "Invalid resolution type: INVALID_TYPE",
      code: "INVALID_RESOLUTION_TYPE",
    }
  );

  // planVarianceAction - resolve with disallowed resolution type
  assert.deepEqual(
    planVarianceAction({
      status: "OPEN",
      action: "resolve",
      varianceType: "OVERAGE",
      resolutionType: "CASHIER_REPAID",
      notes: "Test",
    }),
    {
      ok: false,
      status: 400,
      error: "Resolution type CASHIER_REPAID not allowed for OVERAGE",
      code: "INVALID_RESOLUTION_TYPE",
    }
  );

  // planVarianceAction - resolve without notes
  assert.deepEqual(
    planVarianceAction({
      status: "OPEN",
      action: "resolve",
      varianceType: "SHORTAGE",
      resolutionType: "COUNTING_ERROR",
    }),
    {
      ok: false,
      status: 400,
      error: "Notes are required for resolve action",
      code: "NOTES_REQUIRED",
    }
  );

  // planVarianceAction - resolve with empty notes
  assert.deepEqual(
    planVarianceAction({
      status: "OPEN",
      action: "resolve",
      varianceType: "SHORTAGE",
      resolutionType: "COUNTING_ERROR",
      notes: "   ",
    }),
    {
      ok: false,
      status: 400,
      error: "Notes are required for resolve action",
      code: "NOTES_REQUIRED",
    }
  );

  // planVarianceAction - resolve with notes exceeding 2000 chars
  const longNotes = "x".repeat(2001);
  assert.deepEqual(
    planVarianceAction({
      status: "OPEN",
      action: "resolve",
      varianceType: "SHORTAGE",
      resolutionType: "COUNTING_ERROR",
      notes: longNotes,
    }),
    {
      ok: false,
      status: 400,
      error: "Notes must not exceed 2000 characters",
      code: "NOTES_TOO_LONG",
    }
  );

  // planVarianceAction - reopen from RESOLVED
  assert.deepEqual(
    planVarianceAction({
      status: "RESOLVED",
      action: "reopen",
      varianceType: "SHORTAGE",
      notes: "New evidence found",
    }),
    {
      ok: true,
      fromStatus: "RESOLVED",
      toStatus: "OPEN",
      logAction: "REOPENED",
      notes: "New evidence found",
    }
  );

  // planVarianceAction - reopen from non-RESOLVED status
  assert.deepEqual(
    planVarianceAction({
      status: "OPEN",
      action: "reopen",
      varianceType: "SHORTAGE",
      notes: "Test",
    }),
    {
      ok: false,
      status: 409,
      error: "Cannot reopen a OPEN variance; must be RESOLVED",
      code: "INVALID_STATUS_TRANSITION",
    }
  );

  // planVarianceAction - reopen without notes
  assert.deepEqual(
    planVarianceAction({
      status: "RESOLVED",
      action: "reopen",
      varianceType: "SHORTAGE",
    }),
    {
      ok: false,
      status: 400,
      error: "Notes are required for reopen action",
      code: "NOTES_REQUIRED",
    }
  );

  // planVarianceAction - notes must be a string (number not allowed)
  assert.deepEqual(
    planVarianceAction({
      status: "OPEN",
      action: "add-note",
      varianceType: "SHORTAGE",
      notes: 123,
    }),
    {
      ok: false,
      status: 400,
      error: "Notes must be a string",
      code: "INVALID_NOTES_TYPE",
    }
  );

  // planVarianceAction - notes must be a string (object not allowed)
  assert.deepEqual(
    planVarianceAction({
      status: "OPEN",
      action: "resolve",
      varianceType: "SHORTAGE",
      resolutionType: "COUNTING_ERROR",
      notes: { text: "Test" },
    }),
    {
      ok: false,
      status: 400,
      error: "Notes must be a string",
      code: "INVALID_NOTES_TYPE",
    }
  );

  // authorizeVarianceAction - no permission
  assert.deepEqual(
    authorizeVarianceAction({
      hasPermission: false,
      staff: { status: "OK", staffId: 123 },
      eventCashierStaffId: 456,
    }),
    {
      ok: false,
      status: 403,
      code: "PERMISSION_DENIED",
      error: "You do not have permission to resolve cash variances",
    }
  );

  // authorizeVarianceAction - staff lookup error
  assert.deepEqual(
    authorizeVarianceAction({
      hasPermission: true,
      staff: { status: "ERROR" },
      eventCashierStaffId: 123,
    }),
    {
      ok: false,
      status: 503,
      code: "STAFF_LOOKUP_FAILED",
      error: "Failed to look up staff information",
    }
  );

  // authorizeVarianceAction - own variance (staff OK matching cashier staff)
  assert.deepEqual(
    authorizeVarianceAction({
      hasPermission: true,
      staff: { status: "OK", staffId: 123 },
      eventCashierStaffId: 123,
    }),
    {
      ok: false,
      status: 403,
      code: "OWN_VARIANCE",
      error: "You can't resolve a variance on your own session",
    }
  );

  // authorizeVarianceAction - permission granted, different staff
  assert.deepEqual(
    authorizeVarianceAction({
      hasPermission: true,
      staff: { status: "OK", staffId: 456 },
      eventCashierStaffId: 123,
    }),
    { ok: true }
  );

  // authorizeVarianceAction - permission granted, NO_STAFF
  assert.deepEqual(
    authorizeVarianceAction({
      hasPermission: true,
      staff: { status: "NO_STAFF" },
      eventCashierStaffId: 123,
    }),
    { ok: true }
  );
}

run();
console.log("All tests passed!");
