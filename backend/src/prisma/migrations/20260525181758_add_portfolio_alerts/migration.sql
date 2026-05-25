-- CreateTable
CREATE TABLE "PortfolioAlert" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "market" "Market" NOT NULL,
    "previousBias" TEXT NOT NULL,
    "newBias" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioAlert_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PortfolioAlert" ADD CONSTRAINT "PortfolioAlert_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
