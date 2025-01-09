-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "question_slug" TEXT NOT NULL,
    "time_limit" TEXT NOT NULL DEFAULT '30',

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quest_creatorId_key" ON "Quest"("creatorId");
