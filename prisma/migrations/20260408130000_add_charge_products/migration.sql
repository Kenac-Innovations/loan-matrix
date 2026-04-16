-- Create enums for charge product storage
CREATE TYPE "ChargeProductType" AS ENUM ('LOAN', 'SAVINGS', 'CLIENT', 'SHARES');

CREATE TYPE "ChargeProductTimeType" AS ENUM (
  'DISBURSEMENT',
  'SPECIFIED_DUE_DATE',
  'SAVINGS_ACTIVATION',
  'SAVINGS_CLOSURE',
  'WITHDRAWAL_FEE',
  'ANNUAL_FEE',
  'MONTHLY_FEE',
  'INSTALMENT_FEE',
  'OVERDUE_INSTALLMENT',
  'OVERDRAFT_FEE',
  'WEEKLY_FEE',
  'TRANCHE_DISBURSEMENT',
  'SHAREACCOUNT_ACTIVATION',
  'SHARE_PURCHASE',
  'SHARE_REDEEM',
  'SAVINGS_NOACTIVITY_FEE'
);

CREATE TYPE "ChargeProductCalculationType" AS ENUM (
  'FLAT',
  'PERCENT_OF_AMOUNT',
  'PERCENT_OF_AMOUNT_AND_INTEREST',
  'PERCENT_OF_INTEREST',
  'PERCENT_OF_DISBURSEMENT_AMOUNT'
);

CREATE TYPE "ChargeProductPaymentMode" AS ENUM ('REGULAR', 'ACCOUNT_TRANSFER');

CREATE TYPE "ChargeProductSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- CreateTable
CREATE TABLE "ChargeProduct" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amount" DECIMAL(18,6) NOT NULL,
  "currencyCode" TEXT NOT NULL,
  "type" "ChargeProductType" NOT NULL,
  "chargeTimeType" "ChargeProductTimeType" NOT NULL,
  "chargeCalculationType" "ChargeProductCalculationType" NOT NULL DEFAULT 'FLAT',
  "chargePaymentMode" "ChargeProductPaymentMode" NOT NULL DEFAULT 'REGULAR',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "fineractChargeId" INTEGER,
  "fineractChargeTimeType" "ChargeProductTimeType",
  "fineractChargeCalculationType" "ChargeProductCalculationType",
  "fineractAmount" DECIMAL(18,6),
  "syncStatus" "ChargeProductSyncStatus" NOT NULL DEFAULT 'PENDING',
  "syncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChargeProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChargeProduct_tenantId_createdAt_idx" ON "ChargeProduct"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ChargeProduct_tenantId_syncStatus_idx" ON "ChargeProduct"("tenantId", "syncStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ChargeProduct_tenantId_fineractChargeId_key" ON "ChargeProduct"("tenantId", "fineractChargeId");

-- AddForeignKey
ALTER TABLE "ChargeProduct" ADD CONSTRAINT "ChargeProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
