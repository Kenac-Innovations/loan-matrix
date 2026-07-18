-- Loan Matrix: enable tenant-specific routing to the USSD service.
-- Review before running against any live database.

ALTER TABLE "Tenant"
ADD COLUMN IF NOT EXISTS "ussdServiceTenantId" TEXT;

-- Seed the existing Goodfellow tenant to call the matching USSD tenant_code.
-- If the tenant slug differs in a target database, update the WHERE clause first.
UPDATE "Tenant"
SET
    "ussdServiceTenantId" = 'goodfellow',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'goodfellow'
  AND ("ussdServiceTenantId" IS DISTINCT FROM 'goodfellow');

-- Review configured tenants after applying.
SELECT "id", "name", "slug", "ussdServiceTenantId"
FROM "Tenant"
ORDER BY "slug";
