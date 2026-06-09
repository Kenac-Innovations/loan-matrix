-- AlterTable
ALTER TABLE "Tenant"
ADD COLUMN IF NOT EXISTS "restrictLeadVisibilityToBranches" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "onlyOriginatorCanDisburse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "autoAssignLeadOnApproval" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserLogin"
ADD COLUMN IF NOT EXISTS "canOverrideInitiatorDisbursement" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Lead"
ADD COLUMN IF NOT EXISTS "designatedDisburserUserId" INTEGER,
ADD COLUMN IF NOT EXISTS "designatedDisburserUserName" TEXT,
ADD COLUMN IF NOT EXISTS "designatedDisburserAssignedByUserId" TEXT,
ADD COLUMN IF NOT EXISTS "designatedDisburserAssignedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserLeadBranchAccess" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userLoginId" TEXT NOT NULL,
    "fineractUserId" INTEGER NOT NULL,
    "officeId" INTEGER NOT NULL,
    "officeName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLeadBranchAccess_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserLeadBranchAccess_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserLeadBranchAccess_userLoginId_fkey"
      FOREIGN KEY ("userLoginId") REFERENCES "UserLogin"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserLeadBranchAccess_tenantId_fineractUserId_officeId_key"
ON "UserLeadBranchAccess"("tenantId", "fineractUserId", "officeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserLeadBranchAccess_tenantId_fineractUserId_idx"
ON "UserLeadBranchAccess"("tenantId", "fineractUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserLeadBranchAccess_tenantId_officeId_idx"
ON "UserLeadBranchAccess"("tenantId", "officeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserLeadBranchAccess_userLoginId_idx"
ON "UserLeadBranchAccess"("userLoginId");
