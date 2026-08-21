ALTER TABLE "InventoryItem"
ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE "InventoryBalance"
ADD COLUMN "fineractOfficeName" TEXT,
ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE "InventoryMovement"
ADD COLUMN "fineractOfficeName" TEXT,
ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE "StockLoanIssue"
DROP CONSTRAINT IF EXISTS "StockLoanIssue_leadId_fkey",
DROP CONSTRAINT IF EXISTS "StockLoanIssue_leadId_key",
ALTER COLUMN "leadId" DROP NOT NULL,
ADD COLUMN "fineractOfficeName" TEXT,
ADD COLUMN "borrowerName" TEXT,
ADD COLUMN "loanAccountNo" TEXT,
ADD COLUMN "externalReference" TEXT,
ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN "notes" TEXT;

ALTER TABLE "StockLoanIssueLine"
ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'USD';

CREATE TABLE "StockLoanRepayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "stockLoanIssueId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currencyCode" TEXT NOT NULL DEFAULT 'USD',
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "actorUserId" TEXT NOT NULL,
  "actorUserName" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockLoanRepayment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StockLoanRepayment"
ADD CONSTRAINT "StockLoanRepayment_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockLoanRepayment"
ADD CONSTRAINT "StockLoanRepayment_stockLoanIssueId_fkey"
FOREIGN KEY ("stockLoanIssueId") REFERENCES "StockLoanIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockLoanIssue"
ADD CONSTRAINT "StockLoanIssue_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "InventoryBalance_tenantId_fineractOfficeId_inventoryItemId_key";

CREATE UNIQUE INDEX "InventoryBalance_tenantId_fineractOfficeId_inventoryItemId_currencyCode_key"
ON "InventoryBalance"("tenantId", "fineractOfficeId", "inventoryItemId", "currencyCode");

CREATE UNIQUE INDEX "StockLoanIssue_leadId_key"
ON "StockLoanIssue"("leadId");

CREATE UNIQUE INDEX "StockLoanRepayment_tenantId_idempotencyKey_key"
ON "StockLoanRepayment"("tenantId", "idempotencyKey");

CREATE INDEX "StockLoanRepayment_tenantId_paymentDate_idx"
ON "StockLoanRepayment"("tenantId", "paymentDate");

CREATE INDEX "StockLoanRepayment_stockLoanIssueId_idx"
ON "StockLoanRepayment"("stockLoanIssueId");

CREATE INDEX "StockLoanIssue_tenantId_borrowerName_idx"
ON "StockLoanIssue"("tenantId", "borrowerName");
