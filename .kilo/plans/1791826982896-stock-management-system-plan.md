# Stock Management System Implementation Plan

## Overview
Implement a comprehensive stock management system extending the existing inventory models (Product, ProductVariant, StockLevel, Branch) with stock movement tracking, adjustments, transfers, low stock alerts, automated reordering, stock takes, and purchase orders.

---

## 1. Database Schema Updates

### 1.1 New Models

#### StockMovement
Tracks every inventory change with full audit trail.
```prisma
enum stock_movement_type {
  adjustment_in      // Manual positive adjustment (found stock, returns)
  adjustment_out     // Manual negative adjustment (damage, theft, loss)
  transfer_out       // Stock sent to another branch
  transfer_in        // Stock received from another branch
  purchase_receive   // Stock received from supplier (PO)
  sale               // Stock reserved/sold via POS
  sale_return        // Stock returned from customer
  stock_take         // Physical count variance correction
  initial_stock      // Initial stock on product creation
}

model StockMovement {
  id              String                @id @default(cuid())
  org_id          String
  branch_id       String                // Branch where movement occurred
  product_id      String?
  variant_id      String?
  type            stock_movement_type
  quantity        Decimal               @db.Decimal(14, 3)  // Positive or negative
  unit_cost       Decimal?              @db.Decimal(12, 2)  // Cost at time of movement
  reference_id    String?               // PO ID, Transfer ID, Order ID, etc.
  reference_type  String?               // 'purchase_order' | 'transfer' | 'sale' | 'stock_take' | 'adjustment'
  notes           String?               @db.Text
  created_by_user_id String
  created_at      DateTime              @default(now())

  organization    Organization @relation(fields: [org_id], references: [id], onDelete: Cascade)
  branch          Branch       @relation(fields: [branch_id], references: [id], onDelete: Cascade)
  product         Product?     @relation(fields: [product_id], references: [id], onDelete: SetNull)
  variant         ProductVariant? @relation(fields: [variant_id], references: [id], onDelete: SetNull)
  user            User         @relation(fields: [created_by_user_id], references: [id], onDelete: SetNull)

  @@index([org_id])
  @@index([branch_id])
  @@index([product_id])
  @@index([variant_id])
  @@index([type])
  @@index([reference_id])
  @@index([created_at])
  @@map("stock_movements")
}
```

#### PurchaseOrder
```prisma
enum po_status {
  draft
  sent
  confirmed
  partially_received
  received
  cancelled
}

model PurchaseOrder {
  id              String    @id @default(cuid())
  org_id          String
  branch_id       String    // Receiving branch
  supplier_id     String?   // Future: Supplier model
  supplier_name   String    // For now, free text
  status          po_status @default(draft)
  order_number    String    // Human-readable PO number
  expected_date   DateTime?
  notes           String?   @db.Text
  created_by_user_id String
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  sent_at         DateTime?
  received_at     DateTime?

  organization    Organization @relation(fields: [org_id], references: [id], onDelete: Cascade)
  branch          Branch       @relation(fields: [branch_id], references: [id], onDelete: Cascade)
  user            User         @relation(fields: [created_by_user_id], references: [id], onDelete: SetNull)
  items           PurchaseOrderItem[]

  @@unique([org_id, order_number])
  @@index([org_id])
  @@index([branch_id])
  @@index([status])
  @@map("purchase_orders")
}

model PurchaseOrderItem {
  id              String    @id @default(cuid())
  po_id           String
  product_id      String?
  variant_id      String?
  quantity_ordered Decimal   @db.Decimal(14, 3)
  quantity_received Decimal  @default(0) @db.Decimal(14, 3)
  unit_cost       Decimal   @db.Decimal(12, 2)
  notes           String?

  purchase_order  PurchaseOrder @relation(fields: [po_id], references: [id], onDelete: Cascade)
  product         Product?      @relation(fields: [product_id], references: [id], onDelete: SetNull)
  variant         ProductVariant? @relation(fields: [variant_id], references: [id], onDelete: SetNull)

  @@index([po_id])
  @@index([product_id])
  @@index([variant_id])
  @@map("purchase_order_items")
}
```

