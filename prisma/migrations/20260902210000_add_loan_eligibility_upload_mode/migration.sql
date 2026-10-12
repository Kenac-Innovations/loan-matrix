-- Existing uploads used replacement behaviour before operators could choose a mode.
-- Preserve that historical fact, while making new uploads append by default.
ALTER TABLE "LoanEligibilityUpload"
ADD COLUMN "replaceExisting" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "LoanEligibilityUpload"
ALTER COLUMN "replaceExisting" SET DEFAULT false;
