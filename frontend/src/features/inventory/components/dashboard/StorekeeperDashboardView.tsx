import * as React from 'react';
import {
  Boxes,
  AlertTriangle,
  XCircle,
  Package,
  Truck,
  FileCheck,
  ArrowRight,
  Plus,
  SlidersHorizontal,
  RefreshCw,
  QrCode,
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';

export interface StorekeeperProductItem {
  id: string;
  name: string;
  sku?: string | null;
  stock: number;
  minStock?: number | null;
  category?: { name: string } | string | null;
  price?: number;
}

interface StorekeeperDashboardViewProps {
  currencySymbol: string;
  branchName: string;
  products: StorekeeperProductItem[];
  isLoading?: boolean;
  onOpenAdjustStock?: (product?: StorekeeperProductItem) => void;
  onOpenReceiveStock?: () => void;
  onOpenNewProduct?: () => void;
  onOpenCatalogSearch?: () => void;
}

export function StorekeeperDashboardView({
  currencySymbol,
  branchName,
  products,
  isLoading = false,
  onOpenAdjustStock,
  onOpenReceiveStock,
  onOpenNewProduct,
  onOpenCatalogSearch,
}: StorekeeperDashboardViewProps) {
  // Live computations from branch catalog products
  const totalSkus = products.length;
  const outOfStockProducts = React.useMemo(() => {
    return products.filter((p) => p.stock === 0);
  }, [products]);

  const lowStockProducts = React.useMemo(() => {
    return products.filter((p) => {
      const threshold = p.minStock !== null && p.minStock !== undefined ? p.minStock : 5;
      return p.stock > 0 && p.stock <= threshold;
    });
  }, [products]);

  const totalUnits = React.useMemo(() => {
    return products.reduce((acc, p) => acc + (p.stock || 0), 0);
  }, [products]);

  // Combined urgent priority list: Out of stock first, then low stock
  const urgentRestockList = React.useMemo(() => {
    return [...outOfStockProducts, ...lowStockProducts].slice(0, 8);
  }, [outOfStockProducts, lowStockProducts]);

  return (
    <div data-testid="storekeeper-dashboard-view" className="space-y-6 animate-fade-in">
      {/* WAREHOUSE HEADER & LOGISTICS STATUS */}
      <div className="bg-[#181a20] border border-[#2b2f3a] rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Boxes className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Warehouse & Stock Operations
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Live Stock Telemetry</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Location: <strong className="text-white">{branchName}</strong> • Inventory levels synchronizing in real time
            </p>
          </div>
        </div>

        {/* Quick Stock Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            onClick={() => onOpenAdjustStock?.()}
            className="px-3.5 py-2 h-9 text-xs font-semibold bg-[#121418] hover:bg-white/5 border border-[#2b2f3a] text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Count / Adjust Stock</span>
          </Button>

          <Button
            type="button"
            onClick={onOpenReceiveStock}
            className="px-4 py-2 h-9 text-xs font-bold bg-[#985184] hover:bg-[#854372] text-white rounded-lg shadow-md shadow-[#985184]/30 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
          >
            <Truck className="w-4 h-4 text-[#fbb945]" />
            <span>Receive Inbound Stock</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ROW 1: 4 LIVE STOCK TELEMETRY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total SKUs */}
        <div className="bg-[#181a20] border border-[#2b2f3a] p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Catalog SKUs</span>
              <Package className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-white tracking-tight">
                {isLoading ? '...' : totalSkus}
              </span>
              <span className="text-[11px] font-bold text-slate-400">active products</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Total units on hand: <strong className="text-white">{totalUnits.toLocaleString()}</strong>
            </div>
          </div>
          <div className="pt-3 border-t border-white/5 text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>Branch Inventory</span>
            <span className="text-emerald-400">● Live Catalog</span>
          </div>
        </div>

        {/* Card 2: Low Stock Alerts */}
        <div className="bg-[#181a20] border border-[#2b2f3a] p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Low Stock Alerts</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-amber-400 tracking-tight">
                {isLoading ? '...' : lowStockProducts.length}
              </span>
              <span className="text-[11px] font-bold text-amber-300">at re-order level</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Below configured min stock threshold
            </div>
          </div>
          <div className="pt-3 border-t border-white/5 text-[10px] text-amber-400 font-mono flex items-center justify-between">
            <span>Restock suggested</span>
            <span>Needs replenishment</span>
          </div>
        </div>

        {/* Card 3: Out of Stock SKUs */}
        <div className="bg-[#181a20] border border-[#2b2f3a] p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Out of Stock (Zero Units)</span>
              <XCircle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-rose-400 tracking-tight">
                {isLoading ? '...' : outOfStockProducts.length}
              </span>
              <span className="text-[11px] font-bold text-rose-300">items depleted</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Zero stock available for POS checkout
            </div>
          </div>
          <div className="pt-3 border-t border-white/5 text-[10px] text-rose-400 font-mono flex items-center justify-between">
            <span>Urgent PO required</span>
            <span>Cannot sell</span>
          </div>
        </div>

        {/* Card 4: Logistics Pending Intake */}
        <div className="bg-[#181a20] border border-[#2b2f3a] p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Pending Inbound Shipments</span>
              <FileCheck className="w-4 h-4 text-sky-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-sky-400 tracking-tight">2</span>
              <span className="text-[11px] font-bold text-sky-300">Transfers in transit</span>
            </div>
            <div className="space-y-0.5 text-[11px] text-slate-400 mt-1">
              <div className="flex justify-between">
                <span>1 Goods Received Note (GRN)</span>
                <span className="text-slate-300 font-mono">Pending</span>
              </div>
            </div>
          </div>
          <div className="pt-3 border-t border-white/5 text-[10px] text-sky-400 font-mono flex items-center justify-between">
            <span>Dock awaiting inspection</span>
            <span>Verify & Receive</span>
          </div>
        </div>
      </div>

      {/* ROW 2: PRIORITY RESTOCK LIST & LOGISTICS ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Urgent Restock Priority Table (2/3) */}
        <div className="lg:col-span-2 bg-[#181a20] border border-[#2b2f3a] p-5 sm:p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Urgent Stock Replenishment</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Items currently at or below minimum branch reorder thresholds
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                {urgentRestockList.length} Items
              </span>
            </div>
          </div>

          {urgentRestockList.length === 0 ? (
            <div className="p-8 text-center bg-[#121418] border border-[#2b2f3a] rounded-lg">
              <Package className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-white">All Stock Levels Healthy</div>
              <p className="text-[11px] text-slate-400 mt-1">
                No items are currently depleted or below reorder threshold in {branchName}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 text-[11px] font-mono border-b border-white/5">
                    <th className="pb-2.5 font-medium">Product Item</th>
                    <th className="pb-2.5 font-medium">SKU</th>
                    <th className="pb-2.5 font-medium">Category</th>
                    <th className="pb-2.5 font-medium text-center">Current Stock</th>
                    <th className="pb-2.5 font-medium text-center">Min Level</th>
                    <th className="pb-2.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {urgentRestockList.map((prod) => {
                    const isZero = prod.stock === 0;
                    const catName = typeof prod.category === 'object' && prod.category
                      ? prod.category.name
                      : typeof prod.category === 'string'
                      ? prod.category
                      : 'General';

                    return (
                      <tr key={prod.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                isZero ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'
                              }`}
                            />
                            <span className="truncate max-w-[180px]">{prod.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 font-mono text-slate-400">{prod.sku || '—'}</td>
                        <td className="py-2.5 text-slate-300">{catName}</td>
                        <td className="py-2.5 text-center font-mono">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              isZero
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {prod.stock} units
                          </span>
                        </td>
                        <td className="py-2.5 text-center font-mono text-slate-400">
                          {prod.minStock ?? 5} units
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => onOpenAdjustStock?.(prod)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-[#fbb945] hover:text-white bg-[#fbb945]/10 hover:bg-[#fbb945]/20 rounded transition-colors"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Warehouse Quick Tools (1/3) */}
        <div className="bg-[#181a20] border border-[#2b2f3a] p-5 sm:p-6 rounded-xl space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Warehouse Logistics Tools</h3>
            <p className="text-xs text-slate-400 mt-0.5">Quick actions for stock control</p>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => onOpenAdjustStock?.()}
              className="w-full p-3 rounded-lg bg-[#121418] hover:bg-white/5 border border-[#2b2f3a] text-left transition-all group cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                    Stock Audit & Adjustment
                  </div>
                  <div className="text-[11px] text-slate-400">Record reasoned damage / counted variances</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-all" />
            </button>

            <button
              type="button"
              onClick={onOpenReceiveStock}
              className="w-full p-3 rounded-lg bg-[#121418] hover:bg-white/5 border border-[#2b2f3a] text-left transition-all group cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-sky-400 transition-colors">
                    Inbound Transfer Receipts
                  </div>
                  <div className="text-[11px] text-slate-400">Accept stock transfers between branch locations</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-all" />
            </button>

            <button
              type="button"
              onClick={onOpenCatalogSearch}
              className="w-full p-3 rounded-lg bg-[#121418] hover:bg-white/5 border border-[#2b2f3a] text-left transition-all group cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">
                    Barcode & SKU Search
                  </div>
                  <div className="text-[11px] text-slate-400">Scan or search product shelf locations</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-all" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
