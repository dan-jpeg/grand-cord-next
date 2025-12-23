/*
  Warnings:

  - You are about to drop the column `stock` on the `ProductSize` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProductSize" DROP COLUMN "stock",
ADD COLUMN     "available" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "committed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "onHand" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unavailable" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
