-- CreateEnum
CREATE TYPE "EntityStakeholderRole" AS ENUM ('DIRECTOR', 'SHAREHOLDER');

-- CreateTable
CREATE TABLE "EntityStakeholder" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "role" "EntityStakeholderRole" NOT NULL,
    "fullName" TEXT NOT NULL,
    "nationalIdOrPassport" TEXT NOT NULL,
    "residentialAddress" TEXT NOT NULL,
    "proofOfResidenceLeadDocumentId" TEXT,
    "pepStatusCodeValueId" INTEGER,
    "pepStatusLabel" TEXT,
    "shareholdingPercentage" DECIMAL(5,2),
    "isUltimateBeneficialOwner" BOOLEAN NOT NULL DEFAULT false,
    "controlStructureCodeValueId" INTEGER,
    "controlStructureLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityStakeholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityBankAccount" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountSignatories" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntityBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntityStakeholder_leadId_idx" ON "EntityStakeholder"("leadId");

-- CreateIndex
CREATE INDEX "EntityStakeholder_leadId_role_idx" ON "EntityStakeholder"("leadId", "role");

-- CreateIndex
CREATE INDEX "EntityBankAccount_leadId_idx" ON "EntityBankAccount"("leadId");

-- AddForeignKey
ALTER TABLE "EntityStakeholder" ADD CONSTRAINT "EntityStakeholder_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityStakeholder" ADD CONSTRAINT "EntityStakeholder_proofOfResidenceLeadDocumentId_fkey" FOREIGN KEY ("proofOfResidenceLeadDocumentId") REFERENCES "LeadDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityBankAccount" ADD CONSTRAINT "EntityBankAccount_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
