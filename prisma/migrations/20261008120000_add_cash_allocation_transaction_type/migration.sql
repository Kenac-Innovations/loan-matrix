-- Add transaction type tracking and expense GL posting columns to CashAllocation
ALTER TABLE "CashAllocation"
  ADD COLUMN "transactionType" TEXT,
  ADD COLUMN "expenseGlAccountId" INTEGER,
  ADD COLUMN "expenseGlAccountCode" TEXT,
  ADD COLUMN "expenseGlAccountName" TEXT,
  ADD COLUMN "expenseJournalEntryId" TEXT;

CREATE INDEX "CashAllocation_tenantId_transactionType_idx"
  ON "CashAllocation"("tenantId", "transactionType");
