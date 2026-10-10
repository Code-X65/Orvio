# PRD: Product Management for Inventory System

## 1. Business Context

Products are the core SKU-level entities in the Orvio inventory system. They represent what a business buys (cost), stocks (quantity), and sells (revenue). In the current codebase, products are entirely mock data in `InventoryWorkspacePage.tsx:122-173` — there is no `Product` table, no product APIs, and no real stock tracking.

Category management (the preceding PRD) must be implemented first, as products attach to categories. This PRD assumes categories exist and can be referenced by `category_id`.

### Business Objectives
| # | Objective | Metric |
|---|---|---|
| B1 | Enable staff to create and manage product catalogs | Products created per org |
| B2 | Organize products by category for reporting and browsing | % of products assigned to a category |
| B3 | Track real-time stock levels per branch | Stock discrepancy < 1% |
| B4 | Support business-type-specific product attributes | 8 business types covered |
| B5 | Enable barcode scanning for quick product lookup | Products with barcodes |

### User Personas
| Persona | Role | Needs |
|---|---|---|
| Store Owner | Org owner | Create products, set pricing, monitor profitability |
| Store Manager | Manager | Manage product catalog, adjust stock, view low-stock alerts |
| Inventory Clerk | Staff | Scan barcodes, add new products, conduct stocktakes |
| Branch Supervisor | Manager | Manage per-branch stock levels, transfer stock between branches |
| Accountant | Owner/Accountant | View cost vs. selling price, COGS tracking |

### Existing Business Types (from `InventorySetupWizard.tsx:41-90`)
| Business Type | Product Requirements |
|---|---|
| `retail_supermarket` | Standard products, bulk inventory, fast scan-and-go |
| `wholesale_distribution` | Tiered pricing potential, pallet tracking, volume discounts |
| `fashion_boutique` | Variants (size/color), variant-specific SKUs, style attributes |
| `electronics_tech` | Serialized devices, warranty tracking, batch management |
| `pharmacy_cosmetics` | Batch tracking, expiry dates, lot-level control |
| `food_grocery` | Expiry dates, cold chain flag, weight-based units |
| `manufacturing_other` | Raw materials, work-in-progress, bill of materials links |
| `services_other` | Service items (non-inventory), time-based or fixed-price |

## 2. User Stories

### Core Product Management
- **US-1** As a store owner, I want to create a new product by entering its name, SKU, barcode, cost price, and selling price, so I can add it to my inventory catalog.
- **US-2** As a store owner, I want to assign each product to a category (e.g., "Groceries"), so products are organized for reporting.
- **US-3** As an inventory clerk, I want to search for a product by name, SKU, or barcode, so I can find it quickly at the checkout counter.
- **US-4** As a store manager, I want to edit a product's pricing, category, or description, so I can keep my catalog up to date.
- **US-5** As a store manager, I want to deactivate a product, so it no longer appears in active inventory lists but preserves historical sales data.
- **US-6** As a store owner, I want to delete a product that was created by mistake, so my catalog stays clean.

### Stock Tracking
- **US-7** As an inventory clerk, I want to see the current stock level (quantity on hand) for each product at each branch, so I know when to reorder.
- **US-8** As a store manager, I want to set a low-stock threshold per product, so I get alerted when inventory runs low.
- **US-9** As a branch supervisor, I want to view stock levels filtered by branch, so I can manage inventory per location.

### Variants (Fashion & Electronics)
- **US-10** As a fashion retailer, I want to create a product with variants (e.g., Size S/M/L, Color Red/Blue), so each variant has its own SKU and tracks its own stock.
- **US-11** As an electronics seller, I want to track warranty period per product, so I can service devices under warranty.

### Batch & Expiry (Pharmacy & Food)
- **US-12** As a pharmacy owner, I want to track batch/lot numbers and expiry dates for products, so I can enforce FIFO rotation and reject expired stock.
- **US-13** As a food grocery owner, I want to flag products that require cold chain storage and track their expiry dates, so I can manage perishables properly.

### Service Items (Services & Manufacturing)
- **US-14** As a services business owner, I want to create non-inventory service items (e.g., "Consulting Service"), so services appear alongside physical products but don't trigger stock alerts.

