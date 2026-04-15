ALTER TABLE "InvoiceDiscountingCase"
ALTER COLUMN "totalEligibleAmount" DROP NOT NULL,
ALTER COLUMN "totalEligibleAmount" DROP DEFAULT;

ALTER TABLE "InvoiceDiscountingInvoice"
ALTER COLUMN "eligibleAmount" DROP NOT NULL;
