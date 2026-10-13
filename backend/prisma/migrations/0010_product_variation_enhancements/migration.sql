-- Drop old unique constraint on (org_id, product_id, branch_id) FIRST so variant rows can have product_id
ALTER TABLE "stock_levels" DROP CONSTRAINT IF EXISTS "stock_levels_org_id_product_id_branch_id_key";
DROP INDEX IF EXISTS "stock_levels_org_id_product_id_branch_id_key";

-- AlterTable: Add low_stock_threshold to product_variants
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "low_stock_threshold" INTEGER;

-- CreateIndex: Index barcode per organization on product_variants
CREATE INDEX IF NOT EXISTS "product_variants_org_id_barcode_idx" ON "product_variants"("org_id", "barcode");

-- Data Backfill: Populate product_id on variant stock_levels where previously null
UPDATE "stock_levels" sl
SET "product_id" = pv."product_id"
FROM "product_variants" pv
WHERE sl."variant_id" = pv."id"
  AND sl."product_id" IS NULL;

-- Create partial unique index on (org_id, product_id, branch_id) specifically for standalone products (variant_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "stock_levels_org_id_product_id_branch_id_key" 
ON "stock_levels"("org_id", "product_id", "branch_id") 
WHERE "variant_id" IS NULL;

-- Create composite index on (org_id, product_id, branch_id) for instant parent product stock rollups
CREATE INDEX IF NOT EXISTS "stock_levels_org_id_product_id_branch_id_idx" 
ON "stock_levels"("org_id", "product_id", "branch_id");
