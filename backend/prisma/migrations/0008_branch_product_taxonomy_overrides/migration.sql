-- AlterTable: add category_id and brand_id to branch_products
ALTER TABLE "branch_products" ADD COLUMN IF NOT EXISTS "category_id" TEXT;
ALTER TABLE "branch_products" ADD COLUMN IF NOT EXISTS "brand_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "branch_products_category_id_idx" ON "branch_products"("category_id");
CREATE INDEX IF NOT EXISTS "branch_products_brand_id_idx" ON "branch_products"("brand_id");
CREATE INDEX IF NOT EXISTS "branch_products_branch_id_category_id_idx" ON "branch_products"("branch_id", "category_id");
CREATE INDEX IF NOT EXISTS "branch_products_branch_id_brand_id_idx" ON "branch_products"("branch_id", "brand_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'branch_products_category_id_fkey'
    ) THEN
        ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'branch_products_brand_id_fkey'
    ) THEN
        ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Backfill existing branch_products where category belongs to the same branch
UPDATE "branch_products" bp
SET "category_id" = p."category_id"
FROM "products" p
JOIN "categories" c ON c."id" = p."category_id"
WHERE bp."product_id" = p."id"
  AND c."branch_id" = bp."branch_id"
  AND bp."category_id" IS NULL;

-- Backfill existing branch_products where brand belongs to the same branch
UPDATE "branch_products" bp
SET "brand_id" = p."brand_id"
FROM "products" p
JOIN "brands" b ON b."id" = p."brand_id"
WHERE bp."product_id" = p."id"
  AND b."branch_id" = bp."branch_id"
  AND bp."brand_id" IS NULL;
