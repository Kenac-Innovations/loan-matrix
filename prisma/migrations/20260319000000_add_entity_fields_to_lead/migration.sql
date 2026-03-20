-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "fullname" TEXT,
ADD COLUMN "tradingName" TEXT,
ADD COLUMN "registrationNumber" TEXT,
ADD COLUMN "dateOfIncorporation" TIMESTAMP(3),
ADD COLUMN "natureOfBusiness" TEXT;
