-- Preserve the GL account credited for each teller-vault allocation. Existing
-- rows remain null and therefore represent the historical bank-default source.
ALTER TABLE "CashAllocation"
    ADD COLUMN "sourceGlAccountId" INTEGER,
    ADD COLUMN "sourceGlAccountName" TEXT,
    ADD COLUMN "sourceGlAccountCode" TEXT;
