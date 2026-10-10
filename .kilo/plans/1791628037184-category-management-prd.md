# PRD: Category Management for Inventory System

## 1. Goal

Implement hierarchical **category management** for the Orvio inventory system. Categories organize products into a tree structure (e.g., "Groceries" → "Canned Goods"). They are the organizational container that products will attach to, and they enable reporting by category.

This feature builds directly on the existing onboarding flow: the `businessType` selected during `completeBranchSetup` will be used to auto-seed sensible default categories, so new users open their workspace to a pre-configured category tree instead of a blank slate.

## 2. Context / Current State

The codebase (`Orvio`) has a completed **onboarding flow** but **no product or category data model yet**.

### What exists
- **Backend** (`backend/src/modules/inventory/`): `InventoryOnboardingService` with 3 endpoints (`/onboarding/status`, `/onboarding/draft`, `/onboarding/setup`)
  - `completeBranchSetup` captures `businessType` and creates a primary `Branch` + completes `InventoryOnboarding`
- **Frontend**: `InventoryWorkspacePage.tsx` nav bar lists "Categories" but it's a UI placeholder
- **Prisma models**: `Organization`, `Branch`, `WorkspaceProduct`, `InventoryOnboarding` — no `Category` model
- `BUSINESS_TYPES` constant in `InventorySetupWizard.tsx` already defines 8 business type keys

### What's missing
- No `Category` (or `Product`) table in `prisma/schema.prisma`
- No category CRUD APIs, services, or frontend pages
- No seeding logic to populate default categories from `businessType`

### Codebase conventions (follow exactly)
| Concern | Pattern | Example file |
|---|---|---|
| Route registration | `app.register(moduleRoutes, { prefix: '/api/v1/inventory' })` in `app.ts:187` | `inventory/routes.ts` |
| Auth middleware | `requireAuth` then `requireActiveOrg` | `organizations/routes.ts:155` |
| Org context extraction | `request.auth?.organization?.id ?? request.auth?.claims?.org_id` | `inventory/routes.ts:22` |
| DB access | `(request.server as { prisma?: typeof defaultPrisma }).prisma ?? defaultPrisma` | `inventory/routes.ts:27` |
| Response envelope | `sendData(reply, data, statusCode)` | `lib/envelope.ts` |
| Error handling | `throw new AppError('CODE', 'message', 404)` | `lib/errors.ts` |
| Validation | Zod schemas in `schemas.ts` | `inventory/schemas.ts` |
| Caching | `inventoryCache` (InMemoryCache with 60s TTL, single-flight) + `clearPrefix` invalidation | `inventory/service.ts:28` |
| Service constructor | `constructor(private db: PrismaClient = defaultPrisma)` | `inventory/service.ts:25` |
| Frontend API client | `api` object (`api.get/post/put/patch/delete`) in `lib/api/client.ts` — auto-unwraps `{ data }` envelope, handles auth refresh | `features/inventory/api.ts` |
| Frontend UI | Tailwind CSS, lucide-react icons, component primitives in `components/ui/` | `InventoryWorkspacePage.tsx` |
| Error code list | `ErrorCode` union in `lib/errors.ts` | — |

## 3. Scope

### In Scope
1. New `Category` model in Prisma schema with hierarchical parent-child relationship
2. Business-type-to-default-categories mapping and seeding logic
3. Category CRUD backend: service (`CategoryService`), Zod schemas, Fastify routes
4. Category seeding triggered during onboarding `completeBranchSetup`
5. Frontend: API client functions, categories page/component, create/edit modal
6. Integration tests for backend (matching existing test patterns in `backend/tests/integration/`)
7. Frontend unit test for the categories page
8. Prisma migration generation

### Out of Scope
- Product management (Category CRUD only — products will attach to categories later)
- Drag-and-drop reordering UI (deferred — use sort_order field, simple reorder API)
- Import/export categories
- Category icons/image uploads (description text only)
- Cross-organization category sharing (each org gets its own tree)

## 4. Data Model

### New Prisma model: `Category`

