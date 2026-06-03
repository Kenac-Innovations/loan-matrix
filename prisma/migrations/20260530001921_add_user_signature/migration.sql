-- CreateTable
CREATE TABLE "UserSignature" (
    "id" TEXT NOT NULL,
    "fineractUserId" INTEGER NOT NULL,
    "signatureData" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSignature_fineractUserId_key" ON "UserSignature"("fineractUserId");

-- CreateIndex
CREATE INDEX "UserSignature_fineractUserId_idx" ON "UserSignature"("fineractUserId");
