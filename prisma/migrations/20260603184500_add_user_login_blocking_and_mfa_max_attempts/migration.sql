-- AlterTable
ALTER TABLE "UserLogin"
ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "blockedSource" TEXT,
ADD COLUMN IF NOT EXISTS "blockedNote" TEXT,
ADD COLUMN IF NOT EXISTS "blockedByActorUserId" INTEGER,
ADD COLUMN IF NOT EXISTS "blockedByActorName" TEXT;

-- AlterTable
ALTER TABLE "MfaChallenge"
ALTER COLUMN "maxAttempts" SET DEFAULT 3;

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserLoginBlockEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userLoginId" TEXT NOT NULL,
    "fineractUserId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "actorUserId" INTEGER,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLoginBlockEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserLoginBlockEvent_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserLoginBlockEvent_userLoginId_fkey"
      FOREIGN KEY ("userLoginId") REFERENCES "UserLogin"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserLogin_tenantId_isBlocked_idx"
ON "UserLogin"("tenantId", "isBlocked");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserLoginBlockEvent_tenantId_userLoginId_createdAt_idx"
ON "UserLoginBlockEvent"("tenantId", "userLoginId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserLoginBlockEvent_tenantId_fineractUserId_createdAt_idx"
ON "UserLoginBlockEvent"("tenantId", "fineractUserId", "createdAt");
