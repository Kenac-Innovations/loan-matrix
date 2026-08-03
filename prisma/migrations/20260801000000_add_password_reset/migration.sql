-- CreateTable
CREATE TABLE "PasswordResetChallenge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fineractUserId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "verificationTokenHash" TEXT,
    "configuredChannels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "deliveredChannels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "maskedDestinations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "challengeId" TEXT,
    "fineractUserId" INTEGER,
    "username" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "configuredChannels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "deliveredChannels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "maskedDestinations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "failureReason" TEXT,
    "requestIp" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordResetChallenge_tenantId_username_idx" ON "PasswordResetChallenge"("tenantId", "username");
CREATE INDEX "PasswordResetChallenge_tenantId_fineractUserId_idx" ON "PasswordResetChallenge"("tenantId", "fineractUserId");
CREATE INDEX "PasswordResetChallenge_tenantId_expiresAt_idx" ON "PasswordResetChallenge"("tenantId", "expiresAt");
CREATE INDEX "PasswordResetChallenge_tenantId_consumedAt_idx" ON "PasswordResetChallenge"("tenantId", "consumedAt");
CREATE INDEX "PasswordResetChallenge_tenantId_invalidatedAt_idx" ON "PasswordResetChallenge"("tenantId", "invalidatedAt");
CREATE INDEX "PasswordResetLog_tenantId_createdAt_idx" ON "PasswordResetLog"("tenantId", "createdAt");
CREATE INDEX "PasswordResetLog_tenantId_username_createdAt_idx" ON "PasswordResetLog"("tenantId", "username", "createdAt");
CREATE INDEX "PasswordResetLog_tenantId_event_createdAt_idx" ON "PasswordResetLog"("tenantId", "event", "createdAt");

-- AddForeignKey
ALTER TABLE "PasswordResetChallenge" ADD CONSTRAINT "PasswordResetChallenge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetLog" ADD CONSTRAINT "PasswordResetLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
