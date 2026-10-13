-- AlterTable
ALTER TABLE "StockLoanIssue" ADD COLUMN     "reservationGeneration" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StockActionOperation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "loanId" INTEGER NOT NULL,
    "command" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARED',
    "requestSnapshot" JSONB NOT NULL,
    "result" JSONB,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockActionOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockActionOperation_tenantId_leadId_status_idx" ON "StockActionOperation"("tenantId", "leadId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StockActionOperation_tenantId_operationKey_key" ON "StockActionOperation"("tenantId", "operationKey");

