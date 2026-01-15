-- AlterTable
ALTER TABLE "RoomProject" ADD COLUMN     "aiDesignsJson" JSONB DEFAULT '[]',
ADD COLUMN     "selectedAiDesignId" TEXT;
