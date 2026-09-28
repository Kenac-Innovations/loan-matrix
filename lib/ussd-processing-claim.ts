import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@/app/generated/prisma";

/**
 * The automatic USSD path can call CDE, Fineract, and payment integrations in
 * one run. Thirty minutes is deliberately conservative for that multi-step
 * path: it gives slow external calls and bounded retries time to finish while
 * still making an orphaned claim visible to the stale-claim quarantine.
 */
export const USSD_AUTO_PROCESSING_LEASE_MS = 30 * 60 * 1000;

export const STALE_USSD_PROCESSING_RECONCILIATION_NOTE =
  "Automatic processing lease expired; reconciliation required before retrying.";

export type UssdProcessingClaim = {
  token: string;
  claimedAt: Date;
  expiresAt: Date;
};

export type UssdApplicationProcessingDatabase = Pick<
  PrismaClient,
  "ussdLoanApplication"
>;

export function isUssdProcessingClaimActive(
  application: {
    autoProcessingClaimToken?: string | null;
    autoProcessingClaimExpiresAt?: Date | null;
  },
  now = new Date()
): boolean {
  return Boolean(
    application.autoProcessingClaimToken &&
      application.autoProcessingClaimExpiresAt &&
      application.autoProcessingClaimExpiresAt.getTime() > now.getTime()
  );
}

/**
 * Atomically claims an application for one worker. The application remains
 * CREATED while the worker is in flight; the CAS only succeeds when no claim
 * exists. Expired claims are intentionally not reclaimed automatically:
 * their worker may still have created a lead, Fineract loan, or payment side
 * effect even if its lease has elapsed.
 */
export async function claimUssdApplicationForProcessing(
  db: UssdApplicationProcessingDatabase,
  applicationId: string,
  options?: {
    tenantId?: string;
    expectedStatus?: string;
    now?: Date;
    leaseMs?: number;
    tokenFactory?: () => string;
  }
): Promise<UssdProcessingClaim | null> {
  const claimedAt = options?.now ?? new Date();
  const leaseMs = Math.max(
    1,
    Math.floor(options?.leaseMs ?? USSD_AUTO_PROCESSING_LEASE_MS)
  );
  const expiresAt = new Date(claimedAt.getTime() + leaseMs);
  const token = (options?.tokenFactory ?? randomUUID)();

  const claimed = await db.ussdLoanApplication.updateMany({
    where: {
      id: applicationId,
      ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
      status: options?.expectedStatus ?? "CREATED",
      autoProcessingClaimToken: null,
    },
    data: {
      autoProcessingClaimToken: token,
      autoProcessingClaimedAt: claimedAt,
      autoProcessingClaimExpiresAt: expiresAt,
      autoProcessingAttempts: { increment: 1 },
    },
  });

  return claimed.count === 1 ? { token, claimedAt, expiresAt } : null;
}

/**
 * Quarantines work abandoned by a worker whose lease has expired. This is a
 * separate operator-reconciliation state, not an automatic retry. The
 * token/status predicates make the update safe if the old worker finishes or
 * another terminal transition wins the race before this update is evaluated.
 */
export async function quarantineStaleUssdApplicationsForProcessing(
  db: UssdApplicationProcessingDatabase,
  options?: { now?: Date; tenantId?: string; expectedStatus?: string }
): Promise<number> {
  const now = options?.now ?? new Date();
  const quarantined = await db.ussdLoanApplication.updateMany({
    where: {
      ...(options?.tenantId ? { tenantId: options.tenantId } : {}),
      status: options?.expectedStatus ?? "CREATED",
      autoProcessingClaimToken: { not: null },
      autoProcessingClaimExpiresAt: { lte: now },
    },
    data: {
      status: "MANUAL_REVIEW",
      processedAt: now,
      processingNotes: STALE_USSD_PROCESSING_RECONCILIATION_NOTE,
      autoProcessingClaimToken: null,
      autoProcessingClaimedAt: null,
      autoProcessingClaimExpiresAt: null,
    },
  });

  return quarantined.count;
}

export type UssdProcessingFinalization = {
  status:
    | "AUTO_DISBURSED"
    | "MANUAL_REVIEW"
    | "PAYMENT_PENDING"
    | "AUTO_PROCESSING_STOPPED"
    | "AUTO_PROCESSING_FAILED";
  processedAt?: Date;
  processingNotes?: string | null;
};

/**
 * Finalizes only the lease that performed the work. A stale worker gets a
 * zero-row update after quarantine or another terminal transition and can
 * never overwrite that newer result.
 */
export async function finalizeUssdApplicationProcessing(
  db: UssdApplicationProcessingDatabase,
  applicationId: string,
  claimToken: string,
  finalization: UssdProcessingFinalization,
  tenantId?: string,
  expectedStatus = "CREATED"
): Promise<boolean> {
  const result = await db.ussdLoanApplication.updateMany({
    where: {
      id: applicationId,
      ...(tenantId ? { tenantId } : {}),
      status: expectedStatus,
      autoProcessingClaimToken: claimToken,
    },
    data: {
      status: finalization.status,
      processedAt: finalization.processedAt ?? new Date(),
      processingNotes: finalization.processingNotes ?? null,
      autoProcessingClaimToken: null,
      autoProcessingClaimedAt: null,
      autoProcessingClaimExpiresAt: null,
    },
  });

  return result.count === 1;
}
