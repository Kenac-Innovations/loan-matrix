-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "clientCreatedInFineract" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clientCreationDate" TIMESTAMP(3),
ADD COLUMN     "fineractAccountNo" TEXT,
ADD COLUMN     "fineractClientId" INTEGER;
