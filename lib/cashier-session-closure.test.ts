import assert from "node:assert/strict";
import {
  classifyVariance,
  closureWorkflow,
  isValidCashAmount,
  parseCashAmount,
  PENDING_CLOSURE,
  authorizeClosureInitiation,
  authorizeManagerClosure,
} from "./cashier-session-closure";

function run() {
  // Constants
  assert.equal(PENDING_CLOSURE, "PENDING_CLOSURE");

  // parseCashAmount
  assert.equal(parseCashAmount(100), 100);
  assert.equal(parseCashAmount("100.50"), 100.5);
  assert.equal(parseCashAmount(0), 0);
  assert.equal(parseCashAmount(null), null);
  assert.equal(parseCashAmount(undefined), null);
  assert.equal(parseCashAmount(""), null);
  assert.equal(parseCashAmount(NaN), null);
  assert.equal(parseCashAmount(-10), null);

  // isValidCashAmount
  assert.equal(isValidCashAmount(100), true);
  assert.equal(isValidCashAmount(0), true);
  assert.equal(isValidCashAmount(-10), false);
  assert.equal(isValidCashAmount(NaN), false);
  assert.equal(isValidCashAmount(Infinity), false);

  // classifyVariance: no variance
  assert.deepEqual(
    classifyVariance({ expected: 1000, counted: 1000, tolerance: 50 }),
    { difference: 0, raise: false, type: null, amount: 0 }
  );

  // classifyVariance: small variance within tolerance
  assert.deepEqual(
    classifyVariance({ expected: 1000, counted: 1025, tolerance: 50 }),
    { difference: 25, raise: false, type: "OVERAGE", amount: 25 }
  );

  // classifyVariance: variance exceeds tolerance (OVERAGE)
  assert.deepEqual(
    classifyVariance({ expected: 1000, counted: 1075, tolerance: 50 }),
    { difference: 75, raise: true, type: "OVERAGE", amount: 75 }
  );

  // classifyVariance: variance exceeds tolerance (SHORTAGE)
  assert.deepEqual(
    classifyVariance({ expected: 1000, counted: 920, tolerance: 50 }),
    { difference: -80, raise: true, type: "SHORTAGE", amount: 80 }
  );

  // classifyVariance: variance below tolerance but above 0.005 minimum
  assert.deepEqual(
    classifyVariance({ expected: 1000, counted: 1000.01, tolerance: 0 }),
    { difference: 0.01, raise: true, type: "OVERAGE", amount: 0.01 }
  );

  // classifyVariance: variance rounds to 2dp
  assert.deepEqual(
    classifyVariance({ expected: 1000, counted: 1000.005, tolerance: 0 }),
    { difference: 0, raise: false, type: null, amount: 0 }
  );

  // closureWorkflow
  assert.equal(closureWorkflow(true), "TWO_STEP");
  assert.equal(closureWorkflow(false), "LEGACY");

  // authorizeClosureInitiation: happy path (cashier can initiate)
  assert.deepEqual(
    authorizeClosureInitiation({
      staff: { status: "OK", staffId: 123 },
      cashierStaffId: 123,
    }),
    { ok: true }
  );

  // authorizeClosureInitiation: staff lookup error
  assert.deepEqual(
    authorizeClosureInitiation({
      staff: { status: "ERROR" },
      cashierStaffId: 123,
    }),
    {
      ok: false,
      status: 503,
      code: "STAFF_LOOKUP_FAILED",
      error: "Could not verify cashier identity",
    }
  );

  // authorizeClosureInitiation: no staff record
  assert.deepEqual(
    authorizeClosureInitiation({
      staff: { status: "NO_STAFF" },
      cashierStaffId: 123,
    }),
    {
      ok: false,
      status: 403,
      code: "NOT_CASHIER",
      error: "Only the cashier can initiate closure",
    }
  );

  // authorizeClosureInitiation: different staff id (manager trying to initiate)
  assert.deepEqual(
    authorizeClosureInitiation({
      staff: { status: "OK", staffId: 456 },
      cashierStaffId: 123,
    }),
    {
      ok: false,
      status: 403,
      code: "NOT_CASHIER",
      error: "Only the cashier can initiate closure",
    }
  );

  // authorizeManagerClosure: happy path (manager can close)
  assert.deepEqual(
    authorizeManagerClosure({
      hasManagerPermission: true,
      staff: { status: "NO_STAFF" },
      cashierStaffId: 123,
      actorId: "mgr1",
      initiatorId: "cashier1",
    }),
    { ok: true }
  );

  // authorizeManagerClosure: no permission
  assert.deepEqual(
    authorizeManagerClosure({
      hasManagerPermission: false,
      staff: { status: "OK", staffId: 456 },
      cashierStaffId: 123,
      actorId: "user1",
      initiatorId: "cashier1",
    }),
    {
      ok: false,
      status: 403,
      code: "PERMISSION_DENIED",
      error: "Insufficient permission. Only branch managers can close sessions.",
    }
  );

  // authorizeManagerClosure: staff lookup error
  assert.deepEqual(
    authorizeManagerClosure({
      hasManagerPermission: true,
      staff: { status: "ERROR" },
      cashierStaffId: 123,
      actorId: "mgr1",
      initiatorId: "cashier1",
    }),
    {
      ok: false,
      status: 503,
      code: "STAFF_LOOKUP_FAILED",
      error: "Could not verify user identity",
    }
  );

  // authorizeManagerClosure: manager is the cashier
  assert.deepEqual(
    authorizeManagerClosure({
      hasManagerPermission: true,
      staff: { status: "OK", staffId: 123 },
      cashierStaffId: 123,
      actorId: "mgr1",
      initiatorId: "cashier1",
    }),
    {
      ok: false,
      status: 403,
      code: "PERMISSION_DENIED",
      error: "A different user with branch manager rights must close this session",
    }
  );

  // authorizeManagerClosure: manager is the initiator
  assert.deepEqual(
    authorizeManagerClosure({
      hasManagerPermission: true,
      staff: { status: "OK", staffId: 456 },
      cashierStaffId: 123,
      actorId: "mgr1",
      initiatorId: "mgr1",
    }),
    {
      ok: false,
      status: 403,
      code: "PERMISSION_DENIED",
      error: "A different user with branch manager rights must close this session",
    }
  );

  console.log("All tests passed!");
}

run();
