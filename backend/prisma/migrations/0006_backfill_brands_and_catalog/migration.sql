-- Migration 0006_backfill_brands_and_catalog
-- Extract metadata.brand into brands table and associate with products
-- Backfill branch_products from stock_levels and primary branch

DO $$
DECLARE
    r RECORD;
    b_slug TEXT;
    b_id TEXT;
BEGIN
    -- 1. Backfill Brands from product metadata
    FOR r IN
        SELECT DISTINCT org_id, TRIM(metadata->>'brand') as brand_name
        FROM products
        WHERE metadata IS NOT NULL 
          AND metadata->>'brand' IS NOT NULL 
          AND TRIM(metadata->>'brand') <> ''
    LOOP
        b_slug := lower(regexp_replace(regexp_replace(r.brand_name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
        IF b_slug = '' THEN
            b_slug := 'brand';
        END IF;

        b_id := 'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24);

        INSERT INTO brands (id, org_id, name, slug, is_active, is_deleted, created_at, updated_at)
        VALUES (b_id, r.org_id, r.brand_name, b_slug, true, false, NOW(), NOW())
        ON CONFLICT (org_id, slug) DO NOTHING;

        UPDATE products
        SET brand_id = (SELECT id FROM brands WHERE org_id = r.org_id AND slug = b_slug LIMIT 1)
        WHERE org_id = r.org_id 
          AND metadata->>'brand' = r.brand_name 
          AND brand_id IS NULL;
    END LOOP;

    -- 2. Backfill branch_products from existing stock_levels
    INSERT INTO branch_products (id, org_id, branch_id, product_id, is_excluded, added_at)
    SELECT DISTINCT
        'c' || substr(md5(random()::text || clock_timestamp()::text || sl.id), 1, 24),
        sl.org_id,
        sl.branch_id,
        sl.product_id,
        false,
        NOW()
    FROM stock_levels sl
    WHERE sl.product_id IS NOT NULL
    ON CONFLICT (org_id, branch_id, product_id) DO NOTHING;

    -- 3. For any products not yet in branch_products, assign to primary branch (or oldest branch) of the organization
    INSERT INTO branch_products (id, org_id, branch_id, product_id, is_excluded, added_at)
    SELECT
        'c' || substr(md5(random()::text || clock_timestamp()::text || p.id), 1, 24),
        p.org_id,
        b.id,
        p.id,
        false,
        NOW()
    FROM products p
    JOIN LATERAL (
        SELECT id FROM branches 
        WHERE org_id = p.org_id AND is_deleted = false 
        ORDER BY is_primary DESC, created_at ASC 
        LIMIT 1
    ) b ON true
    WHERE NOT EXISTS (
        SELECT 1 FROM branch_products bp
        WHERE bp.org_id = p.org_id AND bp.product_id = p.id
    )
    ON CONFLICT (org_id, branch_id, product_id) DO NOTHING;
END $$;
