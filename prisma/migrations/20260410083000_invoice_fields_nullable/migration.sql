-- Make removed invoice capture fields nullable and drop defaults.
ALTER TABLE "InvoiceDiscountingCase"
  ALTER COLUMN "recourseType" DROP NOT NULL,
  ALTER COLUMN "recourseType" DROP DEFAULT,
  ALTER COLUMN "concentrationLimit" DROP DEFAULT,
  ALTER COLUMN "reservePercent" DROP DEFAULT;
