-- CreateTable
CREATE TABLE "FineractDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fineractId" TEXT,
    "metadata" JSONB,
    "embedding" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FineractDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FineractDataCache" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "entityId" TEXT,
    "data" JSONB NOT NULL,
    "embedding" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FineractDataCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "fineractData" JSONB,
    "sources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userQuery" TEXT NOT NULL,
    "fineractDataUsed" JSONB,
    "response" TEXT NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FineractDocument_documentType_idx" ON "FineractDocument"("documentType");

-- CreateIndex
CREATE INDEX "FineractDocument_fineractId_idx" ON "FineractDocument"("fineractId");

-- CreateIndex
CREATE UNIQUE INDEX "FineractDocument_fineractId_documentType_key" ON "FineractDocument"("fineractId", "documentType");

-- CreateIndex
CREATE INDEX "FineractDataCache_endpoint_idx" ON "FineractDataCache"("endpoint");

-- CreateIndex
CREATE INDEX "FineractDataCache_entityId_idx" ON "FineractDataCache"("entityId");

-- CreateIndex
CREATE INDEX "FineractDataCache_expiresAt_idx" ON "FineractDataCache"("expiresAt");

-- CreateIndex
CREATE INDEX "ChatSession_userId_idx" ON "ChatSession"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "QueryLog_userId_idx" ON "QueryLog"("userId");

-- CreateIndex
CREATE INDEX "QueryLog_timestamp_idx" ON "QueryLog"("timestamp");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
