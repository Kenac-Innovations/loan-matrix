ALTER TABLE "BulkRepaymentUpload"
ADD COLUMN IF NOT EXISTS "reversedCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "BulkRepaymentItem"
ADD COLUMN IF NOT EXISTS "reversalStatus" TEXT,
ADD COLUMN IF NOT EXISTS "reversalErrorMessage" TEXT;

CREATE INDEX IF NOT EXISTS "BulkRepaymentItem_uploadId_reversalStatus_idx"
ON "BulkRepaymentItem"("uploadId", "reversalStatus");
