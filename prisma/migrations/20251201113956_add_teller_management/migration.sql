-- CreateTable
CREATE TABLE "Teller" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fineractTellerId" INTEGER,
    "officeId" INTEGER NOT NULL,
    "officeName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cashier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tellerId" TEXT NOT NULL,
    "fineractCashierId" INTEGER,
    "staffId" INTEGER NOT NULL,
    "staffName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isFullDay" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT,
    "endTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cashier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tellerId" TEXT NOT NULL,
    "fineractAllocationId" INTEGER,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "allocatedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocatedBy" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSettlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tellerId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "fineractSettlementId" INTEGER,
    "settlementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingBalance" DOUBLE PRECISION NOT NULL,
    "closingBalance" DOUBLE PRECISION NOT NULL,
    "cashIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashOut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedBalance" DOUBLE PRECISION NOT NULL,
    "actualBalance" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "settledBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teller_fineractTellerId_key" ON "Teller"("fineractTellerId");

-- CreateIndex
CREATE INDEX "Teller_tenantId_officeId_idx" ON "Teller"("tenantId", "officeId");

-- CreateIndex
CREATE INDEX "Teller_tenantId_status_idx" ON "Teller"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Teller_tenantId_isActive_idx" ON "Teller"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Teller_tenantId_fineractTellerId_key" ON "Teller"("tenantId", "fineractTellerId");

-- CreateIndex
CREATE UNIQUE INDEX "Cashier_fineractCashierId_key" ON "Cashier"("fineractCashierId");

-- CreateIndex
CREATE INDEX "Cashier_tenantId_tellerId_idx" ON "Cashier"("tenantId", "tellerId");

-- CreateIndex
CREATE INDEX "Cashier_tenantId_staffId_idx" ON "Cashier"("tenantId", "staffId");

-- CreateIndex
CREATE INDEX "Cashier_tenantId_status_idx" ON "Cashier"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Cashier_tenantId_isActive_idx" ON "Cashier"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CashAllocation_fineractAllocationId_key" ON "CashAllocation"("fineractAllocationId");

-- CreateIndex
CREATE INDEX "CashAllocation_tenantId_tellerId_idx" ON "CashAllocation"("tenantId", "tellerId");

-- CreateIndex
CREATE INDEX "CashAllocation_tenantId_status_idx" ON "CashAllocation"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CashAllocation_allocatedDate_idx" ON "CashAllocation"("allocatedDate");

-- CreateIndex
CREATE UNIQUE INDEX "CashSettlement_fineractSettlementId_key" ON "CashSettlement"("fineractSettlementId");

-- CreateIndex
CREATE INDEX "CashSettlement_tenantId_tellerId_idx" ON "CashSettlement"("tenantId", "tellerId");

-- CreateIndex
CREATE INDEX "CashSettlement_tenantId_cashierId_idx" ON "CashSettlement"("tenantId", "cashierId");

-- CreateIndex
CREATE INDEX "CashSettlement_tenantId_settlementDate_idx" ON "CashSettlement"("tenantId", "settlementDate");

-- CreateIndex
CREATE INDEX "CashSettlement_tenantId_status_idx" ON "CashSettlement"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "Cashier" ADD CONSTRAINT "Cashier_tellerId_fkey" FOREIGN KEY ("tellerId") REFERENCES "Teller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashAllocation" ADD CONSTRAINT "CashAllocation_tellerId_fkey" FOREIGN KEY ("tellerId") REFERENCES "Teller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSettlement" ADD CONSTRAINT "CashSettlement_tellerId_fkey" FOREIGN KEY ("tellerId") REFERENCES "Teller"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSettlement" ADD CONSTRAINT "CashSettlement_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "Cashier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
