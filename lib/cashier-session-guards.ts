/**
 * Guards for cashier session state transitions (Phase 3).
 * Blocks cash operations when a session is awaiting manager closure.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCashierSessionTenantSettings } from "@/lib/cashier-session-settings";

/**
 * Check if a cashier has a PENDING_CLOSURE session.
 * If module is on and session exists, return a 409 response; otherwise null.
 * Used to block cash transactions while closure is pending.
 */
export async function pendingClosureBlockResponse(
  tenantId: string,
  cashierDbId: string | null | undefined
): Promise<NextResponse | null> {
  if (!cashierDbId) {
    return null;
  }

  const { isTellerManagementModuleOn } = await getCashierSessionTenantSettings(tenantId);
  if (!isTellerManagementModuleOn) {
    return null;
  }

  const pendingSession = await prisma.cashierSession.findFirst({
    where: {
      tenantId,
      cashierId: cashierDbId,
      sessionStatus: "PENDING_CLOSURE",
    },
  });

  if (!pendingSession) {
    return null;
  }

  return NextResponse.json(
    {
      error: "Session closure pending",
      details: "This cashier's session is awaiting branch manager closure. Close or reject it before recording cash transactions.",
      code: "SESSION_CLOSURE_PENDING",
    },
    { status: 409 }
  );
}

/**
 * Assert that a cashier is not in PENDING_CLOSURE state.
 * Throws an Error if module is on and session is pending.
 * Used to freeze cash operations at lower levels (state machine, reverse-payout).
 */
export async function assertCashierNotPendingClosure(
  tenantId: string,
  cashierDbId: string | null | undefined
): Promise<void> {
  if (!cashierDbId) {
    return;
  }

  const { isTellerManagementModuleOn } = await getCashierSessionTenantSettings(tenantId);
  if (!isTellerManagementModuleOn) {
    return;
  }

  const pendingSession = await prisma.cashierSession.findFirst({
    where: {
      tenantId,
      cashierId: cashierDbId,
      sessionStatus: "PENDING_CLOSURE",
    },
  });

  if (pendingSession) {
    throw new Error(
      "This cashier's session is awaiting branch manager closure. Close or reject it before recording cash transactions."
    );
  }
}