#### StockTake
```prisma
enum stock_take_status {
  in_progress
  completed
  cancelled
}

model StockTake {
  id              String             @id @default(cuid())
  org_id          String
  branch_id       String
  status          stock_take_status  @default(in_progress)
  reference_number String            // Human-readable
  notes           String?            @db.Text
  started_by_user_id String
  completed_by_user_id String?
  started_at      DateTime           @default(now())
  completed_at    DateTime?

  organization    Organization       @relation(fields: [org_id], references: [id], onDelete: Cascade)
  branch          Branch             @relation(fields: [branch_id], references: [id], onDelete: Cascade)
  started_by      User               @relation("StockTakeStartedBy", fields: [started_by_user_id], references: [id], onDelete: SetNull)
  completed_by    User?              @relation("StockTakeCompletedBy", fields: [completed_by_user_id], references: [id], onDelete: SetNull)
  items           StockTakeItem[]

  @@unique([org_id, reference_number])
  @@index([org_id])
  @@index([branch_id])
  @@index([status])
  @@map("stock_takes")
}

model StockTakeItem {
  id              String    @id @default(cuid())
  stock_take_id   String
  product_id      String?
  variant_id      String?
  system_quantity Decimal   @db.Decimal(14, 3)  // Current StockLevel quantity_on_hand
  counted_quantity Decimal  @db.Decimal(14, 3)  // Physical count
  variance        Decimal   @db.Decimal(14, 3)  // counted - system
  unit_cost       Decimal?  @db.Decimal(12, 2)
  notes           String?

  stock_take      StockTake @relation(fields: [stock_take_id], references: [id], onDelete: Cascade)
  product         Product?  @relation(fields: [product_id], references: [id], onDelete: SetNull)
  variant         ProductVariant? @relation(fields: [variant_id], references: [id], onDelete: SetNull)

  @@index([stock_take_id])
  @@index([product_id])
  @@index([variant_id])
  @@map("stock_take_items")
}
```

### 1.2 Modified Models

#### Product (add reorder_point)
```prisma
model Product {
  // ... existing fields ...
  reorder_point   Int?      @default(0)  // Trigger automated reorder when available <= this
  max_stock_level Int?      // Optional max for min/max reordering
  
  // Add relation
  stock_movements StockMovement[]
  po_items        PurchaseOrderItem[]
  stock_take_items StockTakeItem[]
}
```

#### ProductVariant (add reorder_point)
```prisma
model ProductVariant {
  // ... existing fields ...
  reorder_point   Int?      @default(0)
  max_stock_level Int?
  
  // Add relation
  stock_movements StockMovement[]
  po_items        PurchaseOrderItem[]
  stock_take_items StockTakeItem[]
}
```

#### StockLevel (add last_movement_at)
```prisma
model StockLevel {
  // ... existing fields ...
  last_movement_at DateTime?  // Track last stock change for stale detection
  
  // Add relation
  stock_movements StockMovement[]
}
```

#### Branch (add relations)
```prisma
model Branch {
  // ... existing fields ...
  stock_movements     StockMovement[]
  purchase_orders     PurchaseOrder[]
  stock_takes         StockTake[]
}
```

#### Organization (add relations)
```prisma
model Organization {
  // ... existing fields ...
  stock_movements     StockMovement[]
  purchase_orders     PurchaseOrder[]
  stock_takes         StockTake[]
}
```

---

## 2. Backend Implementation

### Phase 1: Stock Movements Core

#### Files to Create
| File | Purpose |
|------|---------|
| `backend/src/modules/inventory/stock-schemas.ts` | Zod validation for all stock operations |
| `backend/src/modules/inventory/stock-service.ts` | StockService class with all movement logic |
| `backend/src/modules/inventory/stock-routes.ts` | Fastify routes for stock endpoints |

#### StockService Methods
```typescript
class StockService {
  // Core movement recording
  async recordMovement(orgId, input: RecordMovementInput): Promise<StockMovement>
  
  // Adjustments
  async adjustStockIn(orgId, input: AdjustStockInput): Promise<StockMovement>
  async adjustStockOut(orgId, input: AdjustStockInput): Promise<StockMovement>
  
  // Transfers
  async initiateTransfer(orgId, input: InitiateTransferInput): Promise<StockTransfer>
  async receiveTransfer(orgId, transferId, input: ReceiveTransferInput): Promise<StockMovement>
  
  // Query
  async getStockMovements(orgId, query: ListMovementsQuery): Promise<Paginated<StockMovement>>
  async getProductMovementHistory(orgId, productId, branchId?): Promise<StockMovement[]>
  async getStockValuation(orgId, branchId?): Promise<StockValuation>
  
  // Low stock
  async getLowStockProducts(orgId, branchId?): Promise<LowStockItem[]>
  
  // Automated reorder
  async checkAndCreateReorders(orgId): Promise<PurchaseOrder[]>
}
```

