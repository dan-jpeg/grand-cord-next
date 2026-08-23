-- Attribute inventory movements to the order that caused them, so stock changes
-- driven by shipping and cancellation stop looking like unexplained drift.
ALTER TABLE "InventoryChangeLog"
ADD COLUMN "field" TEXT,
ADD COLUMN "reason" TEXT,
ADD COLUMN "orderId" TEXT,
ADD COLUMN "orderNumber" TEXT;

CREATE INDEX "InventoryChangeLog_orderId_idx" ON "InventoryChangeLog"("orderId");
