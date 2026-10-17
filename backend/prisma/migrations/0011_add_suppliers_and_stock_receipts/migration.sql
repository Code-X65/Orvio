-- AlterTable: add stock_receipt_id to stock_movements
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "stock_receipt_id" TEXT;

-- CreateTable: suppliers
CREATE TABLE IF NOT EXISTS "suppliers" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "contact_person" TEXT,
    "tax_id" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: stock_receipts
CREATE TABLE IF NOT EXISTS "stock_receipts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "receipt_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplier_invoice_number" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "created_by_user_id" TEXT,
    "received_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: stock_receipt_items
CREATE TABLE IF NOT EXISTS "stock_receipt_items" (
    "id" TEXT NOT NULL,
    "stock_receipt_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "quantity_received" DECIMAL(14,3) NOT NULL,
    "unit_cost" DECIMAL(14,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes: suppliers
CREATE INDEX IF NOT EXISTS "suppliers_org_id_idx" ON "suppliers"("org_id");
CREATE INDEX IF NOT EXISTS "suppliers_org_id_is_active_idx" ON "suppliers"("org_id", "is_active");
CREATE INDEX IF NOT EXISTS "suppliers_org_id_name_idx" ON "suppliers"("org_id", "name");

-- CreateIndexes: stock_receipts
CREATE UNIQUE INDEX IF NOT EXISTS "stock_receipts_org_id_reference_key" ON "stock_receipts"("org_id", "reference");
CREATE INDEX IF NOT EXISTS "stock_receipts_org_id_branch_id_idx" ON "stock_receipts"("org_id", "branch_id");
CREATE INDEX IF NOT EXISTS "stock_receipts_org_id_supplier_id_idx" ON "stock_receipts"("org_id", "supplier_id");
CREATE INDEX IF NOT EXISTS "stock_receipts_org_id_receipt_date_idx" ON "stock_receipts"("org_id", "receipt_date");

-- CreateIndexes: stock_receipt_items
CREATE INDEX IF NOT EXISTS "stock_receipt_items_stock_receipt_id_idx" ON "stock_receipt_items"("stock_receipt_id");
CREATE INDEX IF NOT EXISTS "stock_receipt_items_product_id_idx" ON "stock_receipt_items"("product_id");
CREATE INDEX IF NOT EXISTS "stock_receipt_items_variant_id_idx" ON "stock_receipt_items"("variant_id");

-- CreateIndex: stock_movements stock_receipt_id
CREATE INDEX IF NOT EXISTS "stock_movements_stock_receipt_id_idx" ON "stock_movements"("stock_receipt_id");

-- AddForeignKeys: suppliers
DO $$ BEGIN
  ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKeys: stock_receipts
DO $$ BEGIN
  ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_received_by_user_id_fkey" FOREIGN KEY ("received_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKeys: stock_receipt_items
DO $$ BEGIN
  ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_stock_receipt_id_fkey" FOREIGN KEY ("stock_receipt_id") REFERENCES "stock_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "stock_receipt_items" ADD CONSTRAINT "stock_receipt_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: stock_movements stock_receipt_id
DO $$ BEGIN
  ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_receipt_id_fkey" FOREIGN KEY ("stock_receipt_id") REFERENCES "stock_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