```prisma
model Category {
  id            String    @id @default(cuid())
  org_id        String
  name          String
  slug          String
  description   String?
  parent_id     String?
  sort_order    Int       @default(0)
  is_active     Boolean   @default(true)
  created_at    DateTime  @default(now())
  updated_at    DateTime  @updatedAt

  organization  Organization  @relation(fields: [org_id], references: [id], onDelete: Cascade)
  parent        Category?     @relation("CategoryHierarchy", fields: [parent_id], references: [id], onDelete: Cascade)
  children      Category[]    @relation("CategoryHierarchy")

  @@unique([org_id, slug])
  @@index([org_id])
  @@index([parent_id])
  @@map("categories")
}
```

**Key constraints:**
- `slug` must be unique **per organization** (not globally) — enforced by `@@unique([org_id, slug])`
- `parent_id` self-references for nested hierarchy (max depth not enforced at DB level — guard in service)
- `onDelete: Cascade` on `parent_id` means deleting a parent deletes all descendants
- `sort_order` controls display order within siblings

**Add to `Organization` model:**
```prisma
  categories Category[]
```

### Business Type → Default Categories Mapping

Stored in backend as a constant, used during `completeBranchSetup` seeding:

```ts
export const DEFAULT_CATEGORIES_BY_BUSINESS_TYPE: Record<string, DefaultCategorySpec[]> = {
  retail_supermarket: [
    { name: 'Groceries' },
    { name: 'Beverages' },
    { name: 'Household Supplies' },
    { name: 'Personal Care & Beauty' },
    { name: 'Frozen & Refrigerated' },
    { name: 'Snacks & Confectionery' },
    { name: 'Health & Wellness' },
    { name: 'Baby Care' },
  ],
  wholesale_distribution: [
    { name: 'Packaging Materials' },
    { name: 'Industrial Supplies' },
    { name: 'Office Supplies' },
    { name: 'Food Service' },
    { name: 'Hardware & Tools' },
  ],
  fashion_boutique: [
    { name: 'Women\'s Clothing' },
    { name: 'Men\'s Clothing' },
    { name: 'Footwear' },
    { name: 'Accessories' },
    { name: 'Bags & Jewelry' },
  ],
  electronics_tech: [
    { name: 'Smartphones & Tablets' },
    { name: 'Laptops & Computers' },
    { name: 'Audio & Headphones' },
    { name: 'Gaming' },
    { name: 'Cameras & Accessories' },
  ],
  pharmacy_cosmetics: [
    { name: 'Pharmaceuticals' },
    { name: 'Vitamins & Supplements' },
    { name: 'Skincare' },
    { name: 'Haircare' },
    { name: 'Personal Hygiene' },
  ],
  food_grocery: [
    { name: 'Fresh Produce' },
    { name: 'Meat & Seafood' },
    { name: 'Dairy & Eggs' },
    { name: 'Bakery' },
    { name: 'Pantry Staples' },
    { name: 'Beverages' },
  ],
  manufacturing_other: [
    { name: 'Raw Materials' },
    { name: 'Work-in-Progress' },
    { name: 'Finished Goods' },
    { name: 'MRO Supplies' },
  ],
  services_other: [
    { name: 'Service Fees' },
    { name: 'Event Supplies' },
    { name: 'Office Consumables' },
    { name: 'Equipment' },
  ],
}
```

## 5. API Specification

All endpoints are under `/api/v1/inventory/categories` (registered in `app.ts` via the existing `inventoryRoutes` registration at `app.ts:187`, or a new route registration).

### 5.1 GET `/api/v1/inventory/categories`

Returns the full hierarchical tree for the current organization, or a flat list with depth info.

**Query params:**
| Param | Type | Default | Description |
|---|---|---|---|
| `activeOnly` | boolean | `true` | Only return `is_active: true` categories |
| `parentId` | string | (none) | Filter to children of a specific category (for lazy tree expansion) |
| `includeInactive` | boolean | `false` | Include inactive categories |

**Response (tree structure):**
```json
{
  "status": "success",
  "data": {
    "categories": [
      {
        "id": "cat_abc123",
        "name": "Groceries",
        "slug": "groceries",
        "description": null,
        "parent_id": null,
        "sort_order": 0,
        "is_active": true,
        "children": [
          {
            "id": "cat_def456",
            "name": "Canned Goods",
            "slug": "canned-goods",
            "description": null,
            "parent_id": "cat_abc123",
            "sort_order": 0,
            "is_active": true,
            "children": []
          }
        ]
      }
    ]
  }
}
```

