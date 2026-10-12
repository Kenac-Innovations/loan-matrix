-- Add teller/session management settings to Tenant and new CashVarianceEvent data structures
-- Phase 1: additive data model + pure enforcement policy (no behavior changes yet)

-- Add session closure enforcement settings to Tenant
ALTER TABLE "Tenant"
    ADD COLUMN "isTellerManagementModuleOn" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "enforceSessionClosureByDefault" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "sessionClosureEnforcedFrom" TIMESTAMP(3),
    ADD COLUMN "sessionClosureSettingsUpdatedBy" TEXT,
    ADD COLUMN "sessionClosureSettingsUpdatedAt" TIMESTAMP(3),
    ADD COLUMN "tellerModuleEnabledAt" TIMESTAMP(3),
    ADD COLUMN "cashVarianceTolerance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Add session closure enforcement settings to Cashier
ALTER TABLE "Cashier"
    ADD COLUMN "enforceSessionClosure" BOOLEAN,
    ADD COLUMN "sessionClosureEnforcedFrom" TIMESTAMP(3),
    ADD COLUMN "sessionClosureFlagUpdatedBy" TEXT,
    ADD COLUMN "sessionClosureFlagUpdatedAt" TIMESTAMP(3);

-- Add business date and closure tracking fields to CashierSession
ALTER TABLE "CashierSession"
    ADD COLUMN "businessDate" DATE,
    ADD COLUMN "officeId" INTEGER,
    ADD COLUMN "declaredAmount" DOUBLE PRECISION,
    ADD COLUMN "closureInitiatedBy" TEXT,
    ADD COLUMN "closureInitiatedAt" TIMESTAMP(3),
    ADD COLUMN "managerCountedAmount" DOUBLE PRECISION,
    ADD COLUMN "closedBy" TEXT,
    ADD COLUMN "closedAt" TIMESTAMP(3),
    ADD COLUMN "closureRejectedBy" TEXT,
    ADD COLUMN "closureRejectedAt" TIMESTAMP(3),
    ADD COLUMN "closureRejectionReason" TEXT;

-- Add indexes for new fields in CashierSession
CREATE INDEX "CashierSession_tenantId_cashierId_businessDate_idx" ON "CashierSession"("tenantId", "cashierId", "businessDate");
CREATE INDEX "CashierSession_tenantId_officeId_businessDate_idx" ON "CashierSession"("tenantId", "officeId", "businessDate");

-- Create CashVarianceEvent table
CREATE TABLE "CashVarianceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "tellerId" TEXT NOT NULL,
    "officeId" INTEGER,
    "businessDate" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "expectedBalance" DOUBLE PRECISION NOT NULL,
    "countedAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolutionType" TEXT,
    "resolutionNotes" TEXT,
    "fineractJournalEntryId" TEXT,
    "vaultAllocationId" TEXT,
    "raisedBy" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashVarianceEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CashierSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CashVarianceEvent_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "Cashier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Add indexes for CashVarianceEvent
CREATE UNIQUE INDEX "CashVarianceEvent_sessionId_key" ON "CashVarianceEvent"("sessionId");
CREATE INDEX "CashVarianceEvent_tenantId_status_idx" ON "CashVarianceEvent"("tenantId", "status");
CREATE INDEX "CashVarianceEvent_tenantId_officeId_businessDate_idx" ON "CashVarianceEvent"("tenantId", "officeId", "businessDate");
CREATE INDEX "CashVarianceEvent_tenantId_cashierId_status_idx" ON "CashVarianceEvent"("tenantId", "cashierId", "status");

-- Create CashVarianceEventLog table
CREATE TABLE "CashVarianceEventLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "notes" TEXT,
    "resolutionType" TEXT,
    "vaultAdjustment" DOUBLE PRECISION,
    "vaultAllocationId" TEXT,
    "performedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashVarianceEventLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CashVarianceEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add indexes for CashVarianceEventLog
CREATE INDEX "CashVarianceEventLog_tenantId_eventId_idx" ON "CashVarianceEventLog"("tenantId", "eventId");

-- Backfill officeId from Teller table (using the office where the teller is located)
UPDATE "CashierSession" s
SET "officeId" = t."officeId"
FROM "Teller" t
WHERE s."tellerId" = t.id AND s."officeId" IS NULL;

-- Backfill businessDate from sessionStartTime or createdAt (converting to Africa/Harare timezone)
UPDATE "CashierSession"
SET "businessDate" = ((COALESCE("sessionStartTime","createdAt") AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Harare')::date
WHERE "businessDate" IS NULL;
