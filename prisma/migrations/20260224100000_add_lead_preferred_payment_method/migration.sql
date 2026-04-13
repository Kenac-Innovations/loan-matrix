-- AlterTable
ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "preferredPaymentMethod" TEXT;
