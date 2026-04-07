-- Add optional reference to the uploaded client document in Fineract.
ALTER TABLE "InvoiceDiscountingInvoice"
ADD COLUMN IF NOT EXISTS "fineractDocumentId" TEXT;

-- Default all new invoice rows to APPROVED for now.
ALTER TABLE "InvoiceDiscountingInvoice"
ALTER COLUMN "status" SET DEFAULT 'APPROVED';