#### API Endpoints
```
POST   /inventory/stock/adjust/in       # Positive adjustment
POST   /inventory/stock/adjust/out      # Negative adjustment
POST   /inventory/stock/transfer        # Initiate branch-to-branch transfer
POST   /inventory/stock/transfer/:id/receive  # Receive transfer
GET    /inventory/stock/movements       # List movements with filters
GET    /inventory/stock/movements/:productId  # Product movement history
GET    /inventory/stock/low-stock       # Products at/below reorder point
GET    /inventory/stock/valuation       # Inventory value report
POST   /inventory/stock/reorder/check   # Trigger automated reorder check
```

### Phase 2: Stock Takes (Physical Counts)

#### Files to Create
| File | Purpose |
|------|---------|
| `backend/src/modules/inventory/stock-take-service.ts` | StockTakeService |
| `backend/src/modules/inventory/stock-take-routes.ts` | Stock take routes |

#### API Endpoints
```
POST   /inventory/stock-takes                    # Start new stock take
GET    /inventory/stock-takes                    # List stock takes
GET    /inventory/stock-takes/:id                # Get stock take with items
POST   /inventory/stock-takes/:id/items          # Add/update counted item
PATCH  /inventory/stock-takes/:id/complete       # Complete stock take (creates adjustment movements)
DELETE /inventory/stock-takes/:id                # Cancel stock take
```

### Phase 3: Purchase Orders

#### Files to Create
| File | Purpose |
|------|---------|
| `backend/src/modules/inventory/purchase-order-service.ts` | PurchaseOrderService |
| `backend/src/modules/inventory/purchase-order-routes.ts` | PO routes |

#### API Endpoints
```
POST   /inventory/purchase-orders              # Create PO
GET    /inventory/purchase-orders              # List POs
GET    /inventory/purchase-orders/:id          # Get PO with items
PATCH  /inventory/purchase-orders/:id          # Update PO (draft only)
POST   /inventory/purchase-orders/:id/send     # Mark as sent to supplier
POST   /inventory/purchase-orders/:id/receive  # Receive items (creates stock movements)
PATCH  /inventory/purchase-orders/:id/cancel   # Cancel PO
```

### Phase 4: Automated Reordering

#### Logic
- Scheduled job (or manual trigger) checks all products/variants where `available_stock <= reorder_point`
- For each, creates a draft PurchaseOrder with suggested quantity = `max_stock_level - available_stock` (or reorder_point * 2 if no max)
- Groups by branch and supplier (future)
- Notification sent to managers

---

## 3. Frontend Implementation

### Phase 1: Stock Movement UI

#### Files to Create
| File | Purpose |
|------|---------|
| `frontend/src/features/inventory/stock-api.ts` | API client |
| `frontend/src/features/inventory/components/StockMovementsPage.tsx` | Movement history with filters |
| `frontend/src/features/inventory/components/StockAdjustmentModal.tsx` | Adjust in/out modal |
| `frontend/src/features/inventory/components/StockTransferModal.tsx` | Transfer wizard |
| `frontend/src/features/inventory/components/LowStockPage.tsx` | Low stock dashboard |

### Phase 2: Stock Takes UI

#### Files to Create
| File | Purpose |
|------|---------|
| `frontend/src/features/inventory/components/StockTakesPage.tsx` | List/manage stock takes |
| `frontend/src/features/inventory/components/StockTakeForm.tsx` | Start/complete stock take |
| `frontend/src/features/inventory/components/StockTakeCountSheet.tsx` | Mobile-friendly counting interface |

### Phase 3: Purchase Orders UI

#### Files to Create
| File | Purpose |
|------|---------|
| `frontend/src/features/inventory/components/PurchaseOrdersPage.tsx` | PO list with status |
| `frontend/src/features/inventory/components/PurchaseOrderForm.tsx` | Create/edit PO |
| `frontend/src/features/inventory/components/PurchaseOrderReceiveModal.tsx` | Receive items |

### Phase 4: Integration

- Add "Stock" to sidebar navigation in `InventoryWorkspacePage.tsx`
- Add stock movement tab to Product detail view
- Real-time updates via existing WebSocket (`stock_level:updated` events)

---

## 4. Key Business Logic

### Stock Adjustment
```typescript
// Adjust IN: quantity > 0
// Adjust OUT: quantity < 0 (validated against available)
// Both create StockMovement + update StockLevel atomically
```

