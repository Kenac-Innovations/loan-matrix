-- AlterTable
ALTER TABLE "UserLogin"
ADD COLUMN IF NOT EXISTS "countryCode" TEXT;
