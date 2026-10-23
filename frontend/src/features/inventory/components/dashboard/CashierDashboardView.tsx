import * as React from 'react';
import {
  ShoppingBag,
  CreditCard,
  Banknote,
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';

interface CashierDashboardViewProps {
  currencySymbol: string;
  cashierName: string;
  branchName: string;
  onNavigateToPos: () => void;
  onOpenPriceCheck: () => void;
}

export function CashierDashboardView({
  currencySymbol,
  cashierName,
  branchName,
  onNavigateToPos,
  onOpenPriceCheck,
}: CashierDashboardViewProps) {
  // Prototype Shift Telemetry (Simulated active shift state)
  const [shiftStartTime] = React.useState('08:30 AM');
  const [openingFloat] = React.useState(25000);
  const [cashCollected] = React.useState(62500);
  const [cardCollected] = React.useState(54000);
  const [transferCollected] = React.useState(26000);

  const totalShiftSales = cashCollected + cardCollected + transferCollected;
  const drawerBalance = openingFloat + cashCollected;
  const transactionCount = 38;
  const avgBasketSize = totalShiftSales / transactionCount;

  const recentShiftReceipts = [
    { id: 'RCP-8921', time: '4 mins ago', customer: 'Walk-in Customer', items: 3, payment: 'Cash', amount: 8400 },
    { id: 'RCP-8920', time: '12 mins ago', customer: 'Emeka Okafor', items: 5, payment: 'Card', amount: 19500 },
    { id: 'RCP-8919', time: '28 mins ago', customer: 'Zainab Bello', items: 1, payment: 'Transfer', amount: 4200 },
    { id: 'RCP-8918', time: '45 mins ago', customer: 'Walk-in Customer', items: 8, payment: 'Cash', amount: 24600 },
    { id: 'RCP-8917', time: '1 hr ago', customer: 'Tunde Adeyemi', items: 2, payment: 'Card', amount: 11500 },
    { id: 'RCP-8916', time: '1 hr ago', customer: 'Walk-in Customer', items: 4, payment: 'Cash', amount: 15800 },
  ];

  return (
    <div data-testid="cashier-dashboard-view" className="space-y-6 animate-fade-in">
      {/* SHIFT BANNER & STATUS */}
      <div className="bg-[#181a20] border border-[#2b2f3a] rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#985184]/15 border border-[#985184]/30 flex items-center justify-center shrink-0">
            <Receipt className="w-6 h-6 text-[#fbb945]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                POS Terminal & Shift Register
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Register Active</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
              <span>Cashier: <strong className="text-white">{cashierName}</strong></span>
              <span>•</span>
              <span>Terminal Branch: <strong className="text-white">{branchName}</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3 text-[#fbb945]" />
                <span>Started at {shiftStartTime} (Active 4h 22m)</span>
              </span>
            </p>
          </div>
        </div>

        {/* Quick Launch Register CTA */}
        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            onClick={onOpenPriceCheck}
            className="px-3.5 py-2 h-9 text-xs font-semibold bg-[#121418] hover:bg-white/5 border border-[#2b2f3a] text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Price Check (Ctrl+K)</span>
          </Button>

          <Button
            type="button"
            onClick={onNavigateToPos}
            className="px-4 py-2 h-9 text-xs font-bold bg-[#985184] hover:bg-[#854372] text-white rounded-lg shadow-md shadow-[#985184]/30 transition-all cursor-pointer flex items-center gap-2 active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-[#fbb945]" />
            <span>Open POS Register</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ROW 1: 4 SHIFT TELEMETRY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Shift Gross Sales */}
        <div className="bg-[#181a20] border border-[#2b2f3a] p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Shift Sales (Today)</span>
              <ShoppingBag className="w-4 h-4 text-[#fbb945]" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-white tracking-tight">
                {currencySymbol}{totalShiftSales.toLocaleString()}
              </span>
              <span className="text-[11px] font-bold text-emerald-400">
                {transactionCount} sales
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Avg ticket size: <strong className="text-slate-200">{currencySymbol}{avgBasketSize.toFixed(0)}</strong>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>Branch register #01</span>
            <span className="text-emerald-400">● 100% synced</span>
          </div>
        </div>

        {/* Card 2: Cash in Drawer */}
        <div className="bg-[#181a20] border border-[#2b2f3a] p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Cash in Register Drawer</span>
              <Banknote className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-emerald-400 tracking-tight">
                {currencySymbol}{drawerBalance.toLocaleString()}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Opening float: {currencySymbol}{openingFloat.toLocaleString()} + Cash: {currencySymbol}{cashCollected.toLocaleString()}
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 text-[10px] text-slate-500 font-mono flex items-center justify-between">
            <span>Float verified</span>
            <span className="text-slate-400">Count on shift close</span>
          </div>
        </div>

        {/* Card 3: Payment Split */}
        <div className="bg-[#181a20] border border-[#2b2f3a] p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Payment Breakdown</span>
              <CreditCard className="w-4 h-4 text-sky-400" />
            </div>

            <div className="space-y-2 mt-2.5">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Cash</span>
                  <span className="font-bold text-white">{currencySymbol}{cashCollected.toLocaleString()} (44%)</span>
                </div>
                <div className="w-full bg-[#121418] h-1.5 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: '44%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Card / POS</span>
                  <span className="font-bold text-white">{currencySymbol}{cardCollected.toLocaleString()} (38%)</span>
                </div>
                <div className="w-full bg-[#121418] h-1.5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#985184] rounded-full" style={{ width: '38%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Bank Transfer</span>
                  <span className="font-bold text-white">{currencySymbol}{transferCollected.toLocaleString()} (18%)</span>
                </div>
                <div className="w-full bg-[#121418] h-1.5 rounded-full overflow-hidden">
                  <div className="h-full bg-[#fbb945] rounded-full" style={{ width: '18%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Register Accuracy & Speed */}
        <div className="bg-[#181a20] border border-[#2b2f3a] p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Shift Accuracy & Audits</span>
              <ShieldCheck className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-white tracking-tight">100%</span>
              <span className="text-[11px] font-bold text-emerald-400">Zero Voids</span>
            </div>
            <div className="space-y-1 text-xs text-slate-400 mt-2">
              <div className="flex justify-between">
                <span>Items Scanned:</span>
                <span className="font-mono font-bold text-white">142</span>
              </div>
              <div className="flex justify-between">
                <span>Discounts Issued:</span>
                <span className="font-mono font-bold text-white">₦0</span>
              </div>
              <div className="flex justify-between">
                <span>Refunds Handled:</span>
                <span className="font-mono font-bold text-white">0</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Audit trail in balance</span>
          </div>
        </div>
      </div>

      {/* ROW 2: SHIFT ACTIONS & RECENT RECEIPT LOG */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quick Cashier Tools (1/3) */}
        <div className="bg-[#181a20] border border-[#2b2f3a] p-5 rounded-xl space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Register Shortcuts</h3>
            <p className="text-xs text-slate-400 mt-0.5">Quick actions for active cashier shift</p>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onNavigateToPos}
              className="w-full p-3 rounded-lg bg-gradient-to-r from-[#985184]/20 to-[#fbb945]/15 border border-[#985184]/30 hover:border-[#fbb945]/50 text-left transition-all group cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#985184] text-white flex items-center justify-center font-bold">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-[#fbb945] transition-colors">
                    New Sale / Checkout
                  </div>
                  <div className="text-[11px] text-slate-400">Launch POS scanning terminal</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              type="button"
              onClick={onOpenPriceCheck}
              className="w-full p-3 rounded-lg bg-[#121418] hover:bg-white/5 border border-[#2b2f3a] text-left transition-all group cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/5 text-[#fbb945] flex items-center justify-center font-bold">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-[#fbb945] transition-colors">
                    Check Product Price & Stock
                  </div>
                  <div className="text-[11px] text-slate-400">Instant SKU lookup palette</div>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
            </button>

            <div className="p-3 rounded-lg bg-[#121418] border border-[#2b2f3a] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <Lock className="w-4 h-4 text-slate-500" />
                <span>End-of-Shift Reconciliation</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Available at shift end</span>
            </div>
          </div>
        </div>

        {/* Live Receipts Stream (2/3) */}
        <div className="lg:col-span-2 bg-[#181a20] border border-[#2b2f3a] p-5 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Today's Shift Receipts</h3>
              <p className="text-xs text-slate-400 mt-0.5">Live store transactions recorded on this terminal</p>
            </div>
            <span className="text-xs font-mono text-[#fbb945] font-semibold bg-[#fbb945]/10 px-2.5 py-1 rounded border border-[#fbb945]/20">
              {recentShiftReceipts.length} Recorded
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 text-[11px] font-mono border-b border-white/5">
                  <th className="pb-2.5 font-medium">Receipt #</th>
                  <th className="pb-2.5 font-medium">Customer</th>
                  <th className="pb-2.5 font-medium">Items</th>
                  <th className="pb-2.5 font-medium">Payment</th>
                  <th className="pb-2.5 font-medium text-right">Amount</th>
                  <th className="pb-2.5 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentShiftReceipts.map((rcp) => (
                  <tr key={rcp.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 font-mono font-bold text-white">{rcp.id}</td>
                    <td className="py-2.5 text-slate-300">{rcp.customer}</td>
                    <td className="py-2.5 text-slate-400 font-mono">{rcp.items} items</td>
                    <td className="py-2.5">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                          rcp.payment === 'Cash'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : rcp.payment === 'Card'
                            ? 'bg-[#985184]/15 text-purple-300 border border-[#985184]/30'
                            : 'bg-[#fbb945]/15 text-[#fbb945] border border-[#fbb945]/30'
                        }`}
                      >
                        {rcp.payment}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono font-bold text-white text-right">
                      {currencySymbol}{rcp.amount.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-slate-500 text-right font-mono">{rcp.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
