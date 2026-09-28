import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  claimUssdApplicationForProcessing,
  finalizeUssdApplicationProcessing,
  isUssdProcessingClaimActive,
  quarantineStaleUssdApplicationsForProcessing,
  STALE_USSD_PROCESSING_RECONCILIATION_NOTE,
  type UssdApplicationProcessingDatabase,
} from "../ussd-processing-claim";

type StoredApplication = {
  id: string;
  status: string;
  autoProcessingClaimToken: string | null;
  autoProcessingClaimedAt: Date | null;
  autoProcessingClaimExpiresAt: Date | null;
  autoProcessingAttempts: number;
  processedAt?: Date | null;
  processingNotes?: string | null;
};

type ClaimWhere = {
  id?: string;
  status: string;
  autoProcessingClaimToken?:
    | string
    | null
    | { not: null };
  autoProcessingClaimExpiresAt?: { lte: Date } | null;
  OR?: Array<
    | { autoProcessingClaimToken: null }
    | { autoProcessingClaimExpiresAt: null }
    | { autoProcessingClaimExpiresAt: { lte: Date } }
  >;
};

type ClaimData = {
  status?: string;
  processedAt?: Date;
  processingNotes?: string | null;
  autoProcessingClaimToken?: string | null;
  autoProcessingClaimedAt?: Date | null;
  autoProcessingClaimExpiresAt?: Date | null;
  autoProcessingAttempts?: { increment: number };
};

class FakeClaimDatabase {
  readonly application: StoredApplication;

  readonly ussdLoanApplication = {
    updateMany: async (args: unknown) => {
      const { where, data } = args as { where: ClaimWhere; data: ClaimData };

      if (!this.matches(where)) {
        return { count: 0 };
      }

      this.application.status = data.status ?? this.application.status;
      this.application.processedAt =
        data.processedAt ?? this.application.processedAt ?? null;
      this.application.processingNotes =
        data.processingNotes ?? this.application.processingNotes ?? null;

      if ("autoProcessingClaimToken" in data) {
        this.application.autoProcessingClaimToken =
          data.autoProcessingClaimToken ?? null;
      }
      if ("autoProcessingClaimedAt" in data) {
        this.application.autoProcessingClaimedAt =
          data.autoProcessingClaimedAt ?? null;
      }
      if ("autoProcessingClaimExpiresAt" in data) {
        this.application.autoProcessingClaimExpiresAt =
          data.autoProcessingClaimExpiresAt ?? null;
      }
      if (data.autoProcessingAttempts) {
        this.application.autoProcessingAttempts +=
          data.autoProcessingAttempts.increment;
      }

      return { count: 1 };
    },
  };

  constructor(overrides?: Partial<StoredApplication>) {
    this.application = {
      id: "application-1",
      status: "CREATED",
      autoProcessingClaimToken: null,
      autoProcessingClaimedAt: null,
      autoProcessingClaimExpiresAt: null,
      autoProcessingAttempts: 0,
      ...overrides,
    };
  }

  asDatabase(): UssdApplicationProcessingDatabase {
    return this as unknown as UssdApplicationProcessingDatabase;
  }

  private matches(where: ClaimWhere): boolean {
    if (
      (where.id !== undefined && this.application.id !== where.id) ||
      this.application.status !== where.status
    ) {
      return false;
    }

    if (where.autoProcessingClaimToken !== undefined) {
      if (
        typeof where.autoProcessingClaimToken === "object" &&
        where.autoProcessingClaimToken !== null
      ) {
        if (
          where.autoProcessingClaimToken.not === null &&
          this.application.autoProcessingClaimToken === null
        ) {
          return false;
        }
      } else if (
        this.application.autoProcessingClaimToken !==
        where.autoProcessingClaimToken
      ) {
        return false;
      }
    }

    if (where.autoProcessingClaimExpiresAt) {
      const expiresAt = this.application.autoProcessingClaimExpiresAt;
      if (
        !expiresAt ||
        expiresAt.getTime() > where.autoProcessingClaimExpiresAt.lte.getTime()
      ) {
        return false;
      }
    }

    if (!where.OR) {
      return true;
    }

    return where.OR.some((condition) => {
      if ("autoProcessingClaimToken" in condition) {
        return this.application.autoProcessingClaimToken === null;
      }

      if ("autoProcessingClaimExpiresAt" in condition) {
        if (condition.autoProcessingClaimExpiresAt === null) {
          return this.application.autoProcessingClaimExpiresAt === null;
        }

        const expiresAt = this.application.autoProcessingClaimExpiresAt;
        return Boolean(
          expiresAt &&
            expiresAt.getTime() <=
              condition.autoProcessingClaimExpiresAt.lte.getTime()
        );
      }

      return false;
    });
  }
}

