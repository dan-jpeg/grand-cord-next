/*
  Warnings:

  - You are about to drop the column `onHand` on the `ProductSize` table. All the data in the column will be lost.
  - You are about to drop the column `unavailable` on the `ProductSize` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ProductSize" DROP COLUMN "onHand",
DROP COLUMN "unavailable",
ADD COLUMN     "total" INTEGER NOT NULL DEFAULT 0;
