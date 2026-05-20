-- Add optional Fineract GL account link to Teller (mirrors Bank).
-- When set, teller vault balance is sourced from the Fineract journal entries on this GL account.
-- When null, the application falls back to the local CashAllocation ledger.
ALTER TABLE "Teller"
  ADD COLUMN "glAccountId"   INTEGER,
  ADD COLUMN "glAccountName" TEXT,
  ADD COLUMN "glAccountCode" TEXT;
