-- Add Fineract cashier summary snapshots and currency to CashierSession
-- Phase 2: capture Fineract's netCash as source of truth for expected balance

-- Add new columns for storing Fineract cashier summary snapshots and currency
ALTER TABLE "CashierSession"
    ADD COLUMN "currency" TEXT,
    ADD COLUMN "fineractOpeningSummary" JSONB,
    ADD COLUMN "fineractClosingSummary" JSONB,
    -- Fineract netCash is cumulative and the close does not post the return to
    -- Fineract, so expected cash is measured from the previous close's netCash.
    ADD COLUMN "fineractBaselineNetCash" DOUBLE PRECISION;

-- Backfill officeId from Teller table for sessions where it is NULL
-- This ensures every session row has an officeId (either pre-existing or backfilled)
UPDATE "CashierSession" s
SET "officeId" = t."officeId"
FROM "Teller" t
WHERE s."tellerId" = t.id AND s."officeId" IS NULL;

-- Backfill businessDate from sessionStartTime or createdAt (converting to Africa/Harare timezone)
-- This ensures every session row has a businessDate (either pre-existing or backfilled)
UPDATE "CashierSession"
SET "businessDate" = ((COALESCE("sessionStartTime","createdAt") AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Harare')::date
WHERE "businessDate" IS NULL;