### Branch Transfer
```typescript
// 1. Initiate: Creates transfer record, reserves stock at source (StockLevel.reserved += qty)
// 2. Receive: Creates StockMovement (transfer_in) at destination, releases reservation at source
// 3. Both sides update StockLevel.quantity_on_hand
```

### Low Stock Alert
```typescript
// GET /stock/low-stock returns products where:
//   available = quantity_on_hand - reserved <= reorder_point
//   AND track_quantity = true
//   AND is_active = true
```

### Automated Reorder (Simple Threshold)
```typescript
// For each product/variant at/below reorder_point:
//   suggested_qty = max_stock_level ? (max_stock_level - available) : (reorder_point * 2)
//   Create draft PO with suggested_qty
//   Group by branch
```

### Stock Take Completion
```typescript
// For each item:
//   variance = counted - system_quantity
//   If variance != 0: create StockMovement (stock_take) with variance quantity
//   Update StockLevel.quantity_on_hand = counted
```

---

## 5. Caching & Real-time

### Cache Keys
- `stock_movements:${orgId}:${branchId}:${filterHash}` - 30s TTL
- `low_stock:${orgId}:${branchId}` - 60s TTL
- `stock_valuation:${orgId}:${branchId}` - 60s TTL
- `stock_takes:${orgId}` - 30s TTL
- `purchase_orders:${orgId}` - 30s TTL

### Invalidation
- Any stock movement → clear `stock_movements:*`, `low_stock:*`, `stock_valuation:*`, `products_list:*`
- Stock take complete → same + `stock_takes:*`
- PO receive → same + `purchase_orders:*`

### WebSocket Events
- `stock_level:updated` - payload: { branchId, productId, variantId, quantity_on_hand, available }
- `stock_movement:created` - payload: { movement }
- `low_stock:alert` - payload: { productId, branchId, currentStock, reorderPoint }
- `stock_take:completed` - payload: { stockTakeId, varianceCount }
- `purchase_order:received` - payload: { poId, itemsReceived }

---

## 6. Authorization

| Role | Stock Adjustments | Transfers | Stock Takes | Purchase Orders | Reorder Check |
|------|-------------------|-----------|-------------|-----------------|---------------|
| owner | ✅ | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| manager | ✅ | ✅ | ✅ | ✅ | ✅ |
| staff | ✅ (own branch) | ✅ (receive only) | ✅ (count only) | ❌ | ❌ |

---

## 7. Implementation Order

1. **Prisma Schema** - Add all new models, modify existing, run migration
2. **Stock Schemas** - Zod validation for all inputs
3. **StockService Core** - Movement recording, adjustments, transfers
4. **Stock Routes** - REST endpoints for adjustments, transfers, movements
5. **Stock Take Service & Routes** - Physical count workflow
6. **Purchase Order Service & Routes** - PO lifecycle
7. **Automated Reorder Logic** - Background check function
8. **Backend Tests** - Integration tests for all flows
9. **Frontend API Client** - `stock-api.ts`
10. **Frontend Components** - Pages and modals
11. **Sidebar Integration** - Add Stock navigation
12. **E2E Validation** - Full workflow testing

---

## 8. Validation Plan

```bash
# Backend
cd /home/kali/Documents/Orvio/backend
npx prisma generate
npx prisma migrate dev --name add_stock_management
npx tsc --noEmit
npm test

# Frontend
cd /home/kali/Documents/Orvio/frontend
npx tsc --noEmit
npm test
```

---

## 9. Edge Cases & Failure Modes

| Scenario | Handling |
|----------|----------|
| Negative available stock on adjust out | Block with 400, show available qty |
| Transfer with insufficient stock | Block at initiate, reserve on confirm |
| Concurrent stock movements | Row-level locking via Prisma transactions |
| PO receive partial | Allow, update PO status to partially_received |
| Stock take variance huge | Warn but allow, audit log captures |
| Reorder for product without supplier | Create draft PO with supplier_name = "TBD" |
| Deleted product with movements | Movements preserved (FK SetNull), product hidden |

---

## 10. Out of Scope (Future Phases)

- Supplier master data management
- Multi-level approval workflows for POs
- Demand forecasting / ML-based reorder points
- Barcode scanning mobile app for stock takes
- Inter-branch transfer routing optimization
- Costing methods (FIFO, LIFO, weighted average)
- Serialized/lot-tracked inventory (pharmacy/food)