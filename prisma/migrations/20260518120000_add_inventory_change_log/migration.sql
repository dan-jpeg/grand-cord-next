CREATE TABLE "InventoryChangeLog" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "productSizeId" TEXT,
    "productName" TEXT NOT NULL,
    "sizeLabel" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "before" INTEGER NOT NULL,
    "after" INTEGER NOT NULL,
    "adminUserId" TEXT,
    "adminEmail" TEXT NOT NULL,
    "adminName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryChangeLog_productId_idx" ON "InventoryChangeLog"("productId");
CREATE INDEX "InventoryChangeLog_productSizeId_idx" ON "InventoryChangeLog"("productSizeId");
CREATE INDEX "InventoryChangeLog_adminUserId_idx" ON "InventoryChangeLog"("adminUserId");
CREATE INDEX "InventoryChangeLog_createdAt_idx" ON "InventoryChangeLog"("createdAt");

ALTER TABLE "InventoryChangeLog"
ADD CONSTRAINT "InventoryChangeLog_adminUserId_fkey"
FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