### 5.2 GET `/api/v1/inventory/categories/:id`

Returns a single category with its direct children count.

**Response:**
```json
{
  "status": "success",
  "data": {
    "category": {
      "id": "cat_abc123",
      "name": "Groceries",
      "slug": "groceries",
      "description": "Food staples",
      "parent_id": null,
      "sort_order": 0,
      "is_active": true,
      "children_count": 3,
      "full_path": "Groceries"
    }
  }
}
```

### 5.3 POST `/api/v1/inventory/categories`

Creates a new category under the current organization.

**Request body (Zod schema):**
```ts
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100, 'Cannot exceed 100 characters'),
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional().or(z.literal('')),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional().default(true),
})
```

The `slug` is **auto-generated** from `name` (slugify + uniqueness check). If duplicate slug exists, append `-2`, `-3`, etc.

**Constraints enforced in service:**
- Prevent self-reference (parentId === new id)
- Prevent circular hierarchy (parentId cannot be a descendant of itself)
- Max depth: 5 levels (guard in service)
- Validate parent belongs to same org

**Response:** `201 Created`
```json
{ "status": "success", "data": { "category": { ... } } }
```

### 5.4 PUT `/api/v1/inventory/categories/:id`

Updates an existing category.

**Request body (Zod schema):**
```ts
export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().or(z.literal('')),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})
```

**Response:** `200 OK` with updated category

### 5.5 DELETE `/api/v1/inventory/categories/:id`

Soft-delete semantics with cascade behavior. If the category has children:
- **Decision:** Cascade delete (parent_id has `onDelete: Cascade`). This is simpler and matches the data model. Document that deleting a parent deletes all descendants.

**Response:** `200 OK`
```json
{ "status": "success", "data": { "success": true } }
```

### 5.6 PATCH `/api/v1/inventory/categories/reorder`

Bulk update sort_order for multiple categories within the same parent. Accepts an ordered array.

**Request body (Zod schema):**
```ts
export const reorderCategoriesSchema = z.object({
  parentId: z.string().uuid().nullable(),
  categoryIds: z.array(z.string()).min(1),
})
```

Reassigns `sort_order` based on position in array. All `categoryIds` must belong to the same org and same parent.

**Response:** `200 OK` with reordered categories list.

### 5.7 PATCH `/api/v1/inventory/categories/:id/toggle-status`

Toggles `is_active` on/off. Inactive categories and their descendants are filtered from GET `/categories` by default (`activeOnly=true`).

**Response:** `200 OK` with updated category.

## 6. Backend Implementation Plan

### Files to create:
1. `backend/src/modules/inventory/categories-schemas.ts` — Zod validation schemas
2. `backend/src/modules/inventory/categories-service.ts` — `CategoryService` class
3. Extend `backend/src/modules/inventory/routes.ts` — Add category route handlers (or create `backend/src/modules/inventory/categories-routes.ts`)
4. `backend/prisma/schema.prisma` — Add `Category` model + add `categories` relation to `Organization`
5. `backend/tests/integration/inventory-categories.test.ts` — Integration tests

### Files to modify:
1. `backend/src/modules/inventory/service.ts` — Add category seeding call in `completeBranchSetup`
2. `backend/src/modules/inventory/schemas.ts` — Add `DEFAULT_CATEGORIES_BY_BUSINESS_TYPE` constant
3. `backend/src/app.ts` — Register category routes (if separate file)
4. `backend/src/lib/errors.ts` — Add `CATEGORY_NOT_FOUND` error code if needed (or reuse existing `NOT_FOUND`)

### CategoryService methods:

```ts
class CategoryService {
  constructor(private db: PrismaClient = defaultPrisma) {}

  // Reads
  async getCategoryTree(orgId, options): Promise<CategoryTreeNode[]>
  async getCategoryById(orgId, categoryId): Promise<CategoryWithPath>

  // Writes
  async createCategory(orgId, input): Promise<Category>
  async updateCategory(orgId, categoryId, input): Promise<Category>
  async deleteCategory(orgId, categoryId): Promise<{ success: true }>
  async reorderCategories(orgId, parentId, categoryIds): Promise<Category[]>
  async toggleCategoryStatus(orgId, categoryId): Promise<Category>

  // Seeding
  async seedDefaultCategories(orgId, businessType): Promise<{ count: number }>
}
```