const BASE_TIME = new Date("2026-09-28T08:00:00.000Z");

test("concurrent workers can claim a CREATED application only once", async () => {
  const database = new FakeClaimDatabase();

  const [first, second] = await Promise.all([
    claimUssdApplicationForProcessing(database.asDatabase(), "application-1", {
      now: BASE_TIME,
      tokenFactory: () => "claim-a",
    }),
    claimUssdApplicationForProcessing(database.asDatabase(), "application-1", {
      now: BASE_TIME,
      tokenFactory: () => "claim-b",
    }),
  ]);

  assert.equal(Boolean(first) !== Boolean(second), true);
  assert.equal(database.application.autoProcessingAttempts, 1);
  assert.equal(database.application.autoProcessingClaimToken, "claim-a");
});

test("an active lease rejects another worker", async () => {
  const database = new FakeClaimDatabase();
  const first = await claimUssdApplicationForProcessing(
    database.asDatabase(),
    "application-1",
    { now: BASE_TIME, tokenFactory: () => "claim-a" }
  );

  const second = await claimUssdApplicationForProcessing(
    database.asDatabase(),
    "application-1",
    {
      now: new Date(BASE_TIME.getTime() + 60_000),
      tokenFactory: () => "claim-b",
    }
  );

  assert.ok(first);
  assert.equal(second, null);
  assert.equal(
    isUssdProcessingClaimActive(database.application, new Date(BASE_TIME.getTime() + 60_000)),
    true
  );
});

test("an expired lease is not automatically reclaimed", async () => {
  const database = new FakeClaimDatabase();
  await claimUssdApplicationForProcessing(database.asDatabase(), "application-1", {
    now: BASE_TIME,
    leaseMs: 60_000,
    tokenFactory: () => "claim-a",
  });

  const second = await claimUssdApplicationForProcessing(
    database.asDatabase(),
    "application-1",
    {
      now: new Date(BASE_TIME.getTime() + 60_001),
      leaseMs: 60_000,
      tokenFactory: () => "claim-b",
    }
  );

  assert.equal(second, null);
  assert.equal(database.application.autoProcessingAttempts, 1);
  assert.equal(database.application.autoProcessingClaimToken, "claim-a");
  assert.equal(
    isUssdProcessingClaimActive(
      database.application,
      new Date(BASE_TIME.getTime() + 60_001)
    ),
    false
  );
});

test("stale claims are quarantined for reconciliation without retrying", async () => {
  const database = new FakeClaimDatabase();
  const claim = await claimUssdApplicationForProcessing(
    database.asDatabase(),
    "application-1",
    {
      now: BASE_TIME,
      leaseMs: 60_000,
      tokenFactory: () => "claim-a",
    }
  );
  assert.ok(claim);

  const quarantined = await quarantineStaleUssdApplicationsForProcessing(
    database.asDatabase(),
    { now: new Date(BASE_TIME.getTime() + 60_001) }
  );

  assert.equal(quarantined, 1);
  assert.equal(database.application.status, "MANUAL_REVIEW");
  assert.equal(
    database.application.processingNotes,
    STALE_USSD_PROCESSING_RECONCILIATION_NOTE
  );
  assert.equal(database.application.autoProcessingClaimToken, null);
  assert.equal(database.application.autoProcessingClaimExpiresAt, null);
  assert.equal(database.application.autoProcessingAttempts, 1);
});

