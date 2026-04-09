-- Add APPROVED status to invoice discounting enum.
ALTER TYPE "InvoiceDiscountingInvoiceStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
