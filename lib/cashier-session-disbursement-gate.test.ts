import assert from "node:assert/strict";
import { sessionBusinessDateString, findBlockingSessions, type GateSession } from "./cashier-session-disbursement-rules";

const d = (iso: string) => new Date(iso);

function session(overrides: Partial<GateSession> = {}): GateSession {
  return {
    id: "session-1",
    cashierId: "cashier-1",
    sessionStatus: "ACTIVE",
    businessDate: null,
    sessionStartTime: null,
    createdAt: d("2026-10-07T00:00:00Z"),
    ...overrides,
  };
}

function run() {
  // sessionBusinessDateString: explicit businessDate takes precedence
  assert.equal(
    sessionBusinessDateString(
      session({
        businessDate: d("2026-10-07T00:00:00Z"),
        sessionStartTime: d("2026-10-08T06:00:00Z"),
      })
    ),
    "2026-10-07"
  );

  // sessionBusinessDateString: falls back to sessionStartTime (Harare time)
  // 2026-10-07T22:30:00Z is Harare 2026-10-08
  assert.equal(
    sessionBusinessDateString(session({ sessionStartTime: d("2026-10-07T22:30:00Z") })),
    "2026-10-08"
  );

  // sessionBusinessDateString: falls back to createdAt if no businessDate or sessionStartTime
  assert.equal(
    sessionBusinessDateString(
      session({
        businessDate: null,
        sessionStartTime: null,
        createdAt: d("2026-10-07T06:00:00Z"),
      })
    ),
    "2026-10-07"
  );

  // findBlockingSessions: yesterday ACTIVE blocks
  // now = 2026-10-08T06:00:00Z (Harare 2026-10-08)
  // session for 2026-10-07, enforced from 2026-10-01
  const blocking = findBlockingSessions(
    [
      session({
        id: "s1",
        businessDate: d("2026-10-07T00:00:00Z"),
        sessionStatus: "ACTIVE",
      }),
    ],
    d("2026-10-01T00:00:00Z"),
    d("2026-10-08T06:00:00Z")
  );
  assert.equal(blocking.length, 1);
  assert.equal(blocking[0].id, "s1");

  // findBlockingSessions: yesterday PENDING_CLOSURE blocks
  const blockingPending = findBlockingSessions(
    [
      session({
        id: "s2",
        businessDate: d("2026-10-07T00:00:00Z"),
        sessionStatus: "PENDING_CLOSURE",
      }),
    ],
    d("2026-10-01T00:00:00Z"),
    d("2026-10-08T06:00:00Z")
  );
  assert.equal(blockingPending.length, 1);

  // findBlockingSessions: today ACTIVE doesn't block
  const noBlockToday = findBlockingSessions(
    [
      session({
        id: "s3",
        businessDate: d("2026-10-08T00:00:00Z"),
        sessionStatus: "ACTIVE",
      }),
    ],
    d("2026-10-01T00:00:00Z"),
    d("2026-10-08T06:00:00Z")
  );
  assert.equal(noBlockToday.length, 0);

  // findBlockingSessions: CLOSED doesn't block
  const noBlockClosed = findBlockingSessions(
    [
      session({
        id: "s4",
        businessDate: d("2026-10-07T00:00:00Z"),
        sessionStatus: "CLOSED",
      }),
    ],
    d("2026-10-01T00:00:00Z"),
    d("2026-10-08T06:00:00Z")
  );
  assert.equal(noBlockClosed.length, 0);

  // findBlockingSessions: session before enforcedFrom doesn't block
  const noBlockBefore = findBlockingSessions(
    [
      session({
        id: "s5",
        businessDate: d("2026-09-30T00:00:00Z"),
        sessionStatus: "ACTIVE",
      }),
    ],
    d("2026-10-01T00:00:00Z"),
    d("2026-10-08T06:00:00Z")
  );
  assert.equal(noBlockBefore.length, 0);

  // findBlockingSessions: Harare boundary
  // now = 2026-10-07T22:30Z (Harare 2026-10-08, so yesterday in Harare is 2026-10-07)
  // a session with businessDate 2026-10-07 (UTC) should block
  const harareBlock = findBlockingSessions(
    [
      session({
        id: "s6",
        businessDate: d("2026-10-07T00:00:00Z"),
        sessionStatus: "ACTIVE",
      }),
    ],
    d("2026-10-01T00:00:00Z"),
    d("2026-10-07T22:30:00Z") // this is Harare 2026-10-08T04:30Z
  );
  assert.equal(harareBlock.length, 1);

  // findBlockingSessions: null businessDate falls back to sessionStartTime Harare date
  // sessionStartTime 2026-10-07T22:30:00Z is Harare 2026-10-08
  // now is also 2026-10-08T06:00Z (Harare 2026-10-08), so today's open session doesn't block
  const nullBusinessDateToday = findBlockingSessions(
    [
      session({
        id: "s7",
        businessDate: null,
        sessionStartTime: d("2026-10-07T22:30:00Z"),
        sessionStatus: "ACTIVE",
      }),
    ],
    d("2026-10-01T00:00:00Z"),
    d("2026-10-08T06:00:00Z")
  );
  assert.equal(nullBusinessDateToday.length, 0);

  // findBlockingSessions: null businessDate, session from yesterday
  // sessionStartTime 2026-10-07T06:00:00Z is Harare 2026-10-07
  // now is 2026-10-08T06:00Z (Harare 2026-10-08), so yesterday's session blocks
  const nullBusinessDateYesterday = findBlockingSessions(
    [
      session({
        id: "s8",
        businessDate: null,
        sessionStartTime: d("2026-10-07T06:00:00Z"),
        sessionStatus: "ACTIVE",
      }),
    ],
    d("2026-10-01T00:00:00Z"),
    d("2026-10-08T06:00:00Z")
  );
  assert.equal(nullBusinessDateYesterday.length, 1);

  // findBlockingSessions: multiple blocking sessions, sorted by date
  const multiple = findBlockingSessions(
    [
      session({
        id: "s9",
        businessDate: d("2026-10-05T00:00:00Z"),
        sessionStatus: "ACTIVE",
      }),
      session({
        id: "s10",
        businessDate: d("2026-10-07T00:00:00Z"),
        sessionStatus: "ACTIVE",
      }),
      session({
        id: "s11",
        businessDate: d("2026-10-06T00:00:00Z"),
        sessionStatus: "ACTIVE",
      }),
    ],
    d("2026-10-01T00:00:00Z"),
    d("2026-10-08T06:00:00Z")
  );
  assert.equal(multiple.length, 3);
  // All three should be present (all before today and after enforcedFrom)
}

run();
