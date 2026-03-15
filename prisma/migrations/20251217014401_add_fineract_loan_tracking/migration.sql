-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "fineractLoanId" INTEGER,
ADD COLUMN     "loanSubmissionDate" TIMESTAMP(3),
ADD COLUMN     "loanSubmittedToFineract" BOOLEAN NOT NULL DEFAULT false;
