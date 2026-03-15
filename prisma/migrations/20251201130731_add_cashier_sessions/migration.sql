-- CreateTable
CREATE TABLE "CashierSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tellerId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "fineractSessionId" INTEGER,
    "sessionStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "sessionStartTime" TIMESTAMP(3),
    "sessionEndTime" TIMESTAMP(3),
    "allocatedBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availableBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openingFloat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashOut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingBalance" DOUBLE PRECISION,
    "expectedBalance" DOUBLE PRECISION,
    "difference" DOUBLE PRECISION,
    "countedCashAmount" DOUBLE PRECISION,
    "comments" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashierSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashierSession_fineractSessionId_key" ON "CashierSession"("fineractSessionId");

-- CreateIndex
CREATE INDEX "CashierSession_tenantId_tellerId_idx" ON "CashierSession"("tenantId", "tellerId");

-- CreateIndex
CREATE INDEX "CashierSession_tenantId_cashierId_idx" ON "CashierSession"("tenantId", "cashierId");

-- CreateIndex
CREATE INDEX "CashierSession_tenantId_sessionStatus_idx" ON "CashierSession"("tenantId", "sessionStatus");

-- CreateIndex
CREATE INDEX "CashierSession_sessionStartTime_idx" ON "CashierSession"("sessionStartTime");

-- AddForeignKey
ALTER TABLE "CashierSession" ADD CONSTRAINT "CashierSession_tellerId_fkey" FOREIGN KEY ("tellerId") REFERENCES "Teller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierSession" ADD CONSTRAINT "CashierSession_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "Cashier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
