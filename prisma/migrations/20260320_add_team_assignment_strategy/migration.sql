-- AlterTable
ALTER TABLE "Team" ADD COLUMN "assignmentStrategy" TEXT NOT NULL DEFAULT 'round_robin';
ALTER TABLE "Team" ADD COLUMN "assignmentConfig" JSONB;
