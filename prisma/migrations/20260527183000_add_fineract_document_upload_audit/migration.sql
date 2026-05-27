-- Create table for tracking who uploaded Fineract documents in Loan Matrix
CREATE TABLE "FineractDocumentUpload" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" INTEGER NOT NULL,
  "documentId" INTEGER NOT NULL,
  "fineractUserId" INTEGER NOT NULL,
  "username" TEXT NOT NULL,
  "documentSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FineractDocumentUpload_pkey" PRIMARY KEY ("id")
);

-- Foreign key to tenant
ALTER TABLE "FineractDocumentUpload"
ADD CONSTRAINT "FineractDocumentUpload_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Prevent duplicate audit rows for the same document within a tenant
CREATE UNIQUE INDEX "FineractDocumentUpload_tenantId_documentId_key"
ON "FineractDocumentUpload"("tenantId", "documentId");

-- Query helpers
CREATE INDEX "FineractDocumentUpload_tenantId_entityType_entityId_idx"
ON "FineractDocumentUpload"("tenantId", "entityType", "entityId");

CREATE INDEX "FineractDocumentUpload_tenantId_fineractUserId_idx"
ON "FineractDocumentUpload"("tenantId", "fineractUserId");

CREATE INDEX "FineractDocumentUpload_tenantId_documentSavedAt_idx"
ON "FineractDocumentUpload"("tenantId", "documentSavedAt");
