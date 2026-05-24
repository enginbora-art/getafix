-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'QUEUED';

-- AlterTable
ALTER TABLE "ManualRequest" ADD COLUMN     "currentPrice" DOUBLE PRECISION,
ADD COLUMN     "currentStep" TEXT;