### Seeding integration in `completeBranchSetup`:

In `service.ts`, within the existing `$transaction` in `completeBranchSetup`, after the branch and onboarding are created (step 4), add:

```ts
// 5. Seed default categories from business type
const businessType = input.businessType as string;
const defaultCategories = DEFAULT_CATEGORIES_BY_BUSINESS_TYPE[businessType];
if (defaultCategories) {
  for (const [index, cat] of defaultCategories.entries()) {
    await tx.category.create({
      data: {
        org_id: orgId,
        name: cat.name,
        slug: slugify(cat.name) + (isDuplicate ? `-2` : ''),
        sort_order: index,
        is_active: true,
      },
    });
  }
}
```

The seeding happens inside the same transaction so it's atomic with the rest of onboarding completion.

### Caching strategy:
- `getCategoryTree` results cached under `categories_tree:${orgId}` with 30s TTL
- Invalidate cache on any write operation via `inventoryCache.clearPrefix('categories_')` and `inventoryCache.clearPrefix(\`categories_tree:${orgId}\`)`
- Follow same pattern as `inventory_onb_status` cache invalidation in existing service

### Error handling:
- `CATEGORY_NOT_FOUND` — when category ID doesn't exist or doesn't belong to org (return 404)
- `INVALID_CATEGORY_HIERARCHY` — when parent/child creates circular reference or exceeds max depth (return 400)
- `DUPLICATE_CATEGORY` — when slug collision can't be auto-resolved (return 409, though slugify + suffix should prevent this)
- Use existing `AppError` pattern and `errorCode` union

## 7. Frontend Implementation Plan

### Files to create:
1. `frontend/src/features/inventory/categories-api.ts` — API client functions
2. `frontend/src/features/inventory/components/CategoriesPage.tsx` — Main categories management view
3. `frontend/src/features/inventory/components/CategoryForm.tsx` — Create/edit modal
4. `frontend/src/features/inventory/components/CategoryTree.tsx` — Hierarchical tree display
5. `frontend/src/features/inventory/components/CategoryForm.test.tsx` — Unit tests

### Files to modify:
1. `frontend/src/pages/app/InventoryWorkspacePage.tsx` — Update nav to route Categories to the new page (currently all nav items open a placeholder modal)
2. `frontend/src/features/inventory/api.ts` — Re-export categories API or add category types

### API client functions (in `categories-api.ts`):
```ts
export const categoryApi = {
  getCategories: (params?: { activeOnly?: boolean; parentId?: string }) =>
    api.get<CategoryTreeResponse>('/inventory/categories', { params }),
  getCategory: (id: string) =>
    api.get<CategoryDetailResponse>(`/inventory/categories/${id}`),
  createCategory: (payload: CreateCategoryPayload) =>
    api.post<CategoryResponse>('/inventory/categories', payload),
  updateCategory: (id: string, payload: UpdateCategoryPayload) =>
    api.patch<CategoryResponse>(`/inventory/categories/${id}`, payload),
  deleteCategory: (id: string) =>
    api.delete<{ success: boolean }>(`/inventory/categories/${id}`),
  reorderCategories: (parentId: string | null, categoryIds: string[]) =>
    api.patch<CategoryListResponse>('/inventory/categories/reorder', { parentId, categoryIds }),
  toggleCategoryStatus: (id: string) =>
    api.patch<CategoryResponse>(`/inventory/categories/${id}/toggle-status`),
}
```

### UI design for CategoriesPage:
- Top toolbar: "Add Category" button (primary), search field, filter toggle (active/all)
- Category tree view with:
  - Expand/collapse chevron for parent categories with children
  - Category name + description (truncated)
  - Badge showing children count
  - Sort handle (drag handle icon — placeholder for future DnD)
  - Status toggle (active/inactive)
  - Actions menu (⋯) → Edit, Toggle Status, Delete
- Empty state: "No categories yet. Create your first category to get started."
- Follow existing dark theme (`bg-[#181a20]`, `text-slate-100`, `#985184` accents, `#fbb945` highlights)

### CategoryForm (modal):
- Fields: Name (required), Description (optional, textarea), Parent Category (select from existing categories, with self-reference prevention), Is Active (toggle)
- Uses existing `Input`, `Button`, `Textarea` UI primitives
- Uses `sonner` toasts for success/error feedback (matches wizard pattern)

