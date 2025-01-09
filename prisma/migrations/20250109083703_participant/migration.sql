-- AlterTable
ALTER TABLE "Quest" ADD COLUMN     "ended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "winnerId" TEXT;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