## 3. Functional Requirements

### FR-1: Product Creation
| Requirement | Description |
|---|---|
| FR-1.1 | Create product with: name, SKU, cost price, selling price, category |
| FR-1.2 | SKU auto-suggested from product name but editable; validated unique per org |
| FR-1.3 | Barcode (UPC/EAN) optional but if provided, validated unique per org |
| FR-1.4 | Description field (rich text support deferred; plain text max 1000 chars) |
| FR-1.5 | Unit of measure: select from predefined enum (pcs, kg, g, liter, ml, box, pack, bottle, dozen) |
| FR-1.6 | Track quantity: boolean toggle (default true). If false, stock changes are not tracked |
| FR-1.7 | Low stock threshold: integer, default 0 (no alert) |
| FR-1.8 | Image URL: optional string (external storage integration deferred to Phase 2) |
| FR-1.9 | Is active: boolean default true |
| FR-1.10 | Has variants: boolean. If true, product becomes a "template" and variants are created separately |
| FR-1.11 | Metadata JSON: business-type-specific attributes (see FR-3) |

### FR-2: Product Listing & Search
| Requirement | Description |
|---|---|
| FR-2.1 | List products with pagination (default 20 per page) |
| FR-2.2 | Filter by category (single or multi-select) |
| FR-2.3 | Filter by active/inactive status |
| FR-2.4 | Filter by track_quantity flag |
| FR-2.5 | Filter by low stock (products where stock <= low_stock_threshold) |
| FR-2.6 | Full-text search by name, SKU, or barcode |
| FR-2.7 | Sort by name, SKU, cost_price, selling_price, created_at |
| FR-2.8 | Include aggregated stock level (total across branches) in list response |

### FR-3: Business-Type-Specific Attributes (via metadata JSON)
| Business Type | Metadata Fields |
|---|---|
| `retail_supermarket` | `tax_rate` (float), `tax_inclusive` (bool) |
| `wholesale_distribution` | `tax_rate`, `moq` (minimum order qty), `wholesale_price` |
| `fashion_boutique` | `variant_attributes` (["size", "color"]), `material`, `gender` (men/women/unisex/kids) |
| `electronics_tech` | `warranty_months` (int), `is_serialized` (bool), `warranty_inclusive` (bool) |
| `pharmacy_cosmetics` | `requires_batch_tracking` (bool), `requires_expiry` (bool) |
| `food_grocery` | `requires_expiry` (bool), `cold_chain_required` (bool), `shelf_life_days` (int) |
| `manufacturing_other` | `is_raw_material` (bool), `unit_weight`, `unit_volume` |
| `services_other` | `is_service` (bool), `service_duration_minutes` (int), `is_time_based` (bool) |

The product service reads `business_type` from the organization record (already stored in `organizations.business_type` column) to validate/interpret metadata fields.

