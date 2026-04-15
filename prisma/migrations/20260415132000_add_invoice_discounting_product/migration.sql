-- CreateTable
CREATE TABLE "InvoiceDiscountingProduct" (
    "id" TEXT NOT NULL,
    "fineractProductId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceDiscountingProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceDiscountingProduct_fineractProductId_key"
ON "InvoiceDiscountingProduct"("fineractProductId");

-- CreateIndex
CREATE INDEX "InvoiceDiscountingProduct_fineractProductId_idx"
ON "InvoiceDiscountingProduct"("fineractProductId");
