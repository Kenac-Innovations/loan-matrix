ALTER TABLE "ChargeProduct"
ADD COLUMN "isInvoiceDiscountIncome" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ChargeProduct_tenantId_isInvoiceDiscountIncome_idx"
ON "ChargeProduct"("tenantId", "isInvoiceDiscountIncome");

CREATE UNIQUE INDEX "ChargeProduct_invoice_discount_income_per_tenant_idx"
ON "ChargeProduct"("tenantId")
WHERE "isInvoiceDiscountIncome" = true;
