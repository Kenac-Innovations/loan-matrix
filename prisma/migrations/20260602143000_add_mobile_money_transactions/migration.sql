-- CreateEnum
CREATE TYPE "MobileMoneyTransactionType" AS ENUM (
    'OPENING_BALANCE',
    'TOP_UP',
    'TOP_UP_REVERSAL',
    'PAYOUT',
    'PAYOUT_REVERSAL'
);

-- CreateEnum
CREATE TYPE "MobileMoneyTransactionStatus" AS ENUM ('ACTIVE', 'REVERSED');

-- CreateTable
CREATE TABLE "MobileMoneyTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "loanPayoutId" TEXT,
    "type" "MobileMoneyTransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" "MobileMoneyTransactionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "reversalOfId" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "reversalReason" TEXT,
    "fineractJournalEntryId" TEXT,
    "fineractLoanId" INTEGER,
    "fineractClientId" INTEGER,
    "clientName" TEXT,
    "loanAccountNo" TEXT,
    "sourceGlAccountId" INTEGER,
    "sourceGlAccountName" TEXT,
    "sourceGlAccountCode" TEXT,
    "mobileMoneyGlAccountId" INTEGER,
    "mobileMoneyGlAccountName" TEXT,
    "mobileMoneyGlAccountCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileMoneyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MobileMoneyTransaction_tenantId_transactionDate_idx"
ON "MobileMoneyTransaction"("tenantId", "transactionDate");

-- CreateIndex
CREATE INDEX "MobileMoneyTransaction_tenantId_type_idx"
ON "MobileMoneyTransaction"("tenantId", "type");

-- CreateIndex
CREATE INDEX "MobileMoneyTransaction_tenantId_status_idx"
ON "MobileMoneyTransaction"("tenantId", "status");

-- CreateIndex
CREATE INDEX "MobileMoneyTransaction_loanPayoutId_idx"
ON "MobileMoneyTransaction"("loanPayoutId");

-- CreateIndex
CREATE INDEX "MobileMoneyTransaction_fineractLoanId_idx"
ON "MobileMoneyTransaction"("fineractLoanId");

-- AddForeignKey
ALTER TABLE "MobileMoneyTransaction"
ADD CONSTRAINT "MobileMoneyTransaction_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileMoneyTransaction"
ADD CONSTRAINT "MobileMoneyTransaction_loanPayoutId_fkey"
FOREIGN KEY ("loanPayoutId") REFERENCES "LoanPayout"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileMoneyTransaction"
ADD CONSTRAINT "MobileMoneyTransaction_reversalOfId_fkey"
FOREIGN KEY ("reversalOfId") REFERENCES "MobileMoneyTransaction"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
