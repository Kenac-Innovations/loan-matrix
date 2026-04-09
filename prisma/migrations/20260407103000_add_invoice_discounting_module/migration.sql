-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('TERM_LOAN', 'INVOICE_DISCOUNTING');

-- CreateEnum
CREATE TYPE "InvoiceRecourseType" AS ENUM ('WITH_RECOURSE', 'WITHOUT_RECOURSE');

-- CreateEnum
CREATE TYPE "InvoiceDiscountingInvoiceStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'FINANCED');

-- AlterTable
ALTER TABLE "Lead"
ADD COLUMN "facilityType" "FacilityType" NOT NULL DEFAULT 'TERM_LOAN';

-- CreateTable
CREATE TABLE "InvoiceDiscountingCase" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "debtorName" TEXT NOT NULL,
    "debtorRegistrationNumber" TEXT,
    "debtorTaxId" TEXT,
    "debtorContactName" TEXT,
    "debtorContactPhone" TEXT,
    "debtorContactEmail" TEXT,
    "recourseType" "InvoiceRecourseType" NOT NULL DEFAULT 'WITH_RECOURSE',
    "advanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "concentrationLimit" DOUBLE PRECISION,
    "debtorTermsDays" INTEGER,
    "reservePercent" DOUBLE PRECISION DEFAULT 0,
    "notes" TEXT,
    "totalPresentedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEligibleAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFinancedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReserveAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceDiscountingCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceDiscountingInvoice" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "eligibleAmount" DOUBLE PRECISION NOT NULL,
    "financedAmount" DOUBLE PRECISION NOT NULL,
    "reserveAmount" DOUBLE PRECISION NOT NULL,
    "currencyCode" TEXT,
    "status" "InvoiceDiscountingInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceDiscountingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceDiscountingCase_leadId_key" ON "InvoiceDiscountingCase"("leadId");

-- CreateIndex
CREATE INDEX "InvoiceDiscountingCase_tenantId_idx" ON "InvoiceDiscountingCase"("tenantId");

-- CreateIndex
CREATE INDEX "InvoiceDiscountingInvoice_caseId_idx" ON "InvoiceDiscountingInvoice"("caseId");

-- CreateIndex
CREATE INDEX "InvoiceDiscountingInvoice_tenantId_idx" ON "InvoiceDiscountingInvoice"("tenantId");

-- CreateIndex
CREATE INDEX "InvoiceDiscountingInvoice_leadId_idx" ON "InvoiceDiscountingInvoice"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceDiscountingInvoice_caseId_invoiceNumber_key" ON "InvoiceDiscountingInvoice"("caseId", "invoiceNumber");

-- AddForeignKey
ALTER TABLE "InvoiceDiscountingCase"
ADD CONSTRAINT "InvoiceDiscountingCase_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDiscountingCase"
ADD CONSTRAINT "InvoiceDiscountingCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDiscountingInvoice"
ADD CONSTRAINT "InvoiceDiscountingInvoice_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "InvoiceDiscountingCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDiscountingInvoice"
ADD CONSTRAINT "InvoiceDiscountingInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceDiscountingInvoice"
ADD CONSTRAINT "InvoiceDiscountingInvoice_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
