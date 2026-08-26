-- Record every customer-facing order email we decide to send.
--
-- The unique index on (orderId, kind) is claimed before the provider is called,
-- so a replayed webhook or a re-shipped order cannot mail the customer twice.

CREATE TYPE "OrderEmailKind" AS ENUM ('ORDER_CONFIRMED', 'ORDER_SHIPPED', 'ORDER_CANCELLED');
CREATE TYPE "OrderEmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

CREATE TABLE "OrderEmail" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "kind" "OrderEmailKind" NOT NULL,
    "to" TEXT NOT NULL,
    "status" "OrderEmailStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderEmail_orderId_kind_key" ON "OrderEmail"("orderId", "kind");
CREATE INDEX "OrderEmail_orderId_idx" ON "OrderEmail"("orderId");
CREATE INDEX "OrderEmail_status_idx" ON "OrderEmail"("status");
CREATE INDEX "OrderEmail_createdAt_idx" ON "OrderEmail"("createdAt");

ALTER TABLE "OrderEmail" ADD CONSTRAINT "OrderEmail_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
