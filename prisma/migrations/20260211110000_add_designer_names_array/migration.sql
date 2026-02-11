-- Add new array column with safe default
ALTER TABLE "Product"
ADD COLUMN "designerNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Migrate existing single designer value into array
UPDATE "Product"
SET "designerNames" = CASE
  WHEN "designerName" IS NULL OR btrim("designerName") = '' THEN ARRAY[]::TEXT[]
  ELSE ARRAY["designerName"]
END;

-- Remove old single-value column
ALTER TABLE "Product"
DROP COLUMN "designerName";
