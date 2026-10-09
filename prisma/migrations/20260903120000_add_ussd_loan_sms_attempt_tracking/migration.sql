-- Keep USSD SMS dispatch idempotent when queue processing is retried.
ALTER TABLE "UssdLoanApplication"
  ADD COLUMN "submissionSmsAttemptedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionSmsAttemptedAt" TIMESTAMP(3);
