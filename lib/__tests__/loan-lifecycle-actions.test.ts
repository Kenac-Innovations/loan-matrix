import assert from "node:assert/strict";
import test from "node:test";

import { getLoanLifecycleUndoAction } from "../loan-lifecycle-actions";

test("uses undo approval for approved loans awaiting disbursement with no actual disbursement", () => {
  assert.deepEqual(
    getLoanLifecycleUndoAction({
      status: { waitingForDisbursal: true },
      timeline: {},
    }),
    { action: "undo-approval", label: "Undo Approval" }
  );
});

test("keeps undo disbursal once the loan has an actual disbursement date", () => {
  assert.deepEqual(
    getLoanLifecycleUndoAction({
      status: { waitingForDisbursal: false },
      timeline: { actualDisbursementDate: [2026, 6, 23] },
    }),
    { action: "undo-disbursal", label: "Undo Disbursal" }
  );
});

test("defaults to undo disbursal outside the awaiting-disbursement approval stage", () => {
  assert.deepEqual(
    getLoanLifecycleUndoAction({ status: { waitingForDisbursal: false }, timeline: {} }),
    { action: "undo-disbursal", label: "Undo Disbursal" }
  );
});
