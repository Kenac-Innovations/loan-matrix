// Auto-processing for USSD loan applications.
//
// loan-matrix-be now owns ingestion: it consumes ussdloanapplications.queue
// directly and inserts UssdLoanApplication rows (status "CREATED") into
// this same Postgres database — see
// zw.co.kenac.loanmatrixbe.ussdloans.service.UssdLoanApplicationListener.
//
// This module owns what used to run inline inside the old AMQP consumer
// callback (lib/amqp-queue-service.ts, removed): matching a tenant's
// configured USSD auto-lead rules and, if one matches, running the
// application through CDE decisioning / lead creation / auto-disbursement.
// That business logic is unchanged — only the trigger changed, from "a
// message arrived" to "poll for recently-queued CREATED rows".
import prisma from "./prisma";
import { isBackendOwnedSalaryAdvanceRule } from "./tenant-auto-disbursement-rules";
import {
  getTenantUssdAutoLeadRules,
  findMatchingUssdAutoLeadRule,
} from "./tenant-ussd-auto-lead-rules";
import {
  runWithBoundedRetries,
  type UssdAutoProcessingStatus,
} from "./ussd-auto-processing-policy";
import {
  processUssdApplicationToDisbursement,
  type UssdLoanProcessingResult,
} from "./ussd-loan-processing-service";
import {
  claimUssdApplicationForProcessing,
  finalizeUssdApplicationProcessing,
  quarantineStaleUssdApplicationsForProcessing,
} from "./ussd-processing-claim";

const APPLICATION_STATUS_BY_OUTCOME: Record<
  UssdAutoProcessingStatus,
  | "AUTO_DISBURSED"
  | "PAYMENT_PENDING"
  | "MANUAL_REVIEW"
  | "AUTO_PROCESSING_STOPPED"
  | "AUTO_PROCESSING_FAILED"
> = {
  completed: "AUTO_DISBURSED",
  payment_pending: "PAYMENT_PENDING",
  manual_review: "MANUAL_REVIEW",
  stopped: "AUTO_PROCESSING_STOPPED",
  failed: "AUTO_PROCESSING_FAILED",
};

function isRetryableUssdProcessingError(error: unknown): boolean {
  const status =
    typeof error === "object" && error !== null
      ? Number((error as { status?: unknown }).status)
      : Number.NaN;

  return !Number.isFinite(status) || status === 429 || status >= 500;
}

function buildProcessingNotes(result: UssdLoanProcessingResult): string {
  const reason =
    result.autoProgressMessage ||
    (result.cdeDecision
      ? `CDE returned ${result.cdeDecision}`
      : "CDE evaluation failed");

  return `Lead ${result.leadId}: ${reason}`;
}

// A row with no matching auto-lead rule stays "CREATED" forever (it's
// parked for manual handling in the UI, same as before) — rules are static
// tenant config, so if nothing matched within this window nothing ever
// will. Bounding the poll window keeps the query cheap instead of
// re-scanning every unmatched application that's ever been queued.
//
// Bound on createdAt, not queuedAt: every historical row (100% of ~117k)
// has queuedAt stuck at Unix epoch — the USSD gateway appears to send an
// uninitialized timestamp for that field. The old inline consumer never
// depended on queuedAt for anything functional, so this was invisible;
// filtering on it here would mean this poller never matches anything,
// ever, and auto-lead-creation/auto-disbursement silently stops working
// for every future application. createdAt is DB/app-generated and
// reliable — both Prisma's default and loan-matrix-be's
// PrismaTimestamps.nowUtc() set it accurately on ingest.
const CANDIDATE_WINDOW_MS = 60 * 60 * 1000;
const BATCH_SIZE = 25;

let isPolling = false;
let lastTickAt: Date | null = null;
let lastError: string | null = null;

export function getUssdAutoProcessingPollerStatus(): {
  isPolling: boolean;
  lastTickAt: string | null;
  lastError: string | null;
} {
  return {
    isPolling,
    lastTickAt: lastTickAt ? lastTickAt.toISOString() : null,
    lastError,
  };
}

