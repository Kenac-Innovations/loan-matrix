-- Add per-user access for the payment confirmation workspace.
ALTER TABLE "UserLogin"
ADD COLUMN IF NOT EXISTS "canConfirmPayments" BOOLEAN NOT NULL DEFAULT false;
