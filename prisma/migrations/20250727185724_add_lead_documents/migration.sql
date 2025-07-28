-- DropForeignKey
ALTER TABLE "LeadDocument" DROP CONSTRAINT "LeadDocument_leadId_fkey";

-- DropForeignKey
ALTER TABLE "LeadDocument" DROP CONSTRAINT "LeadDocument_tenantId_fkey";

-- AddForeignKey
ALTER TABLE "LeadDocument" ADD CONSTRAINT "LeadDocument_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadDocument" ADD CONSTRAINT "LeadDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
