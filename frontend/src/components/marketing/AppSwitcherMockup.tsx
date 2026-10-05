import * as React from 'react';
import {
  Boxes,
  Dumbbell,
  ReceiptText,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  QrCode,
  Users,
  Search,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { formatNaira } from '../../lib/utils';

export function AppSwitcherMockup() {
  const [activeApp, setActiveApp] = React.useState<'inventory' | 'pos' | 'gym'>('inventory');

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl border border-slate-700/60 bg-slate-900 p-2 sm:p-4 shadow-2xl shadow-indigo-950/50 text-slate-100 overflow-hidden">
      {/* Top OS Window Bar with App Switcher */}
      <div className="flex flex-col sm:flex-row items-center justify-between pb-3 px-3 border-b border-slate-800 gap-3">
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-rose-500/80" />
            <div className="h-3 w-3 rounded-full bg-amber-500/80" />
            <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="ml-3 hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 text-xs text-slate-400 font-mono">
            <Building2 className="h-3.5 w-3.5 text-indigo-400" />
            <span>apex-retail.orvio.com</span>
          </div>
        </div>

        {/* The Live Interactive App Switcher */}
        <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700 w-full sm:w-auto justify-center">
          <button
            type="button"
            onClick={() => setActiveApp('inventory')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeApp === 'inventory'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Boxes className="h-3.5 w-3.5" />
            <span>Inventory</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveApp('pos')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeApp === 'pos'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <ReceiptText className="h-3.5 w-3.5" />
            <span>POS Checkout</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveApp('gym')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeApp === 'gym'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Dumbbell className="h-3.5 w-3.5" />
            <span>Gym Hub</span>
          </button>
        </div>
      </div>

      {/* App Workspace Simulation Canvas */}
      <div className="p-4 sm:p-6 bg-slate-950/80 rounded-2xl mt-3 min-h-[380px] border border-slate-800/70">
        {/* VIEW 1: INVENTORY DASHBOARD */}
        {activeApp === 'inventory' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-bold text-white">Ikeja Branch Stock Overview</h4>
                  <Badge variant="emerald" className="text-[10px]">
                    Live Synced
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">Total catalog: 4,820 SKUs across 2 warehouses</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Quick search SKU / barcode..."
                    className="bg-slate-900 border border-slate-700 text-xs rounded-lg pl-8 pr-3 py-1.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 w-44 sm:w-56"
                    readOnly
                    value="Paracetamol 500mg Batch 88"
                  />
                </div>
                <Button size="sm" variant="primary" className="h-8 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Receive Stock</span>
                </Button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">Today's Sales (Lagos)</span>
                <div className="text-lg font-bold text-white mt-1">{formatNaira(842500)}</div>
                <div className="flex items-center text-[10px] text-emerald-400 mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" /> +14.2% vs yesterday
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">Low Stock Warnings</span>
                <div className="text-lg font-bold text-amber-400 mt-1">6 Items</div>
                <div className="text-[10px] text-slate-400 mt-1">Auto-reorder draft ready</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">Near Expiry (45 Days)</span>
                <div className="text-lg font-bold text-rose-400 mt-1">2 Batches</div>
                <div className="text-[10px] text-rose-300 mt-1">Flash discount triggered</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">Warehouse Valuation</span>
                <div className="text-lg font-bold text-indigo-400 mt-1">{formatNaira(24850000)}</div>
                <div className="text-[10px] text-slate-400 mt-1">FIFO verified</div>
              </div>
            </div>

            {/* Stock List Table Mockup */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden text-xs">
              <div className="grid grid-cols-12 bg-slate-800/80 p-2.5 font-semibold text-slate-300">
                <div className="col-span-4">Product / SKU</div>
                <div className="col-span-2">Category</div>
                <div className="col-span-2">In Stock</div>
                <div className="col-span-2">Unit Price</div>
                <div className="col-span-2 text-right">Status</div>
              </div>
              <div className="divide-y divide-slate-800">
                <div className="grid grid-cols-12 p-2.5 items-center">
                  <div className="col-span-4 font-medium text-white">Emzor Paracetamol 500mg (Pack 100)</div>
                  <div className="col-span-2 text-slate-400">Pharmaceutical</div>
                  <div className="col-span-2 text-emerald-400 font-semibold">1,240 pk</div>
                  <div className="col-span-2 text-slate-300">{formatNaira(1850)}</div>
                  <div className="col-span-2 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] font-medium border border-emerald-800">
                      Optimal
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-12 p-2.5 items-center">
                  <div className="col-span-4 font-medium text-white">Peak Full Cream Milk Powder 400g</div>
                  <div className="col-span-2 text-slate-400">Groceries</div>
                  <div className="col-span-2 text-amber-400 font-semibold">18 units</div>
                  <div className="col-span-2 text-slate-300">{formatNaira(4200)}</div>
                  <div className="col-span-2 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 text-[10px] font-medium border border-amber-800">
                      Low Stock (Reorder)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: POS CHECKOUT SCREEN */}
        {activeApp === 'pos' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold text-white">Cashier Desk 01 — Fast Checkout</h4>
                <p className="text-xs text-slate-400">Cashier: Blessing N. | Offline Sync: Ready</p>
              </div>
              <Badge variant="glow" className="text-[11px] bg-indigo-900/60 text-indigo-300">
                Barcode Scanner Connected
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Cart Items */}
              <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/90 p-3 space-y-2">
                <div className="text-xs font-semibold text-slate-400 pb-1 border-b border-slate-800 flex justify-between">
                  <span>Current Cart (3 items)</span>
                  <span className="text-indigo-400 font-mono">Invoice #ORV-9824</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60">
                    <div>
                      <span className="font-semibold text-white block">Golden Penny Sugar 500g</span>
                      <span className="text-slate-400 text-[11px]">Qty: 2 × {formatNaira(1200)}</span>
                    </div>
                    <span className="font-bold text-white">{formatNaira(2400)}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60">
                    <div>
                      <span className="font-semibold text-white block">Ariel Detergent 1kg Super Pack</span>
                      <span className="text-slate-400 text-[11px]">Qty: 1 × {formatNaira(3800)}</span>
                    </div>
                    <span className="font-bold text-white">{formatNaira(3800)}</span>
                  </div>
                </div>
              </div>

              {/* Total & Instant Paystack / WhatsApp Box */}
              <div className="lg:col-span-5 rounded-xl border border-indigo-900/50 bg-gradient-to-b from-indigo-950/40 to-slate-900 p-4 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Subtotal Due</span>
                  <div className="text-2xl font-black text-white mt-1">{formatNaira(6200)}</div>
                  <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span>VAT (7.5%):</span>
                      <span>{formatNaira(465)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-white pt-1 border-t border-slate-700">
                      <span>Total Payable:</span>
                      <span className="text-emerald-400">{formatNaira(6665)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                  <Button variant="emerald" className="w-full text-xs font-bold h-9">
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Paystack / Card POS (₦6,665)</span>
                  </Button>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>WhatsApp E-Receipt will be auto-dispatched</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: GYM MANAGEMENT DASHBOARD */}
        {activeApp === 'gym' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold text-white">Lekki Studio — Member Turnstile & Pass Hub</h4>
                <p className="text-xs text-slate-400">Active monthly members: 420 | Today check-ins: 114</p>
              </div>
              <Badge variant="emerald" className="text-[11px]">
                Gate Access: Online
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Active VIP Subscriptions</span>
                  <Users className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="text-xl font-bold text-white mt-1">318 Members</div>
                <span className="text-[10px] text-emerald-400">Paystack recurring enabled</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Upcoming Renewals (3 Days)</span>
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                </div>
                <div className="text-xl font-bold text-amber-400 mt-1">24 Members</div>
                <span className="text-[10px] text-slate-400">WhatsApp renewal queued</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Next Class: HIIT & Spin</span>
                  <QrCode className="h-4 w-4 text-sky-400" />
                </div>
                <div className="text-xl font-bold text-sky-400 mt-1">18 / 20 Booked</div>
                <span className="text-[10px] text-slate-400">Coach: Tunde (5:30 PM)</span>
              </div>
            </div>

            {/* Live Check-in Feed */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
              <div className="text-xs font-semibold text-slate-400 mb-2">Live Turnstile Check-In Stream</div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      EA
                    </div>
                    <div>
                      <span className="font-semibold text-white">Emeka Adeleke</span>
                      <span className="text-slate-400 text-[10px] block">Platinum Pass • Valid till Nov 2026</span>
                    </div>
                  </div>
                  <span className="text-emerald-400 font-medium text-[11px]">Checked in 1m ago (Gate 1)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Subdomain & Value Bar */}
      <div className="mt-3 px-3 py-2 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-400" />
          <span>One single login & unified billing across all apps.</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400">Try switching tabs above to explore different apps ↑</span>
        </div>
      </div>
    </div>
  );
}
