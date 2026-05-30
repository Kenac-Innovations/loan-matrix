-- Create table for product eligibility uploads (history)
CREATE TABLE "LoanEligibilityUpload" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "productExternalId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'STAGING',
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "syncedRows" INTEGER NOT NULL DEFAULT 0,
  "failedRows" INTEGER NOT NULL DEFAULT 0,
  "syncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoanEligibilityUpload_pkey" PRIMARY KEY ("id")
);

-- Create table for row-level upload items
CREATE TABLE "LoanEligibilityUploadItem" (
  "id" TEXT NOT NULL,
  "uploadId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "nrc" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "normalizedPhone" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoanEligibilityUploadItem_pkey" PRIMARY KEY ("id")
);

-- Foreign key
ALTER TABLE "LoanEligibilityUploadItem"
ADD CONSTRAINT "LoanEligibilityUploadItem_uploadId_fkey"
FOREIGN KEY ("uploadId") REFERENCES "LoanEligibilityUpload"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "LoanEligibilityUpload_tenantId_createdAt_idx"
ON "LoanEligibilityUpload"("tenantId", "createdAt");

CREATE INDEX "LoanEligibilityUpload_tenantId_productExternalId_idx"
ON "LoanEligibilityUpload"("tenantId", "productExternalId");

CREATE INDEX "LoanEligibilityUpload_tenantId_status_idx"
ON "LoanEligibilityUpload"("tenantId", "status");

CREATE INDEX "LoanEligibilityUploadItem_uploadId_status_idx"
ON "LoanEligibilityUploadItem"("uploadId", "status");

CREATE INDEX "LoanEligibilityUploadItem_uploadId_normalizedPhone_idx"
ON "LoanEligibilityUploadItem"("uploadId", "normalizedPhone");
