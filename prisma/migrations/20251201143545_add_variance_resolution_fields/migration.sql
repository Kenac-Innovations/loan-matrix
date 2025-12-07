-- AlterTable
ALTER TABLE "CashSettlement" ADD COLUMN     "varianceResolutionNotes" TEXT,
ADD COLUMN     "varianceResolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "varianceResolvedAt" TIMESTAMP(3),
ADD COLUMN     "varianceResolvedBy" TEXT;
