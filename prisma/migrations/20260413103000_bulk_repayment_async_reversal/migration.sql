-- Track async reversal progress for bulk repayment items.
ALTER TABLE "BulkRepaymentUpload"
ADD COLUMN "reversedCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "BulkRepaymentItem"
ADD COLUMN "reversalStatus" TEXT,
ADD COLUMN "reversalErrorMessage" TEXT,
ADD COLUMN "reversedAt" TIMESTAMP(3),
ADD COLUMN "reversedBy" TEXT;

CREATE INDEX "BulkRepaymentItem_uploadId_reversalStatus_idx"
ON "BulkRepaymentItem"("uploadId", "reversalStatus");