test("stale quarantine cannot overwrite a terminal status", async () => {
  const database = new FakeClaimDatabase();
  await claimUssdApplicationForProcessing(database.asDatabase(), "application-1", {
    now: BASE_TIME,
    leaseMs: 60_000,
    tokenFactory: () => "claim-a",
  });
  database.application.status = "AUTO_DISBURSED";

  const quarantined = await quarantineStaleUssdApplicationsForProcessing(
    database.asDatabase(),
    { now: new Date(BASE_TIME.getTime() + 60_001) }
  );

  assert.equal(quarantined, 0);
  assert.equal(database.application.status, "AUTO_DISBURSED");
  assert.equal(database.application.autoProcessingClaimToken, "claim-a");
});

test("only the current claim token can finalize a terminal status", async () => {
  const database = new FakeClaimDatabase();
  await claimUssdApplicationForProcessing(database.asDatabase(), "application-1", {
    now: BASE_TIME,
    leaseMs: 60_000,
    tokenFactory: () => "claim-a",
  });
  // A newer claim may only exist after a deliberate operator/recovery action;
  // automatic expired-lease reclaim is intentionally disabled.
  database.application.autoProcessingClaimToken = "claim-b";
  database.application.autoProcessingClaimedAt = new Date(
    BASE_TIME.getTime() + 60_001
  );
  database.application.autoProcessingClaimExpiresAt = new Date(
    BASE_TIME.getTime() + 30 * 60_000
  );

  const staleFinalization = await finalizeUssdApplicationProcessing(
    database.asDatabase(),
    "application-1",
    "claim-a",
    { status: "AUTO_PROCESSING_FAILED", processingNotes: "stale" }
  );
  assert.equal(staleFinalization, false);
  assert.equal(database.application.status, "CREATED");
  assert.equal(database.application.autoProcessingClaimToken, "claim-b");

  const currentFinalization = await finalizeUssdApplicationProcessing(
    database.asDatabase(),
    "application-1",
    "claim-b",
    { status: "AUTO_DISBURSED", processingNotes: "current" }
  );
  assert.equal(currentFinalization, true);
  assert.equal(database.application.status, "AUTO_DISBURSED");
  assert.equal(database.application.processingNotes, "current");
  assert.equal(database.application.autoProcessingClaimToken, null);
  assert.equal(database.application.autoProcessingClaimExpiresAt, null);
});

test("poller and manual submit route use tokenized claims", () => {
  const repoRoot = path.resolve(process.cwd());
  const pollerSource = readFileSync(
    path.join(repoRoot, "lib/ussd-auto-processing-poller.ts"),
    "utf8"
  );
  const routeSource = readFileSync(
    path.join(repoRoot, "app/api/ussd-leads/[id]/submit/route.ts"),
    "utf8"
  );
  const schemaSource = readFileSync(
    path.join(repoRoot, "prisma/schema.prisma"),
    "utf8"
  );
  const migrationSource = readFileSync(
    path.join(
      repoRoot,
      "prisma/migrations/20260928120000_add_ussd_auto_processing_claim/migration.sql"
    ),
    "utf8"
  );

  assert.match(pollerSource, /claimUssdApplicationForProcessing/);
  assert.match(pollerSource, /quarantineStaleUssdApplicationsForProcessing/);
  assert.match(pollerSource, /autoProcessingClaimToken: null/);
  assert.match(pollerSource, /finalizeUssdApplicationProcessing/);
  assert.match(routeSource, /claimUssdApplicationForProcessing/);
  assert.match(routeSource, /status: 409/);
  assert.match(routeSource, /finalizeUssdApplicationProcessing/);
  assert.match(routeSource, /tenantId: application\.tenantId/);
  assert.match(schemaSource, /autoProcessingClaimToken\s+String\?/);
  assert.match(schemaSource, /autoProcessingClaimExpiresAt\s+DateTime\?/);
  assert.match(schemaSource, /autoProcessingAttempts\s+Int\s+@default\(0\)/);
  assert.match(migrationSource, /CREATE INDEX/);

  const claimSource = readFileSync(
    path.join(repoRoot, "lib/ussd-processing-claim.ts"),
    "utf8"
  );
  assert.match(claimSource, /autoProcessingClaimToken: null/);
  assert.match(claimSource, /quarantineStaleUssdApplicationsForProcessing/);
  assert.doesNotMatch(
    claimSource,
    /autoProcessingClaimExpiresAt:\s*\{\s*lte:\s*claimedAt/
  );
});
