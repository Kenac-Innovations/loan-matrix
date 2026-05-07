-- Tenant-scoped lookup for invoice discounting charges managed directly in Fineract.
CREATE TABLE "InvoiceDiscountingCharge" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "chargeName" TEXT NOT NULL,
  "fineractChargeId" INTEGER NOT NULL,
  "currencyCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InvoiceDiscountingCharge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceDiscountingCharge_tenantId_fineractChargeId_key"
ON "InvoiceDiscountingCharge"("tenantId", "fineractChargeId");

CREATE UNIQUE INDEX "InvoiceDiscountingCharge_tenantId_currencyCode_key"
ON "InvoiceDiscountingCharge"("tenantId", "currencyCode");

CREATE INDEX "InvoiceDiscountingCharge_tenantId_idx"
ON "InvoiceDiscountingCharge"("tenantId");

ALTER TABLE "InvoiceDiscountingCharge"
ADD CONSTRAINT "InvoiceDiscountingCharge_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
