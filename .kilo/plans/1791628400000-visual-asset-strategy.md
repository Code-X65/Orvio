# Visual Asset Strategy: Category Images & Product Catalog Gallery

## Goal
Define a complete visual asset pipeline for the Orvio e-commerce catalog: category images, 1-5 product images per product/variant with thumbnails, and a structured framework for presenting product variations with visual consistency.

## Current State Assessment
- **Schema**: `Product.image_url` (single `String?`, no UI). No image fields on `Category` or `ProductVariant`.
- **No upload infrastructure**: no multipart routes, no storage provider, `sharp` not a dependency.
- **Frontend**: ProductForm has no image UI. API client already supports FormData.
- **Business types** (8): `retail_supermarket`, `wholesale_distribution`, `fashion_boutique`, `electronics_tech`, `pharmacy_cosmetics`, `food_grocery`, `manufacturing_other`, `services_other`

## Resolved Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage | Local filesystem + `/uploads/` route | No existing storage infra; simplest MVP with presigned URL migration path |
| Schema | Separate `ProductImage` model | Supports alt_text, sort_order, is_primary, variant_id FK |
| Category images | Add `image_url String?` to `Category` | Single image per category for visual browsing |
| Variant images | `ProductImage.variant_id` nullable FK | Inherits parent images when variant has none |
| Thumbnail generation | Server-side via `sharp.js` | Consistent quality, pre-computed sizes, no client load |

---

## 1. Schema Changes

### 1.1 New Model: `ProductImage`
```prisma
model ProductImage {
  id          String    @id @default(cuid())
  org_id      String
  product_id  String
  variant_id  String?   // nullable: null = parent-level image
  url         String    // original filename: /uploads/products/{orgId}/{productId}/{imageId}.{ext}
  thumbnail_200  String?  // 200x200px thumb
  thumbnail_400  String?  // 400x400px thumb
  thumbnail_800  String?  // 800x800px
  thumbnail_1200 String?  // 1200x1200px
  alt_text     String?   // max 200 chars
  sort_order   Int       @default(0)
  is_primary   Boolean   @default(false)
  file_size    Int?      // bytes, for quota tracking
  mime_type    String?   // image/jpeg, image/webp
  created_at   DateTime  @default(now())

  organization Organization  @relation(fields: [org_id], references: [id], onDelete: Cascade)
  product      Product       @relation(fields: [product_id], references: [id], onDelete: Cascade)
  variant      ProductVariant? @relation(fields: [variant_id], references: [id], onDelete: Cascade)

  @@index([product_id])
  @@index([product_id, variant_id])
  @@index([product_id, is_primary])
  @@map("product_images")
}
```

### 1.2 Category Modification
```prisma
// Add to existing Category model
model Category {
  // ... existing fields ...
  image_url String?  // category thumbnail for visual browsing
}
```

### 1.3 Remove legacy `Product.image_url`
- Drop `image_url` column from `Product` (replaced by `ProductImage` table)
- Update `ProductListItem` interface in `products-service.ts` to include `primary_image_url` (computed join)
- Update `products-api.ts` frontend type to use `primary_image_url`

### 1.4 Business type image requirements table
| Business Type | Max Images | Variant Images | Use Case |
|---|---|---|---|
| `retail_supermarket` | 3 | Yes (inherited) | Front, back, detail |
| `wholesale_distribution` | 2 | Yes (inherited) | Product + packaging |
| `fashion_boutique` | 5 | Yes (per-variant) | Size/color specific shots |
| `electronics_tech` | 5 | Yes (per-variant) | Front, back, ports, screen, accessories |
| `pharmacy_cosmetics` | 3 | Inherited | Packaging, ingredients, usage |
| `food_grocery` | 3 | Inherited | Front, ingredients, prepared |
| `manufacturing_other` | 2 | Inherited | Raw material, finished |
| `services_other` | 1 | N/A | Icon/lifestyle only |

---

## 2. Backend: Upload Infrastructure

### 2.1 Add dependencies
```bash
cd backend
npm install sharp @fastify/multipart
```

