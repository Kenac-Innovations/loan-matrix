-- Add per-user permission for administrative USSD PIN resets.
ALTER TABLE "UserLogin"
ADD COLUMN IF NOT EXISTS "canResetUssdPin" BOOLEAN NOT NULL DEFAULT false;

-- Audit log for Loan Matrix initiated USSD PIN reset attempts.
CREATE TABLE IF NOT EXISTS "UssdPinResetLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "ussdUserId" INTEGER,
    "clientName" TEXT,
    "nationalIdMask" TEXT,
    "actorUserId" INTEGER NOT NULL,
    "actorName" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "ussdStatus" TEXT,
    "responseMessage" TEXT,
    "errorMessage" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UssdPinResetLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UssdPinResetLog_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UssdPinResetLog_tenantId_createdAt_idx"
ON "UssdPinResetLog"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "UssdPinResetLog_tenantId_phoneNumber_idx"
ON "UssdPinResetLog"("tenantId", "phoneNumber");

CREATE INDEX IF NOT EXISTS "UssdPinResetLog_tenantId_status_idx"
ON "UssdPinResetLog"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "UssdPinResetLog_actorUserId_createdAt_idx"
ON "UssdPinResetLog"("actorUserId", "createdAt");
