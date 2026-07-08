CREATE TABLE "ProductSizingAttribute" (
    "productId"         TEXT    NOT NULL,
    "sizingAttributeId" TEXT    NOT NULL,
    "sortOrder"         INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductSizingAttribute_pkey" PRIMARY KEY ("productId", "sizingAttributeId"),
    CONSTRAINT "ProductSizingAttribute_productId_fkey"
        FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE,
    CONSTRAINT "ProductSizingAttribute_sizingAttributeId_fkey"
        FOREIGN KEY ("sizingAttributeId") REFERENCES "SizingAttribute"("id") ON DELETE CASCADE
);

CREATE INDEX "ProductSizingAttribute_productId_idx"
    ON "ProductSizingAttribute"("productId");
CREATE INDEX "ProductSizingAttribute_sizingAttributeId_idx"
    ON "ProductSizingAttribute"("sizingAttributeId");

CREATE TABLE "ProductSizeMeasurement" (
    "productSizeId"     TEXT NOT NULL,
    "sizingAttributeId" TEXT NOT NULL,
    "value"             TEXT NOT NULL,
    CONSTRAINT "ProductSizeMeasurement_pkey" PRIMARY KEY ("productSizeId", "sizingAttributeId"),
    CONSTRAINT "ProductSizeMeasurement_productSizeId_fkey"
        FOREIGN KEY ("productSizeId") REFERENCES "ProductSize"("id") ON DELETE CASCADE,
    CONSTRAINT "ProductSizeMeasurement_sizingAttributeId_fkey"
        FOREIGN KEY ("sizingAttributeId") REFERENCES "SizingAttribute"("id") ON DELETE CASCADE
);

CREATE INDEX "ProductSizeMeasurement_productSizeId_idx"
    ON "ProductSizeMeasurement"("productSizeId");
CREATE INDEX "ProductSizeMeasurement_sizingAttributeId_idx"
    ON "ProductSizeMeasurement"("sizingAttributeId");