### 2.2 Fastify multipart plugin registration (`src/app.ts`)
```ts
import fastifyMultipart from '@fastify/multipart';
app.register(fastifyMultipart, {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per file
});
```

### 2.3 Upload service: `src/modules/inventory/image-upload-service.ts`
Responsibilities:
- Validate file type (allow: `image/jpeg`, `image/png`, `image/webp`)
- Validate file size (max 10MB)
- Generate unique filename: `{cuid}.{ext}`
- Save original to `/uploads/products/{orgId}/{productId}/`
- Use `sharp` to generate 4 thumbnail sizes (200, 400, 800, 1200px)
- Save thumbnails to same directory
- Return `ProductImage` record with all URLs

### 2.4 File serving route (`src/app.ts` or `routes.ts`)
```ts
// Serve /uploads/ at /uploads/:orgId/:productId/:filename
app.register(require('@fastify/static'), {
  root: path.resolve(process.cwd(), 'uploads'),
  prefix: '/uploads/',
  decorateReply: false,
});
```

---

## 3. Backend: API Endpoints

Base path: `/api/v1/inventory`

### 3.1 Product Images

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/products/:productId/images` | Upload 1-5 images (multipart/form-data). Validates count limit. |
| `GET` | `/products/:productId/images` | List product images sorted by sort_order, includes variant_id assignment. |
| `PATCH` | `/products/:productId/images/reorder` | Reorder via `[{id, sortOrder}]` array. Sets new primary if specified. |
| `PATCH` | `/products/:productId/images/:imageId` | Update `alt_text`, `is_primary`. |
| `DELETE` | `/products/:productId/images/:imageId` | Delete image + all thumbnails from filesystem. |

### 3.2 Variant Images

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/products/:productId/variants/:variantId/images` | Upload variant-specific images (inherits parent limit). |
| `GET` | `/products/:variantId/variant-images` | List variant-only images + parent fallback images. |