## 8. Integration Points

### A. Onboarding completion seeding
- `InventoryOnboardingService.completeBranchSetup` already captures `input.businessType`
- After branch + onboarding record creation (within same `$transaction`), call seeding logic
- This means the first category tree appears immediately after onboarding completes — the user clicks "Enter Inventory Workspace" and lands on a pre-populated categories view

### B. Navigation in InventoryWorkspacePage.tsx
- Currently nav items just set `activeModal` to a placeholder
- Wire "Categories" nav item to open the real `CategoriesPage` component
- This is a minimal change — wrap `CategoriesPage` in the modal container or make it a routed view

### C. Auth & org isolation
- All category endpoints use `requireAuth` + `requireActiveOrg` (same as org routes)
- `orgId` extracted as `request.auth?.organization?.id ?? request.auth?.claims?.org_id`
- All DB queries filter by `org_id` — cross-org access returns 404 (not 403) to prevent enumeration

## 9. Acceptance Criteria

1. **AC1 — Category model exists:** `Category` model in `schema.prisma` with fields: id, org_id, name, slug, description, parent_id, sort_order, is_active, created_at, updated_at. Relations: Organization (m:1), Category (self-ref parent/children).

2. **AC2 — Seed from business type:** After onboarding completion with `businessType: "retail_supermarket"`, at least 7 top-level categories appear (one per default entry). With `fashion_boutique`, at least 5 categories appear. Categories are seeded inside the onboarding transaction.

3. **AC3 — List categories (tree):** Authenticated org member receives `200` with hierarchical tree structure for their org. Categories from other orgs are not visible.

4. **AC4 — Create category:** Authenticated org member POSTs to create category. Slug auto-generated from name. Returns `201` with created category including generated slug.

5. **AC5 — Prevent circular hierarchy:** Attempting to set a category as its own parent, or as child of its descendant, returns `400` with `INVALID_CATEGORY_HIERARCHY` error.

6. **AC6 — Slug uniqueness:** Creating two categories with same name produces slugs `name` and `name-2` respectively within same org.

7. **AC7 — Update category:** PUT updates name, description, parent, active status. Returns `200` with updated category.

8. **AC8 — Delete category:** DELETE cascades to children. Returns `200` with `{ success: true }`. After deletion, category and all descendants are gone from the tree.

9. **AC9 — Reorder:** PATCH `/reorder` with sorted category IDs updates their `sort_order`. Children within same parent are reordered correctly.

10. **AC10 — Toggle status:** PATCH `/toggle-status` flips `is_active`. GET with `activeOnly=true` (default) hides inactive categories.

11. **AC11 — Cache invalidation:** After any mutation, subsequent GET returns fresh data (cache cleared within TTL window).

12. **AC12 — Frontend UI:** Categories page renders tree with expand/collapse, create modal, edit action, delete action. Uses existing UI primitives and dark theme.

13. **AC13 — Integration tests:** Tests cover: seeding from business type, create/read/update/delete, circular hierarchy prevention, slug uniqueness, cascade delete, reorder, toggle status.

14. **AC14 — Types propagate:** Frontend TypeScript types match backend response shapes. No `any` types in new API client functions.

## 10. Edge Cases & Failure Modes

| Scenario | Handling |
|---|---|
| Category with children deleted | Cascade delete all descendants (DB-level `onDelete: Cascade`) |
| Max hierarchy depth exceeded (>5) | Service rejects with `INVALID_CATEGORY_HIERARCHY` 400 |
| Circular parent reference (A→B→A) | Service detects via path traversal; rejects with 400 |
| Duplicate slug in same org | Auto-append `-2`, `-3`, etc. |
| User tries to access category from another org | Returns 404 (not 403) to prevent enumeration |
| Concurrent category creation for same org+slug | DB unique constraint on `[org_id, slug]`; retry with incremented suffix |
| Network error on reorder API | Client shows error toast, tree stays in previous order |
| No business type match for seeding | Fallback: no categories seeded; user creates manually. Also create a single generic "Uncategorized" category as a catch-all. |
| Large category trees (1000+ nodes) | Tree endpoint supports `parentId` query param for lazy loading (load children on expand) |
| Inactive parent but active child | Child is still returned on GET tree (children inherit visibility filter from parent path — if any ancestor is inactive, child is excluded from `activeOnly=true`) |

