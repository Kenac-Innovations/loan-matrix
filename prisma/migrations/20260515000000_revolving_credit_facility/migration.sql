-- CreateEnum
CREATE TYPE "RevolvingCreditDrawdownStatus" AS ENUM ('REQUESTED', 'APPROVED', 'DISBURSED', 'REJECTED');

-- AlterEnum: Add REVOLVING_CREDIT to FacilityType
ALTER TYPE "FacilityType" ADD VALUE 'REVOLVING_CREDIT';

-- AlterTable: Add fineractSavingsAccountId to Lead
ALTER TABLE "Lead" ADD COLUMN "fineractSavingsAccountId" INTEGER;

-- CreateTable: RevolvingCreditFacility
CREATE TABLE "RevolvingCreditFacility" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "creditLimit" DOUBLE PRECISION NOT NULL,
    "availableBalance" DOUBLE PRECISION NOT NULL,
    "fineractSavingsAccountId" INTEGER NOT NULL,
    "fineractSavingsAccountNo" TEXT,
    "savingsProductId" INTEGER NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevolvingCreditFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RevolvingCreditDrawdown
CREATE TABLE "RevolvingCreditDrawdown" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedAmount" DOUBLE PRECISION NOT NULL,
    "approvedAmount" DOUBLE PRECISION,
    "disbursedAmount" DOUBLE PRECISION,
    "status" "RevolvingCreditDrawdownStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedByUserId" TEXT NOT NULL,
    "requestedByUserName" TEXT,
    "approvedByUserId" TEXT,
    "approvedByUserName" TEXT,
    "disbursedByUserId" TEXT,
    "note" TEXT,
    "fineractTransactionId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "disbursedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevolvingCreditDrawdown_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RevolvingCreditRepayment
CREATE TABLE "RevolvingCreditRepayment" (
    "id" TEXT NOT NULL,
    "drawdownId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "recordedByUserName" TEXT,
    "fineractTransactionId" TEXT,
    "note" TEXT,
    "repaidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevolvingCreditRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RevolvingCreditFacility_leadId_key" ON "RevolvingCreditFacility"("leadId");
CREATE INDEX "RevolvingCreditFacility_tenantId_idx" ON "RevolvingCreditFacility"("tenantId");
CREATE INDEX "RevolvingCreditDrawdown_facilityId_idx" ON "RevolvingCreditDrawdown"("facilityId");
CREATE INDEX "RevolvingCreditDrawdown_tenantId_idx" ON "RevolvingCreditDrawdown"("tenantId");
CREATE INDEX "RevolvingCreditRepayment_facilityId_idx" ON "RevolvingCreditRepayment"("facilityId");
CREATE INDEX "RevolvingCreditRepayment_drawdownId_idx" ON "RevolvingCreditRepayment"("drawdownId");

-- AddForeignKey
ALTER TABLE "RevolvingCreditFacility" ADD CONSTRAINT "RevolvingCreditFacility_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RevolvingCreditFacility" ADD CONSTRAINT "RevolvingCreditFacility_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RevolvingCreditDrawdown" ADD CONSTRAINT "RevolvingCreditDrawdown_facilityId_fkey"
  FOREIGN KEY ("facilityId") REFERENCES "RevolvingCreditFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RevolvingCreditRepayment" ADD CONSTRAINT "RevolvingCreditRepayment_drawdownId_fkey"
  FOREIGN KEY ("drawdownId") REFERENCES "RevolvingCreditDrawdown"("id") ON DELETE CASCADE ON UPDATE CASCADE;