### 3.3 Category Image

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/categories/:categoryId/image` | Upload single category image (replaces existing). |
| `DELETE` | `/categories/:categoryId/image` | Remove category image. |

### 3.4 Service Layer: `ProductService` additions
- `uploadProductImages(orgId, productId, variantId?, files)` → returns `ProductImage[]`
- `listProductImages(orgId, productId)` → returns `ProductImage[]` with parent + variant images
- `reorderProductImages(orgId, productId, reorderData)` → transaction
- `updateProductImage(orgId, imageId, input)` → update alt_text, is_primary
- `deleteProductImage(orgId, imageId)` → delete from DB + filesystem
- `setPrimaryImage(orgId, imageId)` → ensure only one `is_primary` per product+variant group
- Cache invalidation: clear `products_detail:*`, `products_list:*` prefixes on any image mutation

### 3.5 Business rule constraints
- Enforce max 5 images per product+variant group (configurable per business type via metadata)
- At least 1 image must be set as `is_primary` — system auto-promotes first image if none exists
- Deleting a product cascades to delete all `ProductImage` records and filesystem files
- Category image deletion does not affect products

---

## 4. Frontend: Core Components

### 4.1 `ImageUploader` component (shared primitive)
Location: `frontend/src/components/ui/ImageUploader.tsx`

Props:
```ts
interface ImageUploaderProps {
  maxProductImages: number;     // 1-5, based on business type
  maxVariantImages: number;     // 0-5
  existingImages: UploadedImage[];   // ProductImage[] or VariantImage[]
  onImagesChange: (images: UploadedImage[]) => void;
  maxFileSizeMb?: number;       // default 10
  acceptedTypes?: string[];     // default ['image/jpeg', 'image/png', 'image/webp']
  showPreviews?: boolean;       // default true
  compact?: boolean;            // for variant drawer
}
```

Functionality:
- Drag-and-drop zone with file select
- Preview thumbnails with sort_order drag handles (use `react-dnd` or HTML5 drag)
- Alt text inline editing per image
- Primary image star toggle (radio button group)
- Remove button per image
- Progress indicator during upload
- Counter: "3/5 images uploaded"
- Validation errors: "Maximum 5 images per product", "File type not supported", "File exceeds 10MB limit"

### 4.2 `ProductGallery` component
Location: `frontend/src/features/inventory/components/ProductGallery.tsx`

Props:
```ts
interface ProductGalleryProps {
  images: ProductImage[];         // parent + variant images merged
  productName: string;
  variantImages?: ProductImage[];  // variant-specific images if variant selected
  onSelectVariant: (variant: ProductVariant | null) => void;
  showThumbnails?: boolean;       // default true
  thumbnailPosition?: 'bottom' | 'left';  // default 'bottom'
  enableZoom?: boolean;           // default true
  enableLightbox?: boolean;       // default true
}
```

Functionality:
- Main display: primary image (variant-specific if available, else parent primary)
- Thumbnail carousel below main image (sorted by sort_order)
- Click thumbnail → swap main display
- Click main image → open lightbox modal
- Lightbox: left/right arrow navigation, zoom, download, close
- If product has variants with images, render swatch selector above thumbnails
- Fallback: placeholder icon when no images

### 4.3 `VariantSwatchSelector` component
Location: `frontend/src/features/inventory/components/VariantSwatchSelector.tsx`

Props:
```ts
interface VariantSwatchSelectorProps {
  variants: ProductVariant[];
  parentImages: ProductImage[];
  selectedVariant: ProductVariant | null;
  onSelectVariant: (variant: ProductVariant | null) => void;
  swatchType: 'color' | 'size' | 'auto';  // auto detects from variant attributes
}
```

Functionality:
- **Color swatches**: If variant attributes include `color`, render color swatch circles
- **Size badges**: If variant attributes include `size`, render size button badges
- **Text labels**: For other attributes, render text badge selectors
- When a variant is selected, the ProductGallery switches to that variant's images (if any), with smooth transition
- If variant has no images, inherits parent primary image (display "inherits from product" indicator)
- Selected variant swatch is highlighted with ring/border

### 4.4 `CategoryImageBadge` component
Location: `frontend/src/features/inventory/components/CategoryImageBadge.tsx`

Small badge for CategoryTree and CategoriesPage:
- Renders 32x32 thumbnail if category has `image_url`
- Placeholder icon if no image
- Used in CategoryTree row next to folder icon

---

## 5. Frontend: Integration Points

### 5.1 ProductForm.tsx integration
- Add `<ImageUploader>` component after the "General Information" section
- Add `maxProductImages` prop based on `businessType` (lookup table)
- Add `maxVariantImages` prop (same as product for most types, 0 for services)
- On submit: if images changed, upload via `productApi.uploadImages(productId, FormData)`
- For new products: upload images after product creation (two-step: create product first, then upload images)
- For existing products: show existing images, allow reordering/replacing
- Remove `imageUrl` string field from form (replaced by uploader)

### 5.2 ProductVariantForm.tsx integration
- Add `<ImageUploader compact={true} maxVariantImages={maxVariantImages}>` after cost/selling price
- On submit: upload variant images after variant creation
- Show parent images as "inherited" in preview (read-only, with inheritance indicator)
- Allow variant-specific override images (0 to maxVariantImages new images)

### 5.3 ProductsPage.tsx integration
- Add image thumbnails in product list table (first column or name column)
- In variant sub-row: show variant-specific images
- Add image count badge: "📷 3" next to product name if images exist
- Detail view (when clicking a product): full `ProductGallery` with variant swatch selector

### 5.4 CategoriesPage.tsx + CategoryTree.tsx integration
- Add `image_url` to CategoryTreeNode type
- Render `CategoryImageBadge` in CategoryTree rows
- Add image upload to CategoryForm (single image upload via `categoryApi.uploadImage`)
- Add "Remove image" button in CategoryForm when editing

### 5.5 API client additions (`products-api.ts`, `categories-api.ts`)
```ts
// products-api.ts
uploadProductImages: (productId: string, formData: FormData) => api.post(...)
listProductImages: (productId: string) => api.get(...)
reorderProductImages: (productId: string, data: {id: string, sortOrder: number}[]) => api.patch(...)
setPrimaryImage: (imageId: string) => api.patch(...)
updateProductImage: (imageId: string, data: {altText?: string, isPrimary?: boolean}) => api.patch(...)
deleteProductImage: (imageId: string) => api.delete(...)
```

---

## 6. Visual Consistency Framework for Variations

### 6.1 Image inheritance hierarchy
```
Parent Product (primary_image)
  ↓