## 11. Test Plan

### Backend: `backend/tests/integration/inventory-categories.test.ts`
Follow existing integration test pattern (`createTestApp`, register, verify email, login, use token).

- **Test: seed categories on onboarding completion** — Complete onboarding with `retail_supermarket`, verify GET `/categories` returns expected default categories
- **Test: create category with auto-slug** — POST create "Test Category", verify slug = "test-category"; POST "Test Category" again, verify slug = "test-category-2"
- **Test: create sub-category** — POST with parentId, verify nested under correct parent
- **Test: prevent circular reference** — POST category, then PATCH to set its child as parent → 400
- **Test: prevent self-reference** — POST with parentId equal to new category → 400
- **Test: update category** — PUT update name/description/parent → 200, verify fields changed
- **Test: delete cascades to children** — Create parent + child, DELETE parent, verify child gone
- **Test: reorder** — Create 3 categories, PATCH reorder with shuffled IDs, verify sort_order updated
- **Test: toggle status** — PATCH toggle, verify is_active flipped, verify excluded from activeOnly GET
- **Test: org isolation** — Two orgs, create categories in each, verify each only sees own

### Frontend: `frontend/src/features/inventory/components/CategoryForm.test.tsx`
Follow existing `InventorySetupWizard.test.tsx` pattern (vitest + testing-library).

- Render create form, fill fields, submit, verify API called with correct payload
- Render edit form with existing data, verify fields pre-filled
- Attempt to select self as parent — verify blocked (UI-level guard)

## 12. Migration Path

1. Generate Prisma migration after schema change:
   ```bash
   cd backend && npx prisma migrate dev --name add_categories
   ```
2. Update `InventoryOnboardingService.completeBranchSetup` to call `seedDefaultCategories`
3. Deploy migration (no data migration needed — new empty table)
4. Frontend changes are additive (new page, no breaking changes to existing pages)

## 13. Open Decisions

| # | Decision | Recommendation |
|---|---|---|
| D1 | Where to register category routes: extend `inventoryRoutes` or create new route file | Extend `inventory/routes.ts` — keeps all inventory functionality in one module, matches existing pattern. One file. |
| D2 | Cascade delete vs. reassign children on parent deletion | Cascade delete — simpler, matches DB model. Document clearly. |
| D3 | Max hierarchy depth | 5 levels — deep enough for any practical catalog, shallow enough to prevent performance issues in tree rendering. |
| D4 | Default category when business type is `services_other` or unknown | Create a single generic "Products" category as catch-all fallback. |
| D5 | Slug update on name change | When category name updates, regenerate slug (with uniqueness check). PATCH `updateCategory` handles this. |
| D6 | Frontend navigation: modal or routed page for Categories | Use the existing modal container pattern in `InventoryWorkspacePage.tsx` — minimal change, CategoryForm renders inside. Can later be promoted to a routed page. |

## 14. Implementation Order

1. **Prisma schema** — Add `Category` model, run migration
2. **Schemas & constants** — Add category Zod schemas + `DEFAULT_CATEGORIES_BY_BUSINESS_TYPE` in `inventory/schemas.ts`
3. **CategoryService** — Implement all read/write methods
4. **Seeding integration** — Modify `completeBranchSetup` to seed categories
5. **Routes** — Add category CRUD route handlers in `inventory/routes.ts`
6. **Backend tests** — Integration tests
7. **Frontend API client** — `categories-api.ts`
8. **Frontend components** — `CategoriesPage`, `CategoryTree`, `CategoryForm`
9. **Frontend wiring** — Update `InventoryWorkspacePage.tsx` nav to open real Categories page
10. **Frontend tests** — Unit test for CategoryForm
11. **Validation** — Run `tsc`, lint, and full test suites (backend + frontend)

## 15. Validation Steps (for implementer)

After implementation, verify with:
```bash
# Backend
cd /home/kali/Documents/Orvio/backend
npx prisma generate
npx prisma migrate dev
npx tsc --noEmit
npm test  # runs backend tests

# Frontend
cd /home/kali/Documents/Orvio/frontend
npx tsc --noEmit
npm test  # runs frontend tests
```
