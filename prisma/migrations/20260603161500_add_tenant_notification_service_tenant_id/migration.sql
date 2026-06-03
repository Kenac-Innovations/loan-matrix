-- AlterTable
ALTER TABLE "Tenant"
ADD COLUMN IF NOT EXISTS "notificationServiceTenantId" TEXT;
