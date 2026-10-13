/**
 * Pure helpers for cash disbursement session rules (no Prisma).
 * Moved from cashier-session-disbursement-gate to enable testing without DATABASE_URL.
 */

import { toBusinessDateString } from "@/lib/cashier-session-enforcement-policy";

export type GateSession = {
  id: string;
  cashierId: string;
  sessionStatus: string;
  businessDate: Date | null;
  sessionStartTime: Date | null;
  createdAt: Date;
};

/**
 * Derive the business date (Africa/Harare) for a session.
 * Prefers explicit businessDate column; falls back to sessionStartTime then createdAt.
 */
export function sessionBusinessDateString(s: GateSession): string {
  const instant = s.businessDate ?? s.sessionStartTime ?? s.createdAt;
  if (s.businessDate) {
    // @db.Date is UTC midnight; just slice the date part.
    return s.businessDate.toISOString().slice(0, 10);
  }
  return toBusinessDateString(instant);
}

/**
 * Find sessions that block disbursement: ACTIVE or PENDING_CLOSURE with business date
 * strictly before today (in Harare time) and on or after enforcedFrom.
 * Today's open session never blocks.
 */
export function findBlockingSessions(
  sessions: GateSession[],
  enforcedFrom: Date,
  now: Date
): GateSession[] {
  const todayBusinessDate = toBusinessDateString(now);
  const enforcedFromDate = toBusinessDateString(enforcedFrom);

  return sessions.filter((session) => {
    // Only ACTIVE or PENDING_CLOSURE sessions block
    if (!["ACTIVE", "PENDING_CLOSURE"].includes(session.sessionStatus)) {
      return false;
    }

    const sessionDate = sessionBusinessDateString(session);

    // Session's business date must be < today (strictly earlier)
    if (sessionDate >= todayBusinessDate) {
      return false;
    }

    // Session's business date must be >= enforcedFrom (string compare)
    if (sessionDate < enforcedFromDate) {
      return false;
    }

    return true;
  });
}