### FR-4: Product Updates
| Requirement | Description |
|---|---|
| FR-4.1 | Update name, description, SKU, barcode, pricing, category |
| FR-4.2 | Update unit of measure, track quantity, low stock threshold |
| FR-4.3 | Update active/inactive status |
| FR-4.4 | Regenerate slug if name changes (not applicable — products don't use slugs) |
| FR-4.5 | Moving a product to a different category is allowed |
| FR-4.6 | Updating `has_variants` is allowed but should validate no existing variants conflict |

### FR-5: Stock Level Tracking
| Requirement | Description |
|---|---|
| FR-5.1 | Stock levels tracked per branch (many-to-many: Product ↔ Branch via StockLevel) |
| FR-5.2 | StockLevel has: `quantity_on_hand` (decimal, 3 places), `reserved` (decimal, for pending orders) |
| FR-5.3 | Available stock = quantity_on_hand - reserved |
| FR-5.4 | Stock levels update via stock movement APIs (incoming stock, sales, returns, adjustments) — those APIs are out of scope for this PRD |
| FR-5.5 | GET `/products/:id` includes per-branch stock breakdown |

### FR-6: Variant Support (Phase 1 skeleton)
| Requirement | Description |
|---|---|
| FR-6.1 | `ProductVariant` model: id, product_id, sku, barcode, cost_price, selling_price, attributes (JSON), is_active, created_at, updated_at |
| FR-6.2 | When `has_variants` is true on a Product, variants are managed separately (full CRUD is Phase 2, but data model and create endpoint for variants included in Phase 1) |
| FR-6.3 | Each variant has its own SKU (unique per org) |
| FR-6.4 | Variant attributes JSON example: `{"size": "L", "color": "Red"}` |

## 4. Non-Functional Requirements

| Requirement | Target |
|---|---|
| NFR-1 | API response time < 200ms for product list (95th percentile, cached) |
| NFR-2 | SKU uniqueness enforced at DB level per org |
| NFR-3 | Barcode uniqueness enforced at DB level per org |
| NFR-4 | All product endpoints require authenticated, org-scoped access |
| NFR-5 | Cross-org product access returns 404 (not 403) to prevent enumeration |
| NFR-6 | Caching layer for product list (30s TTL, cache invalidated on mutations) |
| NFR-7 | Decimal precision: cost_price and selling_price support up to 2 decimal places, quantities up to 3 |
| NFR-8 | Pagination support for large catalogs (>10k products) |

## 5. Business Rules

| Rule ID | Rule |
|---|---|
| BR-1 | SKU must be unique within an organization. Case-insensitive comparison. |
| BR-2 | Barcode must be unique within an organization if provided. |
| BR-3 | cost_price must be >= 0 |
| BR-4 | selling_price must be >= cost_price (warn, not block — some items sold at loss during promotions) |
| BR-5 | If `track_quantity` is false, stock level changes are ignored (no StockLevel updates created) |
| BR-6 | low_stock_threshold must be >= 0 |
| BR-7 | Deleting a product with active sales history (orders, purchase orders) should be blocked or require explicit force-delete. Phase 1: soft-delete (deactivate). Actual deletion allowed only when no transaction references exist. |
| BR-8 | A product's category must belong to the same organization. |
| BR-9 | Product name is required (min 1 char, max 200 chars). |
| BR-10 | Products without a category are allowed (category_id is nullable). System assigns "Uncategorized" for display purposes. |
| BR-11 | Variant SKUs must be unique within an organization, independent of parent product SKUs. |

## 6. Data Model

### New Prisma models:

```prisma
enum product_type {
  standard
  variant_template
  service
}

enum measurement_unit {
  pcs
  kg
  g
  liter
  ml
  box
  pack
  bottle
  dozen
}

model Product {
  id              String      @id @default(cuid())
  org_id          String
  category_id     String?
  name            String
  description     String?     @db.Text
  sku             String
  barcode         String?     @unique(map: "products_barcode_key")
  cost_price      Decimal     @db.Decimal(12, 2)
  selling_price   Decimal     @db.Decimal(12, 2)
  unit_of_measure measurement_unit @default(pcs)
  track_quantity  Boolean     @default(true)
  low_stock_threshold Int    @default(0)
  has_variants    Boolean     @default(false)
  image_url       String?
  is_active       Boolean     @default(true)
  is_deleted      Boolean     @default(false)
  business_type   String?     // snapshot of org business type at creation for attribute validation
  metadata        Json?       // business-type-specific attributes
  created_at      DateTime    @default(now())
  updated_at      DateTime    @updatedAt

  organization    Organization    @relation(fields: [org_id], references: [id], onDelete: Cascade)
  category        Category?      @relation(fields: [category_id], references: [id], onDelete: SetNull)
  variants        ProductVariant[]
  stock_levels    StockLevel[]

  @@unique([org_id, sku])
  @@index([org_id])
  @@index([category_id])
  @@index([is_active, is_deleted])
  @@index([org_id, is_deleted])
  @@map("products")
}

model ProductVariant {
  id          String   @id @default(cuid())
  org_id      String
  product_id  String
  sku         String
  barcode     String?
  cost_price  Decimal  @db.Decimal(12, 2)
  selling_price Decimal @db.Decimal(12, 2)
  attributes  Json     // e.g. {"size": "L", "color": "Red"}
  is_active   Boolean  @default(true)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  organization  Organization @relation(fields: [org_id], references: [id], onDelete: Cascade)
  product      Product       @relation(fields: [product_id], references: [id], onDelete: Cascade)
  stock_levels  StockLevel[]

  @@unique([org_id, sku])
  @@index([product_id])
  @@index([org_id])
  @@map("product_variants")
}

model StockLevel {
  id              String   @id @default(cuid())
  org_id          String
  product_id      String?
  variant_id      String?
  branch_id       String
  quantity_on_hand Decimal @db.Decimal(14, 3) @default(0)
  reserved        Decimal   @db.Decimal(14, 3) @default(0)
  updated_at      DateTime  @updatedAt

  organization    Organization    @relation(fields: [org_id], references: [id], onDelete: Cascade)
  product         Product?        @relation(fields: [product_id], references: [id], onDelete: Cascade)
  variant         ProductVariant? @relation(fields: [variant_id], references: [id], onDelete: Cascade)
  branch          Branch          @relation(fields: [branch_id], references: [id], onDelete: Cascade)

  @@unique([org_id, product_id, branch_id])
  @@unique([org_id, variant_id, branch_id])
  @@index([org_id])
  @@index([branch_id])
  @@map("stock_levels")
}
```

**Modify `Organization` model:**
```prisma
  products Product[]
```

**Modify `Category` model (from category PRD):**
```prisma
  products Product[]
```

### Key Design Decisions in Data Model
| Decision | Rationale |
|---|---|
| `is_deleted` boolean on Product | Allows soft-delete; historical orders/purchase orders keep their product reference intact but product hidden from active lists |
| `business_type` snapshot on Product | Organization business_type can change; snapshot ensures product metadata interpretation remains consistent |
| `metadata` JSON field | Avoids schema migrations for business-type-specific attributes; validated in service layer |
| StockLevel as junction table | Supports per-branch inventory tracking, which is essential for multi-location businesses |
| Decimal for pricing | Avoids floating-point rounding errors in financial calculations |
| `product_type` enum deferred | Initially using `has_variants` boolean instead; `product_type` reserved for future (standard vs. variant_template vs. service) — not used in Phase 1 to avoid complexity. Service items differentiated via metadata `is_service` flag. |

## 7. API Specification

Base path: `/api/v1/inventory/products`

### 7.1 GET `/api/v1/inventory/products`

List products with filtering, search, pagination, and aggregated stock.

**Query params:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Results per page (max 100) |
| `categoryId` | string | (none) | Filter to products in this category |
| `activeOnly` | boolean | true | Only return non-deleted, active products |
| `search` | string | (none) | Full-text search in name, SKU, barcode |
| `lowStock` | boolean | false | Only return products where stock <= low_stock_threshold |
| `trackQuantity` | boolean | (none) | Filter by track_quantity flag |
| `sortBy` | string | created_at | Sort field: name, sku, cost_price, selling_price, created_at |
| `sortOrder` | string | desc | asc or desc |
| `branchId` | string | (none) | Include stock level for specific branch |

**Response:**
```json
{
  "status": "success",
  "data": {
    "products": [
      {
        "id": "prod_abc",
        "name": "Classic Oversized Tee",
        "sku": "COTEE-001",
        "barcode": "012345678905",
        "category_id": "cat_xyz",
        "category_name": "T-Shirts",
        "description": null,
        "cost_price": "15.50",
        "selling_price": "33.99",
        "unit_of_measure": "pcs",
        "track_quantity": true,
        "low_stock_threshold": 50,
        "has_variants": false,
        "is_active": true,
        "image_url": null,
        "metadata": null,
        "total_stock": "156.000",
        "reserved_stock": "12.000",
        "available_stock": "144.000",
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "totalPages": 3
    }
  }
}
```

### 7.2 GET `/api/v1/inventory/products/{id}`

Returns a single product with full details including per-branch stock levels (if `track_quantity` is true).

**Response:**
```json
{
  "status": "success",
  "data": {
    "product": {
      "id": "prod_abc",
      "name": "Classic Oversized Tee",
      "sku": "COTEE-001",
      "barcode": "012345678905",
      "category_id": "cat_xyz",
      "category_name": "T-Shirts",
      "description": "Premium cotton oversized tee",
      "cost_price": "15.50",
      "selling_price": "33.99",
      "unit_of_measure": "pcs",
      "track_quantity": true,
      "low_stock_threshold": 50,
      "has_variants": false,
      "is_active": true,
      "image_url": "https://cdn.example.com/products/cottee-001.jpg",
      "business_type": "retail_supermarket",
      "metadata": { "tax_rate": 0.075, "tax_inclusive": false },
      "stock_levels": [
        { "branch_id": "branch_1", "branch_name": "Main Store", "quantity_on_hand": 156, "reserved": 12, "available": 144 },
        { "branch_id": "branch_2", "branch_name": "Warehouse", "quantity_on_hand": 200, "reserved": 0, "available": 200 }
      ],
      "variants": [],
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-20T14:22:00Z"
    }
  }
}
```

### 7.3 POST `/api/v1/inventory/products`

Creates a new product.

**Request body (Zod schema):**
```ts
export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200, 'Cannot exceed 200 characters'),
  description: z.string().max(1000, 'Description cannot exceed 1000 characters').optional().or(z.literal('')),
  sku: z.string().min(1, 'SKU is required').max(50, 'SKU cannot exceed 50 characters'),
  barcode: z.string().max(50, 'Barcode cannot exceed 50 characters').optional().or(z.literal('')),
  categoryId: z.string().optional().nullable(),
  costPrice: z.number().min(0, 'Cost price must be >= 0'),
  sellingPrice: z.number().min(0, 'Selling price must be >= 0'),
  unitOfMeasure: z.enum(['pcs', 'kg', 'g', 'liter', 'ml', 'box', 'pack', 'bottle', 'dozen']).default('pcs'),
  trackQuantity: z.boolean().default(true),
  lowStockThreshold: z.number().int().min(0).default(0),
  hasVariants: z.boolean().default(false),
  isActive: z.boolean().default(true),
  imageUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  metadata: z.record(z.any()).optional(),
})
```

**Response:** `201 Created` with created product (including auto-set `business_type` from org).

### 7.4 POST `/api/v1/inventory/products/{id}/variants`

Creates a variant for a product with `has_variants = true`.

**Request body (Zod schema):**
```ts
export const createVariantSchema = z.object({
  sku: z.string().min(1).max(50),
  barcode: z.string().max(50).optional().or(z.literal('')),
  costPrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  attributes: z.record(z.string(), z.string()).describe('e.g. {size: "L", color: "Red"}'),
  isActive: z.boolean().default(true),
})
```

**Response:** `201 Created` with created variant.

### 7.5 PUT `/api/v1/inventory/products/{id}`

Updates an existing product. Same schema as POST but all fields optional (partial update via PUT for full resource replace semantics — or switch to PATCH).

**Decision (D7):** Use `PATCH` for updates (partial update semantics, more flexible for frontend forms). Schema uses `.optional()` on all fields.

**Request body (Zod schema):**
```ts
export const updateProductSchema = createProductSchema.partial()
```

**Response:** `200 OK` with updated product.

### 7.6 DELETE `/api/v1/inventory/products/{id}`

Soft-deletes a product (sets `is_deleted = true`). If the product has sales history, hard delete is blocked.

**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `force` | boolean | false | If true, attempt hard delete (only succeeds if no transaction references) |

**Response:** `200 OK` `{ "success": true }`

### 7.7 PATCH `/api/v1/inventory/products/{id}/toggle-status`

Toggles `is_active` flag.

**Response:** `200 OK` with updated product.

### 7.8 GET `/api/v1/inventory/products/search`

Lightweight search endpoint for barcode scanner / quick lookup. Returns minimal product info.

**Query params:**
| Param | Type | Required | Description |
|---|---|---|---|
| `q` | string | yes | Search term (name, SKU, or barcode) |
| `branchId` | string | no | Include stock for specific branch |

**Response:**
```json
{
  "status": "success",
  "data": {
    "results": [
      {
        "id": "prod_abc",
        "name": "Classic Oversized Tee",
        "sku": "COTEE-001",
        "barcode": "012345678905",
        "selling_price": "33.99",
        "is_active": true,
        "available_stock": 144
      }
    ]
  }
}
```

## 8. Business Workflows

### Workflow 1: Create a Simple Product (no variants)
```
Store Owner → InventoryWorkspacePage → Products tab → "Add Product" button
  → ProductForm modal opens
  → Fill: Name, SKU, Barcode (optional), Cost Price, Selling Price, Unit, Category
  → Set track_quantity, low_stock_threshold
  → Click Save
  → API: POST /products
  → Product appears in list with aggregated stock "0.000"
  → StockLevel row created with quantity_on_hand = 0 (optional — may defer until first stock movement)
```

### Workflow 2: Create a Product with Variants
```
Store Owner → Products tab → "Add Product"
  → ProductForm: set "Has Variants" toggle ON
  → Fill parent details: Name, SKU (template SKU), Category
  → Click Save → creates parent product with has_variants=true
  → Immediately prompted to add variants:
    → VariantForm: SKU, Barcode, Cost, Price, Attributes (size/color dropdowns)
    → Click "Add Variant" → POST /products/{id}/variants
    → Repeat for each variant combination
  → Variants appear as child rows under parent product in list view
```

### Workflow 3: Find a Product by Barcode
```
Inventory Clerk → Product search bar or dedicated scanner view
  → Scan barcode
  → API: GET /products/search?q={barcode}
  → Product details appear with current stock levels
```

### Workflow 4: Update Stock Level
```
Store Manager → GET /products/{id}
  → View per-branch stock levels
  → Identify low-stock products (stock <= threshold)
  → Initiate purchase order or stock transfer
  → Stock movement system (out of scope for this PRD) updates StockLevel.quantity_on_hand
```

### Workflow 5: Low Stock Alert
```
GET /products?lowStock=true returns products where available_stock <= low_stock_threshold
→ Display in red/amber in UI with alert icon
→ "Place Reorder" action links to Purchase Orders (Phase 3)
```

## 9. Acceptance Criteria

### Data Model
- **AC-1** `Product` model exists with: org_id, category_id (nullable FK), name, sku (unique per org), barcode (unique per org), cost_price (Decimal 12,2), selling_price (Decimal 12,2), unit_of_measure (enum), track_quantity (bool, default true), low_stock_threshold (int, default 0), has_variants (bool, default false), image_url, is_active (bool, default true), is_deleted (bool, default false), metadata (JSON), business_type, created_at, updated_at.
- **AC-2** `ProductVariant` model exists with: org_id, product_id (FK), sku (unique per org), barcode (optional unique), cost_price, selling_price, attributes (JSON), is_active, created_at, updated_at.
- **AC-3** `StockLevel` model exists with: org_id, product_id (nullable FK), variant_id (nullable FK), branch_id (FK), quantity_on_hand (Decimal 14,3, default 0), reserved (Decimal 14,3, default 0), updated_at.
- **AC-4** `Category` model has `products Product[]` relation.
- **AC-5** `Organization` model has `products Product[]` relation.
- **AC-6** Product-variant relationship uses cuid IDs with proper foreign key constraints.

### API
- **AC-7** `POST /products` returns 201 with created product. SKU must be unique per org (DB constraint). Auto-sets `business_type` from org record.
- **AC-8** `GET /products` returns paginated, searchable list with aggregated stock totals. Respects `activeOnly`, `categoryId`, `lowStock` filters.
- **AC-9** `GET /products/{id}` returns full product details with per-branch stock levels (when track_quantity=true) and variants list.
- **AC-10** `PATCH /products/{id}` updates only specified fields. Returns 200 with updated product.
- **AC-11** `DELETE /products/{id}` soft-deletes (sets is_deleted=true). Default behavior does not remove from DB.
- **AC-12** `DELETE /products/{id}?force=true` hard-deletes only if no sales history (orders, purchase orders) references the product. Otherwise returns 409 with explanation.
- **AC-13** `PATCH /products/{id}/toggle-status` toggles is_active. Returns 200 with updated product.
- **AC-14** `GET /products/search?q={term}` returns lightweight matches (name, SKU, barcode) with available stock.
- **AC-15** `POST /products/{id}/variants` creates variant for parent with has_variants=true. Returns 400 if parent doesn't have has_variants or if SKU collides.
- **AC-16** All endpoints require `requireAuth` + `requireActiveOrg`. Cross-org access returns 404.
- **AC-17** SKU uniqueness enforced at DB level (`@@unique([org_id, sku])`). Concurrent creation of same SKU returns 409.
- **AC-18** Barcode uniqueness enforced at DB level per org.

### Business Logic
- **AC-19** Creating two products with same SKU in same org → second returns 409 `DUPLICATE_RESOURCE` with field: sku.
- **AC-20** Creating a product with `cost_price > selling_price` → allowed (warning-level concern only, not blocked).
- **AC-21** Updating a product's category to a category in a different org → returns 404 (category not found for this org).
- **AC-22** Creating a variant for a product with `has_variants = false` → returns 400 `VALIDATION_ERROR`.
- **AC-23** Deleting a product with existing variants → cascades to delete variants (DB-level `onDelete: Cascade`).
- **AC-24** StockLevel rows created lazily — not created on product creation. Only created when a stock movement occurs (out of scope for this PRD). GET product returns empty stock_levels if none exist.
- **AC-25** Low stock products: available_stock = quantity_on_hand - reserved; flagged when ≤ low_stock_threshold (and > 0 or threshold is 0 with quantity 0).

### Caching
- **AC-26** Product list cached under `products_list:${orgId}:${queryHash}` with 30s TTL.
- **AC-27** Product detail cached under `products_detail:${orgId}:${productId}` with 30s TTL.
- **AC-28** Cache invalidated on create, update, delete, toggle-status, and variant create — via `inventoryCache.clearPrefix('products_')`.

## 10. Edge Cases & Failure Modes

| Scenario | Handling |
|---|---|
| SKU already exists in org | Return 409 `DUPLICATE_RESOURCE` with field-level detail. Frontend highlights SKU field. |
| Barcode already exists in org | Return 409 `DUPLICATE_RESOURCE` with field: barcode. |
| Cost price > selling price | Allow (some products are loss leaders during promotions). No error. |
| Category doesn't exist or belongs to different org | Return 404 `CATEGORY_NOT_FOUND` (or `NOT_FOUND`). |
| Deleting product with no transaction history | Soft-delete by default. Force delete removes from DB. |
| Deleting product WITH transaction history | Force delete returns 409. Soft delete always allowed. |
| Product with variants deactivated | Variants remain but product hidden from active lists. Variants inherit visibility indirectly via parent product's active/deleted state. |
| Concurrent stock level updates | Use `StockLevel.reserved` field to prevent over-allocation. (Actual concurrent update handling via row-level locking — deferred to Stock Management PRD.) |
| Empty search query | Return empty results array (no DB query for empty string). |
| Very large product catalog (>10k) | Pagination enforces max 100 per page. Search uses Postgres full-text indexing. |
| Product created during onboarding (business type change) | business_type snapshot stored on Product at creation. Changing org business_type later doesn't affect existing products' metadata interpretation. |
| Negative stock (oversell) | Allowed at DB level (Decimal allows negatives for backorders). UI shows negative in red. Policy configurable per-org in future. |
| Unit of measure mismatch on variant | Variants inherit unit_of_measure from parent product. |

## 11. Dependencies

| Dependency | Status | Notes |
|---|---|---|
| Category Management PRD | Must be implemented first | Products reference `category_id` FK |
| Organization `business_type` field | Already exists | `organizations.business_type` column in Prisma schema (optional String) |
| Branch model | Already exists | `Branch` model in schema.prisma |
| Auth middleware | Already exists | `requireAuth`, `requireActiveOrg` |
| API client (`api` object) | Already exists | `frontend/src/lib/api/client.ts` |
| UI primitives | Already exists | `components/ui/` (Button, Input, Select, etc.) |
| Toast library | Already exists | `sonner` (used in InventorySetupWizard) |

## 12. Implementation Plan

### Files to create (backend):
1. `backend/src/modules/inventory/products-schemas.ts` — Zod validation schemas for product CRUD + search params + variant schemas
2. `backend/src/modules/inventory/products-service.ts` — `ProductService` class with all CRUD methods, tree building for search, metadata validation by business type
3. `backend/tests/integration/inventory-products.test.ts` — Integration tests

### Files to create (frontend):
1. `frontend/src/features/inventory/products-api.ts` — API client functions for product endpoints
2. `frontend/src/features/inventory/components/ProductsPage.tsx` — Product listing with search, filters, pagination
3. `frontend/src/features/inventory/components/ProductForm.tsx` — Create/edit product modal
4. `frontend/src/features/inventory/components/ProductVariantForm.tsx` — Create variant modal
5. `frontend/src/features/inventory/components/ProductsPage.test.tsx` — Frontend unit tests

### Files to modify:
1. `backend/prisma/schema.prisma` — Add `Product`, `ProductVariant`, `StockLevel` models; add relations to `Organization` and `Category`; add `product_type`, `measurement_unit` enums; add `barcode` unique index
2. `backend/src/modules/inventory/routes.ts` — Add product CRUD route handlers
3. `backend/src/app.ts` — No changes needed (inventory routes already registered at `/api/v1/inventory`)
4. `backend/src/lib/errors.ts` — Add `PRODUCT_NOT_FOUND`, `PRODUCT_SKU_DUPLICATE`, `CATEGORY_NOT_FOUND` to ErrorCode union if not reusing existing codes
5. `frontend/src/pages/app/InventoryWorkspacePage.tsx` — Wire "Products" nav item to real `ProductsPage`
6. `frontend/src/features/inventory/api.ts` — Add product type re-exports

### Implementation steps (ordered):

1. **Prisma schema** — Add models + enums, generate client
2. **Migration** — `npx prisma migrate dev --name add_products_variants_stock`
3. **Schemas** — Zod schemas in `products-schemas.ts`
4. **Service** — `ProductService` class (create, read, update, delete, search, toggle, variant create)
5. **Routes** — Product CRUD + search + variant + toggle-status routes in `inventory/routes.ts`
6. **Backend tests** — Integration tests in `inventory-products.test.ts`
7. **Frontend API client** — `products-api.ts` with typed functions
8. **Frontend components** — `ProductsPage`, `ProductForm`, `ProductVariantForm`
9. **Frontend wiring** — Update `InventoryWorkspacePage.tsx` nav
10. **Frontend tests** — Component unit tests
11. **Validation** — `tsc --noEmit`, full test suites

## 13. Validation Steps

```bash
# Backend
cd /home/kali/Documents/Orvio/backend
npx prisma generate
npx prisma migrate dev --name add_products_variants_stock
npx tsc --noEmit
npm test

# Frontend
cd /home/kali/Documents/Orvio/frontend
npx tsc --noEmit
npm test
```

## 14. Open Questions

| # | Question | Recommendation |
|---|---|---|
| Q1 | Should product deletion be soft (is_deleted) or hard delete? | Soft delete (is_deleted=true). Hard delete only with `?force=true` and no transaction history. Preserves referential integrity. |
| Q2 | Should `cost_price > selling_price` be blocked? | No — allow loss leaders for promotions. This is a business decision, not an enforcement point. |
| Q3 | Should variants inherit category from parent? | Yes — variants use parent's category_id. No separate category assignment per variant. |
| Q4 | Should stock levels be auto-created on product creation? | No — created lazily on first stock movement (incoming stock). GET product returns empty `stock_levels` array if none. Reduces write overhead. |
| Q5 | How to handle the `business_type` snapshot when org changes business type? | Store `business_type` on Product at creation time. Existing products interpret metadata with their stored business_type. New products use current org business_type. |
| Q6 | Is batch/lot tracking in scope for Phase 1? | No — batch tracking (pharmacy/food) is deferred to the Stock Movements PRD. Product model has `metadata.requires_batch_tracking` flag but no batch table. Products flagged for batch tracking will still accept a single StockLevel per branch until the batch system is built. |
| Q7 | Should `GET /products` include variants in the list response? | No — variants are expanded in detail view (`GET /products/{id}`). List view shows parent product + a `variants_count` integer for quick reference. |
