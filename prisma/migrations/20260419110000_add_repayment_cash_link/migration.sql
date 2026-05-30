-- CreateTable
CREATE TABLE "RepaymentCashLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fineractTransactionId" INTEGER NOT NULL,
    "loanId" INTEGER NOT NULL,
    "transactionType" TEXT NOT NULL DEFAULT 'REPAYMENT',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZMW',
    "tellerId" TEXT,
    "cashierId" TEXT,
    "fineractAllocationId" INTEGER,
    "isCash" BOOLEAN NOT NULL DEFAULT false,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepaymentCashLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RepaymentCashLink_tenantId_fineractTransactionId_key" ON "RepaymentCashLink"("tenantId", "fineractTransactionId");

-- CreateIndex
CREATE INDEX "RepaymentCashLink_tenantId_loanId_idx" ON "RepaymentCashLink"("tenantId", "loanId");

-- CreateIndex
CREATE INDEX "RepaymentCashLink_tenantId_tellerId_idx" ON "RepaymentCashLink"("tenantId", "tellerId");

-- CreateIndex
CREATE INDEX "RepaymentCashLink_tenantId_cashierId_idx" ON "RepaymentCashLink"("tenantId", "cashierId");

-- CreateIndex
CREATE INDEX "RepaymentCashLink_tenantId_transactionType_idx" ON "RepaymentCashLink"("tenantId", "transactionType");

-- CreateIndex
CREATE INDEX "RepaymentCashLink_tenantId_isCash_idx" ON "RepaymentCashLink"("tenantId", "isCash");

-- CreateIndex
CREATE INDEX "RepaymentCashLink_tenantId_fineractAllocationId_idx" ON "RepaymentCashLink"("tenantId", "fineractAllocationId");

-- AddForeignKey
ALTER TABLE "RepaymentCashLink" ADD CONSTRAINT "RepaymentCashLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepaymentCashLink" ADD CONSTRAINT "RepaymentCashLink_tellerId_fkey" FOREIGN KEY ("tellerId") REFERENCES "Teller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepaymentCashLink" ADD CONSTRAINT "RepaymentCashLink_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "Cashier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
