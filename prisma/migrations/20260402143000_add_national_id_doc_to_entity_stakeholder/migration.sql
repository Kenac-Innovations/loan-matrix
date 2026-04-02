-- Add National ID document reference for entity stakeholders
ALTER TABLE "EntityStakeholder"
ADD COLUMN "nationalIdFineractDocumentId" TEXT;
