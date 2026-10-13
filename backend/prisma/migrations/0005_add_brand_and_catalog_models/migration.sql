-- AlterTable
ALTER TABLE "products" ADD COLUMN     "brand_id" TEXT;

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "website_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_user_id" TEXT,
    "deleted_reason" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_products" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "source_branch_id" TEXT,
    "added_by_user_id" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "is_excluded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "branch_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_imports" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "source_branch_id" TEXT NOT NULL,
    "target_branch_id" TEXT NOT NULL,
    "imported_by_user_id" TEXT,
    "product_count" INTEGER NOT NULL,
    "copy_stock" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brands_org_id_idx" ON "brands"("org_id");

-- CreateIndex
CREATE INDEX "brands_org_id_is_deleted_idx" ON "brands"("org_id", "is_deleted");

-- CreateIndex
CREATE INDEX "brands_org_id_is_active_idx" ON "brands"("org_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "brands_org_id_slug_key" ON "brands"("org_id", "slug");

-- CreateIndex
CREATE INDEX "branch_products_org_id_idx" ON "branch_products"("org_id");

-- CreateIndex
CREATE INDEX "branch_products_branch_id_idx" ON "branch_products"("branch_id");

-- CreateIndex
CREATE INDEX "branch_products_product_id_idx" ON "branch_products"("product_id");

-- CreateIndex
CREATE INDEX "branch_products_source_branch_id_idx" ON "branch_products"("source_branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_products_org_id_branch_id_product_id_key" ON "branch_products"("org_id", "branch_id", "product_id");

-- CreateIndex
CREATE INDEX "catalog_imports_org_id_idx" ON "catalog_imports"("org_id");

-- CreateIndex
CREATE INDEX "catalog_imports_source_branch_id_idx" ON "catalog_imports"("source_branch_id");

-- CreateIndex
CREATE INDEX "catalog_imports_target_branch_id_idx" ON "catalog_imports"("target_branch_id");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_source_branch_id_fkey" FOREIGN KEY ("source_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_products" ADD CONSTRAINT "branch_products_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_imports" ADD CONSTRAINT "catalog_imports_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_imports" ADD CONSTRAINT "catalog_imports_source_branch_id_fkey" FOREIGN KEY ("source_branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_imports" ADD CONSTRAINT "catalog_imports_target_branch_id_fkey" FOREIGN KEY ("target_branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_imports" ADD CONSTRAINT "catalog_imports_imported_by_user_id_fkey" FOREIGN KEY ("imported_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
