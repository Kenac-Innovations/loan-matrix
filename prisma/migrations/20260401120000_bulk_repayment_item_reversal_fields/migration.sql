-- Bulk repayment undo: track Fineract reversal in app
ALTER TABLE "BulkRepaymentItem" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "BulkRepaymentItem" ADD COLUMN IF NOT EXISTS "reversedBy" TEXT;
