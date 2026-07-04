-- CreateTable
CREATE TABLE "PaymentConfirmationUpload" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'LOOKED_UP',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "unmatchedCount" INTEGER NOT NULL DEFAULT 0,
    "confirmedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "columnMapping" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentConfirmationUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentConfirmationActionLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "uploadId" TEXT,
    "rowNumber" INTEGER,
    "paymentReference" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "action" TEXT NOT NULL,
    "actionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "leadId" TEXT,
    "fineractLoanId" INTEGER,
    "fineractClientId" INTEGER,
    "loanAccountNo" TEXT,
    "clientName" TEXT,
    "paymentInternalReference" TEXT,
    "paymentUserReference" TEXT,
    "paymentProviderReference" TEXT,
    "paymentStatus" TEXT,
    "paymentCallbackStatus" TEXT,
    "paymentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "paymentConfirmedAt" TIMESTAMP(3),
    "actedById" TEXT,
    "actedByName" TEXT,
    "errorMessage" TEXT,
    "rawRow" JSONB,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentConfirmationActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentConfirmationUpload_tenantId_status_idx" ON "PaymentConfirmationUpload"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PaymentConfirmationUpload_tenantId_createdAt_idx" ON "PaymentConfirmationUpload"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentConfirmationActionLog_tenantId_action_actionStatus_idx" ON "PaymentConfirmationActionLog"("tenantId", "action", "actionStatus");

-- CreateIndex
CREATE INDEX "PaymentConfirmationActionLog_tenantId_createdAt_idx" ON "PaymentConfirmationActionLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentConfirmationActionLog_uploadId_idx" ON "PaymentConfirmationActionLog"("uploadId");

-- CreateIndex
CREATE INDEX "PaymentConfirmationActionLog_paymentReference_idx" ON "PaymentConfirmationActionLog"("paymentReference");

-- CreateIndex
CREATE INDEX "PaymentConfirmationActionLog_fineractLoanId_idx" ON "PaymentConfirmationActionLog"("fineractLoanId");

-- AddForeignKey
ALTER TABLE "PaymentConfirmationUpload" ADD CONSTRAINT "PaymentConfirmationUpload_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentConfirmationActionLog" ADD CONSTRAINT "PaymentConfirmationActionLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentConfirmationActionLog" ADD CONSTRAINT "PaymentConfirmationActionLog_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "PaymentConfirmationUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
