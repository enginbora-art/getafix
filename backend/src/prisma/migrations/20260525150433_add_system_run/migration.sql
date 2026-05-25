-- CreateTable
CREATE TABLE "SystemRun" (
    "id" TEXT NOT NULL,
    "market" "Market" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "error" TEXT,
    "userId" TEXT,

    CONSTRAINT "SystemRun_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SystemRun" ADD CONSTRAINT "SystemRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
