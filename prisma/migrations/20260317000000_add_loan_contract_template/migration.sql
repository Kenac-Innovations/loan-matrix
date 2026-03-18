-- CreateTable
CREATE TABLE "LoanContractTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanContractTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoanContractTemplate_tenantId_slug_key" ON "LoanContractTemplate"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "LoanContractTemplate_tenantId_idx" ON "LoanContractTemplate"("tenantId");

-- AddForeignKey
ALTER TABLE "LoanContractTemplate" ADD CONSTRAINT "LoanContractTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
