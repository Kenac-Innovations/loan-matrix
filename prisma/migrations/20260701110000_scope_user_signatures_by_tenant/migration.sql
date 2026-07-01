-- Add tenant ownership before replacing the old global fineractUserId key.
ALTER TABLE "UserSignature" ADD COLUMN "tenantId" TEXT;

DO $$
DECLARE
    backfill_tenant_id TEXT;
    tenant_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM "UserSignature" WHERE "tenantId" IS NULL) THEN
        SELECT COUNT(*) INTO tenant_count FROM "Tenant";

        IF tenant_count = 1 THEN
            SELECT "id" INTO backfill_tenant_id FROM "Tenant" LIMIT 1;
        ELSE
            SELECT "id" INTO backfill_tenant_id
            FROM "Tenant"
            WHERE "slug" = current_setting('loan_matrix.user_signature_backfill_tenant_slug', true)
            LIMIT 1;
        END IF;

        IF backfill_tenant_id IS NULL THEN
            RAISE EXCEPTION 'UserSignature tenant backfill requires exactly one tenant or SET loan_matrix.user_signature_backfill_tenant_slug before running this migration';
        END IF;

        UPDATE "UserSignature"
        SET "tenantId" = backfill_tenant_id
        WHERE "tenantId" IS NULL;
    END IF;
END $$;

ALTER TABLE "UserSignature" ALTER COLUMN "tenantId" SET NOT NULL;

DROP INDEX "UserSignature_fineractUserId_key";
DROP INDEX "UserSignature_fineractUserId_idx";

CREATE UNIQUE INDEX "UserSignature_tenantId_fineractUserId_key" ON "UserSignature"("tenantId", "fineractUserId");
CREATE INDEX "UserSignature_tenantId_fineractUserId_idx" ON "UserSignature"("tenantId", "fineractUserId");

ALTER TABLE "UserSignature"
ADD CONSTRAINT "UserSignature_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
