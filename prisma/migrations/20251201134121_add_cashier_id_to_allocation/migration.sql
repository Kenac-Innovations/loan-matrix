-- AlterTable
ALTER TABLE "CashAllocation" ADD COLUMN     "cashierId" TEXT;

-- CreateIndex
CREATE INDEX "CashAllocation_tenantId_cashierId_idx" ON "CashAllocation"("tenantId", "cashierId");

-- AddForeignKey
ALTER TABLE "CashAllocation" ADD CONSTRAINT "CashAllocation_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "Cashier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
