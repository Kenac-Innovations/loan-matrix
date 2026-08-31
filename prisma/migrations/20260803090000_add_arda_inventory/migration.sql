-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIPT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RESERVATION', 'RESERVATION_RELEASE', 'ISSUE', 'RETURN', 'ISSUE_REVERSAL', 'TRANSFER_OUT', 'TRANSFER_IN');

-- CreateEnum
CREATE TYPE "StockLoanIssueStatus" AS ENUM ('DRAFT', 'RESERVED', 'PROCESSING', 'ISSUED', 'FAILED', 'RETURNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unitOfMeasure" TEXT NOT NULL,
    "defaultUnitValue" DECIMAL(18,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBalance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fineractOfficeId" INTEGER NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantityOnHand" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "quantityReserved" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "stockValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLoanIssue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fineractLoanId" INTEGER,
    "fineractOfficeId" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "StockLoanIssueStatus" NOT NULL DEFAULT 'DRAFT',
    "totalValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3),
    "issuedByUserId" TEXT,
    "issuedByUserName" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLoanIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLoanIssueLine" (
    "id" TEXT NOT NULL,
    "stockLoanIssueId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "issuedQuantity" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "unitValue" DECIMAL(18,2) NOT NULL,
    "lineValue" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLoanIssueLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "fineractOfficeId" INTEGER NOT NULL,
    "stockLoanIssueId" TEXT,
    "fineractLoanId" INTEGER,
    "type" "InventoryMovementType" NOT NULL,
    "quantityDelta" DECIMAL(18,3) NOT NULL,
    "valueDelta" DECIMAL(18,2) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorUserName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryItem_tenantId_isActive_idx" ON "InventoryItem"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_tenantId_sku_key" ON "InventoryItem"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "InventoryBalance_tenantId_fineractOfficeId_idx" ON "InventoryBalance"("tenantId", "fineractOfficeId");

-- CreateIndex
CREATE INDEX "InventoryBalance_inventoryItemId_idx" ON "InventoryBalance"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBalance_tenantId_fineractOfficeId_inventoryItemId_key" ON "InventoryBalance"("tenantId", "fineractOfficeId", "inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLoanIssue_leadId_key" ON "StockLoanIssue"("leadId");

-- CreateIndex
CREATE INDEX "StockLoanIssue_tenantId_fineractOfficeId_status_idx" ON "StockLoanIssue"("tenantId", "fineractOfficeId", "status");

-- CreateIndex
CREATE INDEX "StockLoanIssue_tenantId_fineractLoanId_idx" ON "StockLoanIssue"("tenantId", "fineractLoanId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLoanIssue_tenantId_reference_key" ON "StockLoanIssue"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "StockLoanIssueLine_inventoryItemId_idx" ON "StockLoanIssueLine"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "StockLoanIssueLine_stockLoanIssueId_inventoryItemId_key" ON "StockLoanIssueLine"("stockLoanIssueId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "InventoryMovement_tenantId_fineractOfficeId_createdAt_idx" ON "InventoryMovement"("tenantId", "fineractOfficeId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryItemId_createdAt_idx" ON "InventoryMovement"("inventoryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_stockLoanIssueId_idx" ON "InventoryMovement"("stockLoanIssueId");

-- CreateIndex
CREATE INDEX "InventoryMovement_tenantId_fineractLoanId_idx" ON "InventoryMovement"("tenantId", "fineractLoanId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_tenantId_idempotencyKey_key" ON "InventoryMovement"("tenantId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLoanIssue" ADD CONSTRAINT "StockLoanIssue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLoanIssue" ADD CONSTRAINT "StockLoanIssue_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLoanIssueLine" ADD CONSTRAINT "StockLoanIssueLine_stockLoanIssueId_fkey" FOREIGN KEY ("stockLoanIssueId") REFERENCES "StockLoanIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLoanIssueLine" ADD CONSTRAINT "StockLoanIssueLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_stockLoanIssueId_fkey" FOREIGN KEY ("stockLoanIssueId") REFERENCES "StockLoanIssue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
