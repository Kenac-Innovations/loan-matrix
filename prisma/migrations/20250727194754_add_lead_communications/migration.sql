-- CreateTable
CREATE TABLE "LeadCommunication" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "fromEmail" TEXT,
    "toEmail" TEXT,
    "fromPhone" TEXT,
    "toPhone" TEXT,
    "provider" TEXT,
    "providerId" TEXT,
    "metadata" JSONB,
    "attachments" JSONB,
    "createdBy" TEXT NOT NULL,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadCommunication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "variables" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadCommunication_leadId_idx" ON "LeadCommunication"("leadId");

-- CreateIndex
CREATE INDEX "LeadCommunication_tenantId_idx" ON "LeadCommunication"("tenantId");

-- CreateIndex
CREATE INDEX "LeadCommunication_type_idx" ON "LeadCommunication"("type");

-- CreateIndex
CREATE INDEX "LeadCommunication_direction_idx" ON "LeadCommunication"("direction");

-- CreateIndex
CREATE INDEX "LeadCommunication_status_idx" ON "LeadCommunication"("status");

-- CreateIndex
CREATE INDEX "LeadCommunication_createdAt_idx" ON "LeadCommunication"("createdAt");

-- CreateIndex
CREATE INDEX "LeadCommunication_scheduledAt_idx" ON "LeadCommunication"("scheduledAt");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_tenantId_idx" ON "CommunicationTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_type_idx" ON "CommunicationTemplate"("type");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_category_idx" ON "CommunicationTemplate"("category");

-- CreateIndex
CREATE INDEX "CommunicationTemplate_isActive_idx" ON "CommunicationTemplate"("isActive");

-- AddForeignKey
ALTER TABLE "LeadCommunication" ADD CONSTRAINT "LeadCommunication_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCommunication" ADD CONSTRAINT "LeadCommunication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationTemplate" ADD CONSTRAINT "CommunicationTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
