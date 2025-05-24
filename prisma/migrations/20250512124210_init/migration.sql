-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "closedReason" TEXT,
    "officeId" INTEGER,
    "officeName" TEXT,
    "legalFormId" INTEGER,
    "legalFormName" TEXT,
    "externalId" TEXT,
    "firstname" TEXT,
    "middlename" TEXT,
    "lastname" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "genderId" INTEGER,
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "mobileNo" TEXT,
    "countryCode" TEXT DEFAULT '+1',
    "emailAddress" TEXT,
    "clientTypeId" INTEGER,
    "clientTypeName" TEXT,
    "clientClassificationId" INTEGER,
    "clientClassificationName" TEXT,
    "submittedOnDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "activationDate" TIMESTAMP(3),
    "openSavingsAccount" BOOLEAN NOT NULL DEFAULT false,
    "savingsProductId" INTEGER,
    "savingsProductName" TEXT,
    "clientId" INTEGER,
    "resourceId" INTEGER,
    "userId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "lastModified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "firstname" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,
    "middlename" TEXT,
    "relationship" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "mobileNo" TEXT,
    "emailAddress" TEXT,
    "isDependent" BOOLEAN NOT NULL DEFAULT false,
    "leadId" TEXT NOT NULL,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_userId_idx" ON "Lead"("userId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "FamilyMember_leadId_idx" ON "FamilyMember"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
