-- AlterTable: make facilityType nullable so upcoming leads no longer require it
ALTER TABLE "Lead" ALTER COLUMN "facilityType" DROP NOT NULL;
