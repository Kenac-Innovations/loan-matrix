-- Access to USSD Details is an independent per-user entitlement.
ALTER TABLE "UserLogin"
ADD COLUMN IF NOT EXISTS "canAccessUssdDetails" BOOLEAN NOT NULL DEFAULT false;
