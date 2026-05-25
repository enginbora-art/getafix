-- AlterTable
ALTER TABLE "ManualRequest" ADD COLUMN     "reportId" TEXT;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "inPortfolio" BOOLEAN NOT NULL DEFAULT false;