export async function pollUssdAutoProcessing(): Promise<void> {
  if (isPolling) return; // previous tick still running, skip this one
  isPolling = true;
  try {
    const now = new Date();
    const quarantinedCount =
      await quarantineStaleUssdApplicationsForProcessing(prisma, { now });
    if (quarantinedCount > 0) {
      console.warn(
        `[UssdAutoProcessing] Quarantined ${quarantinedCount} stale application claim(s) for reconciliation`
      );
    }

    const candidates = await prisma.ussdLoanApplication.findMany({
      where: {
        status: "CREATED",
        createdAt: { gte: new Date(Date.now() - CANDIDATE_WINDOW_MS) },
        autoProcessingClaimToken: null,
      },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
    });

    for (const application of candidates) {
      await evaluateAndProcess(application);
    }

    lastError = null;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    console.error("[UssdAutoProcessing] Poll tick failed:", error);
  } finally {
    lastTickAt = new Date();
    isPolling = false;
  }
}

async function evaluateAndProcess(
  ussdApplication: Awaited<
    ReturnType<typeof prisma.ussdLoanApplication.findMany>
  >[number]
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ussdApplication.tenantId },
  });
  if (!tenant) {
    console.error(
      `[UssdAutoProcessing] Application ${ussdApplication.id} references missing tenant ${ussdApplication.tenantId}`
    );
    return;
  }

  const tenantSettings =
    (tenant.settings as unknown as Record<string, unknown> | null) || null;
  const autoLeadRules = getTenantUssdAutoLeadRules(tenantSettings);
  if (
    isBackendOwnedSalaryAdvanceRule(
      tenantSettings,
      ussdApplication.loanMatrixLoanProductId
    )
  ) {
    // New backend-owned Salary Advance applications are inserted as
    // BACKEND_QUEUED. This is only a defensive guard for any application that
    // was manually inserted with CREATED status.
    return;
  }
  const matchingRule = findMatchingUssdAutoLeadRule(
    autoLeadRules,
    ussdApplication.loanMatrixLoanProductId
  );

  if (!matchingRule) {
    return;
  }

  const claim = await claimUssdApplicationForProcessing(
    prisma,
    ussdApplication.id,
    { tenantId: ussdApplication.tenantId }
  );
  if (!claim) {
    // Another replica owns the active lease, or the application moved out of
    // CREATED between the candidate query and this CAS. Either way, this
    // worker must not invoke CDE/Fineract for it.
    return;
  }

  try {
    const result = await runWithBoundedRetries(
      async () => {
        const processingResult = await processUssdApplicationToDisbursement({
          application: ussdApplication,
          triggeredBy: "system",
        });

        if (processingResult.status === "failed") {
          throw new Error(
            processingResult.autoProgressMessage ||
              "USSD automatic processing failed before a CDE decision"
          );
        }

        return processingResult;
      },
      {
        maxAttempts: 3,
        shouldRetry: isRetryableUssdProcessingError,
      }
    );

    const finalized = await finalizeUssdApplicationProcessing(
      prisma,
      ussdApplication.id,
      claim.token,
      {
        status: APPLICATION_STATUS_BY_OUTCOME[result.status],
        processedAt: new Date(),
        processingNotes: buildProcessingNotes(result),
      },
      ussdApplication.tenantId
    );

    if (!finalized) {
      console.warn(
        `[UssdAutoProcessing] Lease lost before finalizing application ${ussdApplication.id}; leaving the newer worker's result untouched`
      );
      return;
    }

    console.log(
      `[UssdAutoProcessing] ${result.status} for lead ${result.leadId}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    const finalized = await finalizeUssdApplicationProcessing(
      prisma,
      ussdApplication.id,
      claim.token,
      {
        status: "AUTO_PROCESSING_FAILED",
        processedAt: new Date(),
        processingNotes: `Automatic processing failed after 3 attempts: ${message}`,
      },
      ussdApplication.tenantId
    );

    if (!finalized) {
      console.warn(
        `[UssdAutoProcessing] Lease lost before recording failure for application ${ussdApplication.id}; leaving the newer worker's result untouched`
      );
    }

    console.error(
      `[UssdAutoProcessing] Failed for application ${ussdApplication.loanApplicationUssdId}:`,
      error
    );
  }
}
