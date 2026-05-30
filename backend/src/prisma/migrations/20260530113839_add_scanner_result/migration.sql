-- CreateTable
CREATE TABLE "ScannerResult" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "market" TEXT NOT NULL DEFAULT 'US',
    "price" DOUBLE PRECISION NOT NULL,
    "changePct" DOUBLE PRECISION NOT NULL,
    "volumeRatio" DOUBLE PRECISION NOT NULL,
    "marketCap" DOUBLE PRECISION,
    "score" DOUBLE PRECISION NOT NULL,
    "name" TEXT,
    "signal" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScannerResult_pkey" PRIMARY KEY ("id")
);
