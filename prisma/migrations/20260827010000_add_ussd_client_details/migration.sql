-- Allow explicitly authorised users to view and update USSD client information.
ALTER TABLE "UserLogin"
ADD COLUMN IF NOT EXISTS "canUpdateUssdClientDetails" BOOLEAN NOT NULL DEFAULT false;

-- Audit every Loan Matrix initiated USSD client-information update attempt.
CREATE TABLE IF NOT EXISTS "UssdClientInfoUpdateLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "updateType" TEXT NOT NULL DEFAULT 'PHONE',
    "sourcePhoneNumber" TEXT NOT NULL,
    "requestedPhoneNumber" TEXT NOT NULL,
    "ussdUserId" INTEGER,
    "fineractClientId" INTEGER,
    "clientName" TEXT,
    "actorUserId" INTEGER NOT NULL,
    "actorName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "ussdStatus" TEXT,
    "fineractStatus" TEXT,
    "responseMessage" TEXT,
    "errorMessage" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UssdClientInfoUpdateLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UssdClientInfoUpdateLog_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UssdClientInfoUpdateLog_tenantId_createdAt_idx"
ON "UssdClientInfoUpdateLog"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "UssdClientInfoUpdateLog_tenantId_sourcePhoneNumber_idx"
ON "UssdClientInfoUpdateLog"("tenantId", "sourcePhoneNumber");

CREATE INDEX IF NOT EXISTS "UssdClientInfoUpdateLog_tenantId_fineractClientId_idx"
ON "UssdClientInfoUpdateLog"("tenantId", "fineractClientId");

CREATE INDEX IF NOT EXISTS "UssdClientInfoUpdateLog_tenantId_status_idx"
ON "UssdClientInfoUpdateLog"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "UssdClientInfoUpdateLog_actorUserId_createdAt_idx"
ON "UssdClientInfoUpdateLog"("actorUserId", "createdAt");
