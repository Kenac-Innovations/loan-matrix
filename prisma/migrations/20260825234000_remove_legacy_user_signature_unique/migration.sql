-- Some established installations created this as a table constraint rather than
-- Prisma's original standalone unique index. Remove either legacy form so the
-- tenant-scoped uniqueness from the preceding migration is authoritative.
ALTER TABLE "UserSignature"
DROP CONSTRAINT IF EXISTS "UserSignature_fineractUserId_key";

DROP INDEX IF EXISTS "UserSignature_fineractUserId_key";
DROP INDEX IF EXISTS "UserSignature_fineractUserId_idx";
