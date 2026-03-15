-- AlterTable
ALTER TABLE "CashSettlement" ADD COLUMN     "reconciledAt" TIMESTAMP(3),
ADD COLUMN     "reconciledBy" TEXT,
ADD COLUMN     "reconciliationNotes" TEXT,
ADD COLUMN     "returnedAmount" DOUBLE PRECISION;
