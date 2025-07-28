-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "businessOwnership" BOOLEAN DEFAULT false,
ADD COLUMN     "businessType" TEXT,
ADD COLUMN     "hasExistingLoans" BOOLEAN DEFAULT false,
ADD COLUMN     "monthlyDebtPayments" DOUBLE PRECISION,
ADD COLUMN     "monthlyIncomeRange" TEXT,
ADD COLUMN     "propertyOwnership" TEXT,
ADD COLUMN     "yearsAtCurrentJob" TEXT;
