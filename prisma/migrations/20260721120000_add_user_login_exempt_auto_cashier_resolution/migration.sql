-- Per-user opt-out of the tenant-wide auto cashier resolution feature on the loan repayment modal.
ALTER TABLE "UserLogin"
ADD COLUMN IF NOT EXISTS "exemptFromAutoCashierResolution" BOOLEAN NOT NULL DEFAULT false;
