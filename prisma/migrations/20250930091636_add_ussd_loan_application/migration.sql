-- CreateTable
CREATE TABLE "UssdLoanApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "loanApplicationUssdId" INTEGER NOT NULL,
    "messageId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "userPhoneNumber" TEXT NOT NULL,
    "loanMatrixClientId" INTEGER,
    "userFullName" TEXT NOT NULL,
    "userNationalId" TEXT NOT NULL,
    "loanMatrixLoanProductId" INTEGER NOT NULL,
    "loanProductName" TEXT NOT NULL,
    "loanProductDisplayName" TEXT NOT NULL,
    "principalAmount" DOUBLE PRECISION NOT NULL,
    "loanTermMonths" INTEGER NOT NULL,
    "payoutMethod" TEXT NOT NULL,
    "mobileMoneyNumber" TEXT,
    "mobileMoneyProvider" TEXT,
    "branchName" TEXT,
    "officeLocationId" INTEGER,
    "bankAccountNumber" TEXT,
    "bankName" TEXT,
    "bankBranch" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "source" TEXT NOT NULL DEFAULT 'USSD',
    "channel" TEXT NOT NULL DEFAULT 'USSD_LOAN_APPLICATION',
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processingNotes" TEXT,
    "rejectionReason" TEXT,
    "approvalNotes" TEXT,
    "paymentStatus" TEXT,
    "loanMatrixPaymentMethodId" INTEGER,

    CONSTRAINT "UssdLoanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UssdLoanApplication_loanApplicationUssdId_key" ON "UssdLoanApplication"("loanApplicationUssdId");

-- CreateIndex
CREATE UNIQUE INDEX "UssdLoanApplication_messageId_key" ON "UssdLoanApplication"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "UssdLoanApplication_referenceNumber_key" ON "UssdLoanApplication"("referenceNumber");

-- CreateIndex
CREATE INDEX "UssdLoanApplication_tenantId_status_idx" ON "UssdLoanApplication"("tenantId", "status");

-- CreateIndex
CREATE INDEX "UssdLoanApplication_tenantId_createdAt_idx" ON "UssdLoanApplication"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "UssdLoanApplication_messageId_idx" ON "UssdLoanApplication"("messageId");

-- CreateIndex
CREATE INDEX "UssdLoanApplication_referenceNumber_idx" ON "UssdLoanApplication"("referenceNumber");

-- CreateIndex
CREATE INDEX "UssdLoanApplication_userPhoneNumber_idx" ON "UssdLoanApplication"("userPhoneNumber");

-- CreateIndex
CREATE INDEX "UssdLoanApplication_status_createdAt_idx" ON "UssdLoanApplication"("status", "createdAt");