Variant (variant-specific images if any)
  ← if no variant images: display parent primary
  ← show "inherits from product" label in UI
```

### 6.2 Swatch selector design
| Attribute | UI Treatment | Example |
|-----------|-------------|---------|
| `color` | Circle swatch with background color | ● Red, ● Blue, ● Black |
| `size` | Button badge | S, M, L, XL |
| Other | Text badge | "Matte", "Glossy" |

Swatch rendering logic:
- Parse `variant.attributes` keys
- If key contains `color` → render color swatch (use CSS `bg-[color]` or color name map)
- If key contains `size` or `storage` → render as button badge
- Default → text badge with attribute value

### 6.3 Gallery sync behavior
When user selects a variant swatch:
1. Check if variant has its own images (`variant_id IS NOT NULL`)
2. If yes: display variant images in gallery, primary = variant's `is_primary` image
3. If no: display parent product images, show subtle "using product images" indicator
4. Smooth fade transition between image sets

### 6.4 Responsive thumbnail grid (gallery view)
- 1-5 thumbnails arranged in a vertical stack (left) or horizontal row (bottom)
- Thumbnail size: 64px on mobile, 80px on desktop
- Active/selected variant's image highlighted with ring
- Hover: overlay with alt text
- Empty state: placeholder with "No image" text

---

## 7. Implementation Order

### Phase 1: Schema & Backend
1. Add `sharp`, `@fastify/multipart` dependencies to backend
2. Create Prisma migration: add `ProductImage` model, add `Category.image_url`, remove `Product.image_url`
3. Create `image-upload-service.ts` (upload, thumbnail generation, filesystem cleanup)
4. Add upload route to `app.ts` for serving `/uploads/`
5. Implement product image CRUD endpoints + service methods
6. Implement category image endpoint + service methods
7. Wire endpoints to routes files
8. Add error codes: `IMAGE_UPLOAD_FAILED`, `INVALID_IMAGE_TYPE`, `IMAGE_COUNT_EXCEEDED`

### Phase 2: Frontend Primitives
9. Create `ImageUploader` component
10. Create `ProductGallery` component
11. Create `VariantSwatchSelector` component
12. Create `CategoryImageBadge` component

### Phase 3: Integration
13. Integrate `<ImageUploader>` into `ProductForm.tsx`
14. Integrate `<ImageUploader>` into `ProductVariantForm.tsx`
15. Integrate `<ProductGallery>` + `<VariantSwatchSelector>` into `ProductsPage.tsx` detail view
16. Integrate `<CategoryImageBadge>` + upload into `CategoryForm.tsx` + `CategoryTree.tsx`
17. Update `categories-api.ts` and `products-api.ts` with new endpoints
18. Update TypeScript types across frontend API clients

### Phase 4: Testing
19. Backend integration tests: upload, list, reorder, set primary, delete, variant inheritance
20. Backend integration tests: category image upload/delete
21. Frontend unit tests for `ImageUploader`, `ProductGallery`, `VariantSwatchSelector`
22. End-to-end: complete product creation with 5 images + variant with variant-specific images

---

## 8. Validation Steps

```bash
# Backend
cd backend
npx prisma generate
npx prisma migrate dev --name add_product_images
npx tsc --noEmit
npm test

# Frontend
cd frontend
npx tsc --noEmit
npm test
```

### Test scenarios to cover:
- Upload exactly 5 images → success
- Upload 6th image → returns `IMAGE_COUNT_EXCEEDED` (422)
- Upload non-image file → returns `INVALID_IMAGE_TYPE` (400)
- Upload >10MB file → rejected at multipart limit (413)
- Set image as primary → previously primary image loses flag (DB constraint)
- Reorder images → `sort_order` persists correctly
- Delete image → thumbnail files removed from filesystem
- Variant with images → gallery shows variant images
- Variant without images → gallery shows parent images with "inherits" indicator
- Category image upload → replaces existing
- Product delete cascades → all product images deleted from filesystem
