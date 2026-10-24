-- CreateTable
CREATE TABLE "DesignGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'started',
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DesignGeneration_userId_createdAt_idx" ON "DesignGeneration"("userId", "createdAt");
