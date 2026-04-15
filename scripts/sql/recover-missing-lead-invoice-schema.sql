-- Recovery script for schema drift on environments missing:
-- - EntityStakeholder.nationalIdFineractDocumentId
-- - Lead.businessAddress
-- - Lead.facilityType
-- - invoice discounting enums/tables from April 2026 migrations
--
-- Safe to run multiple times.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'EntityStakeholder'
  ) THEN
    ALTER TABLE "EntityStakeholder"
      ADD COLUMN IF NOT EXISTS "nationalIdFineractDocumentId" TEXT;
  END IF;
END $$;

ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "businessAddress" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FacilityType') THEN
    CREATE TYPE "FacilityType" AS ENUM ('TERM_LOAN', 'INVOICE_DISCOUNTING');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceRecourseType') THEN
    CREATE TYPE "InvoiceRecourseType" AS ENUM ('WITH_RECOURSE', 'WITHOUT_RECOURSE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceDiscountingInvoiceStatus') THEN
    CREATE TYPE "InvoiceDiscountingInvoiceStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'FINANCED');
  END IF;
END $$;

ALTER TYPE "InvoiceDiscountingInvoiceStatus" ADD VALUE IF NOT EXISTS 'APPROVED';

ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "facilityType" "FacilityType" NOT NULL DEFAULT 'TERM_LOAN';

CREATE TABLE IF NOT EXISTS "InvoiceDiscountingCase" (
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

CREATE TABLE IF NOT EXISTS "InvoiceDiscountingInvoice" (
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
  "fineractDocumentId" TEXT,
  CONSTRAINT "InvoiceDiscountingInvoice_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InvoiceDiscountingInvoice"
ALTER COLUMN "status" SET DEFAULT 'APPROVED';

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceDiscountingCase_leadId_key"
  ON "InvoiceDiscountingCase"("leadId");

CREATE INDEX IF NOT EXISTS "InvoiceDiscountingCase_tenantId_idx"
  ON "InvoiceDiscountingCase"("tenantId");

CREATE INDEX IF NOT EXISTS "InvoiceDiscountingInvoice_caseId_idx"
  ON "InvoiceDiscountingInvoice"("caseId");

CREATE INDEX IF NOT EXISTS "InvoiceDiscountingInvoice_tenantId_idx"
  ON "InvoiceDiscountingInvoice"("tenantId");

CREATE INDEX IF NOT EXISTS "InvoiceDiscountingInvoice_leadId_idx"
  ON "InvoiceDiscountingInvoice"("leadId");

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceDiscountingInvoice_caseId_invoiceNumber_key"
  ON "InvoiceDiscountingInvoice"("caseId", "invoiceNumber");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InvoiceDiscountingCase_leadId_fkey'
  ) THEN
    ALTER TABLE "InvoiceDiscountingCase"
      ADD CONSTRAINT "InvoiceDiscountingCase_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InvoiceDiscountingCase_tenantId_fkey'
  ) THEN
    ALTER TABLE "InvoiceDiscountingCase"
      ADD CONSTRAINT "InvoiceDiscountingCase_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InvoiceDiscountingInvoice_caseId_fkey'
  ) THEN
    ALTER TABLE "InvoiceDiscountingInvoice"
      ADD CONSTRAINT "InvoiceDiscountingInvoice_caseId_fkey"
      FOREIGN KEY ("caseId") REFERENCES "InvoiceDiscountingCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InvoiceDiscountingInvoice_tenantId_fkey'
  ) THEN
    ALTER TABLE "InvoiceDiscountingInvoice"
      ADD CONSTRAINT "InvoiceDiscountingInvoice_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'InvoiceDiscountingInvoice_leadId_fkey'
  ) THEN
    ALTER TABLE "InvoiceDiscountingInvoice"
      ADD CONSTRAINT "InvoiceDiscountingInvoice_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
