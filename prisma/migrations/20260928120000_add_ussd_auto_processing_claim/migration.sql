-- Serialize USSD automatic processing across all Loan Matrix replicas.
ALTER TABLE "UssdLoanApplication"
  ADD COLUMN "autoProcessingClaimToken" TEXT,
  ADD COLUMN "autoProcessingClaimedAt" TIMESTAMP(3),
  ADD COLUMN "autoProcessingClaimExpiresAt" TIMESTAMP(3),
  ADD COLUMN "autoProcessingAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "UssdLoanApplication_status_autoProcessingClaimToken_createdAt_idx"
  ON "UssdLoanApplication"("status", "autoProcessingClaimToken", "createdAt");

CREATE INDEX "UssdLoanApplication_status_autoProcessingClaimExpiresAt_idx"
  ON "UssdLoanApplication"("status", "autoProcessingClaimExpiresAt");
