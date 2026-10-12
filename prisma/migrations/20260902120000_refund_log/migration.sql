-- CreateEnum
CREATE TYPE "RefundKind" AS ENUM ('FULL', 'PARTIAL');

-- CreateTable
CREATE TABLE "RefundLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "kind" "RefundKind" NOT NULL,
    "stripeRefundId" TEXT,
    "stripePaymentIntentId" TEXT,
    "adminUserId" TEXT,
    "adminEmail" TEXT NOT NULL,
    "adminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefundLog_orderId_idx" ON "RefundLog"("orderId");

-- CreateIndex
CREATE INDEX "RefundLog_adminUserId_idx" ON "RefundLog"("adminUserId");

-- CreateIndex
CREATE INDEX "RefundLog_createdAt_idx" ON "RefundLog"("createdAt");

-- AddForeignKey
ALTER TABLE "RefundLog" ADD CONSTRAINT "RefundLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
