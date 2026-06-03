-- CreateTable
CREATE TABLE "UserLogin" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fineractUserId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "lastMfaChannel" TEXT,
    "lastMfaSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLogin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaChallenge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fineractUserId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "maskedDestination" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "verificationTokenHash" TEXT,
    "authContext" JSONB NOT NULL,
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

    CONSTRAINT "MfaChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserLogin_tenantId_fineractUserId_key" ON "UserLogin"("tenantId", "fineractUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserLogin_tenantId_username_key" ON "UserLogin"("tenantId", "username");

-- CreateIndex
CREATE INDEX "UserLogin_tenantId_email_idx" ON "UserLogin"("tenantId", "email");

-- CreateIndex
CREATE INDEX "UserLogin_tenantId_phone_idx" ON "UserLogin"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "MfaChallenge_tenantId_username_idx" ON "MfaChallenge"("tenantId", "username");

-- CreateIndex
CREATE INDEX "MfaChallenge_tenantId_fineractUserId_idx" ON "MfaChallenge"("tenantId", "fineractUserId");

-- CreateIndex
CREATE INDEX "MfaChallenge_tenantId_expiresAt_idx" ON "MfaChallenge"("tenantId", "expiresAt");

-- CreateIndex
CREATE INDEX "MfaChallenge_tenantId_consumedAt_idx" ON "MfaChallenge"("tenantId", "consumedAt");

-- CreateIndex
CREATE INDEX "MfaChallenge_tenantId_invalidatedAt_idx" ON "MfaChallenge"("tenantId", "invalidatedAt");

-- AddForeignKey
ALTER TABLE "UserLogin" ADD CONSTRAINT "UserLogin_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaChallenge" ADD CONSTRAINT "MfaChallenge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
