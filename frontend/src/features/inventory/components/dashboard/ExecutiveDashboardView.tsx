import * as React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  ShoppingBag,
  SlidersHorizontal,
  Package,
  MoreVertical,
  Plus,
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';

interface ExecutiveDashboardViewProps {
  currencySymbol: string;
  categoriesData: Array<{ name: string; color: string }>;
  dailyOrdersData: Array<{ day: string; income: number; profit: number }>;
  demographicData: Array<{ range: string; percent: number }>;
  productSales: Array<{
    id: string;
    name: string;
    imgBg: string;
    stock: number;
    oldPrice: number;
    sale: string;
    newPrice: number;
    itemsSold: number;
  }>;
  recentOrders: Array<{
    id: string;
    customer: string;
    amount: number;
    status: string;
    statusColor: string;
    time: string;
  }>;
  onOpenNewProduct: () => void;
  onOpenProductDetail: (productName: string) => void;
  onOpenOrderDetail: (orderId: string) => void;
}

export function ExecutiveDashboardView({
  currencySymbol,
  categoriesData,
  dailyOrdersData,
  demographicData,
  productSales,
  recentOrders,
  onOpenNewProduct,
  onOpenProductDetail,
  onOpenOrderDetail,
}: ExecutiveDashboardViewProps) {
  const [hoveredBarIndex, setHoveredBarIndex] = React.useState<number | null>(null);
  const [categoryTimeRange, setCategoryTimeRange] = React.useState<'All time' | 'Weekly' | 'Monthly'>('Weekly');
  const [demographicTimeRange, setDemographicTimeRange] = React.useState<'All time' | 'Weekly' | 'Monthly'>('Weekly');

  return (
    <div data-testid="executive-dashboard-view" className="space-y-6 animate-fade-in">
      {/* ROW 1: TOP 4 METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Recent Orders */}
        <div className="bg-[#181a20] p-5 rounded-sm flex flex-col justify-between border border-[#2b2f3a]/60 shadow-sm">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Recent Orders</span>
              <TrendingUp className="w-4 h-4 text-[#fbb945]" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-white tracking-tight">
                {currencySymbol}18,745
              </span>
              <span className="text-[11px] font-bold text-[#fbb945] flex items-center">
                <TrendingDown className="w-3 h-3 mr-0.5" /> 8.4%
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {currencySymbol}20,461 last month
            </div>
          </div>

          {/* SVG Sparkline */}
          <div className="relative pt-6 pb-1">
            <div className="absolute top-0 right-14 bg-[#23262f] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm shadow-sm flex items-center gap-1">
              <span>{currencySymbol}2,104</span>
            </div>
            <svg className="w-full h-12 overflow-visible" viewBox="0 0 200 40">
              <path
                d="M 0 32 Q 35 15, 60 25 T 110 18 T 150 10 T 200 28"
                fill="none"
                stroke="#fbb945"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="150" cy="10" r="4" fill="#fbb945" />
            </svg>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>1 May</span>
              <span>8 May</span>
              <span>15 May</span>
              <span>22 May</span>
              <span>29 May</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Customers & Distribution */}
        <div className="bg-[#181a20] p-5 rounded-sm flex flex-col justify-between border border-[#2b2f3a]/60 shadow-sm">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Total Customers</span>
              <Users className="w-4 h-4 text-[#fbb945]" />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <div className="text-[10px] text-slate-400">Current Customers</div>
                <div className="text-xl font-extrabold text-white">2,847</div>
                <div className="text-[10px] text-[#fbb945] font-semibold">↗ 12.6% vs last mo</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">New Customers</div>
                <div className="text-xl font-extrabold text-white">742</div>
                <div className="text-[10px] text-[#fbb945] font-semibold">↗ 16.3% vs Apr</div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 space-y-2">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
              Sales Channel Distribution
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/5 p-2 rounded-sm">
                <div className="font-bold text-white">58%</div>
                <div className="text-[10px] text-slate-400">Walk-in / POS</div>
                <div className="text-[10px] text-[#fbb945] font-mono">1,652 · ↗ 9.8%</div>
              </div>
              <div className="bg-white/5 p-2 rounded-sm">
                <div className="font-bold text-white">42%</div>
                <div className="text-[10px] text-slate-400">Online Store</div>
                <div className="text-[10px] text-[#fbb945] font-mono">1,195 · ↗ 15.7%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Total Revenue */}
        <div className="bg-[#181a20] p-5 rounded-sm flex flex-col justify-between border border-[#2b2f3a]/60 shadow-sm">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Total Revenue</span>
              <ShoppingBag className="w-4 h-4 text-[#fbb945]" />
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-white tracking-tight">
                {currencySymbol}124,680
              </span>
              <span className="text-[11px] font-bold text-emerald-400">↗ 22.7%</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {currencySymbol}101,630 last month
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">
              Revenue over the last 7 days
            </div>
          </div>

          {/* Paired Bar Chart */}
          <div className="pt-4">
            <div className="flex items-end justify-between h-20 gap-1.5 px-1">
              {[
                { day: 'Mon', thisWeek: 50, lastWeek: 35 },
                { day: 'Tue', thisWeek: 65, lastWeek: 45 },
                { day: 'Wed', thisWeek: 55, lastWeek: 40 },
                { day: 'Thu', thisWeek: 85, lastWeek: 55 },
                { day: 'Fri', thisWeek: 95, lastWeek: 70 },
                { day: 'Sat', thisWeek: 75, lastWeek: 60 },
                { day: 'Sun', thisWeek: 60, lastWeek: 50 },
              ].map((col, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div className="w-full flex items-end justify-center gap-0.5 h-16">
                    <div
                      style={{ height: `${col.thisWeek}%` }}
                      className="w-1.5 sm:w-2 bg-[#985184] rounded-sm"
                    />
                    <div
                      style={{ height: `${col.lastWeek}%` }}
                      className="w-1.5 sm:w-2 bg-[#fbb945] rounded-sm"
                    />
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono">{col.day}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400 mt-2 font-mono">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#985184]" />
                <span>This week</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#fbb945]" />
                <span>Last week</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Top Categories (Donut) */}
        <div className="bg-[#181a20] p-5 rounded-sm flex flex-col justify-between border border-[#2b2f3a]/60 shadow-sm">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Top Categories</span>
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
            </div>

            <div className="flex items-center justify-center py-4">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" fill="transparent" stroke="#4a4e5a" strokeWidth="4" />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="transparent"
                    stroke="#985184"
                    strokeWidth="4"
                    strokeDasharray="22 100"
                    strokeDashoffset="0"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="transparent"
                    stroke="#fbb945"
                    strokeWidth="4"
                    strokeDasharray="30 100"
                    strokeDashoffset="-22"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="transparent"
                    stroke="#d48834"
                    strokeWidth="4"
                    strokeDasharray="18 100"
                    strokeDashoffset="-52"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="transparent"
                    stroke="#854372"
                    strokeWidth="4"
                    strokeDasharray="15 100"
                    strokeDashoffset="-70"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-black text-white">100%</span>
                  <span className="text-[9px] text-slate-400 font-mono">Stocked</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-400 pt-1">
              {categoriesData.map((cat, i) => (
                <div key={i} className="flex items-center gap-1 truncate">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="truncate">{cat.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-1 bg-[#141519] p-1 rounded-sm mt-3">
            {(['All time', 'Weekly', 'Monthly'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setCategoryTimeRange(range)}
                className={`flex-1 py-1 text-[10px] font-semibold rounded-sm transition-all cursor-pointer ${
                  categoryTimeRange === range
                    ? 'bg-[#985184] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 2: TOTAL ORDERS BAR CHART & CUSTOMER DEMOGRAPHICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="lg:col-span-2 bg-[#181a20] p-5 sm:p-6 rounded-sm flex flex-col justify-between border border-[#2b2f3a]/60 shadow-sm">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Total Orders</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Daily order revenue & profit analysis
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#fbb945]" />
                <span className="text-slate-300">Income</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#985184]" />
                <span className="text-slate-300">Profit</span>
              </div>
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
            </div>
          </div>

          <div className="relative pt-6 pb-2">
            {hoveredBarIndex !== null && (
              <div
                className="absolute top-0 z-20 bg-[#23262f] text-white p-2.5 rounded-sm shadow-xl text-xs space-y-1 font-mono pointer-events-none transition-all duration-150"
                style={{
                  left: `${Math.min(Math.max((hoveredBarIndex / dailyOrdersData.length) * 100, 10), 80)}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="font-bold text-white">{dailyOrdersData[hoveredBarIndex].day}</div>
                <div className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
                  <span className="flex items-center gap-1 text-[#fbb945]">● Income</span>
                  <span>{currencySymbol}{dailyOrdersData[hoveredBarIndex].income.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
                  <span className="flex items-center gap-1 text-[#985184]">● Profit</span>
                  <span>{currencySymbol}{dailyOrdersData[hoveredBarIndex].profit.toLocaleString()}</span>
                </div>
                <div className="border-t border-white/10 pt-1 flex items-center justify-between gap-3 text-[11px] font-bold text-white">
                  <span>● Total</span>
                  <span>
                    {currencySymbol}
                    {(
                      dailyOrdersData[hoveredBarIndex].income +
                      dailyOrdersData[hoveredBarIndex].profit
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <div className="h-44 flex items-end justify-between gap-1 sm:gap-2 px-1">
              {dailyOrdersData.map((item, idx) => {
                const maxVal = 9000;
                const incomeH = (item.income / maxVal) * 100;
                const profitH = (item.profit / maxVal) * 100;
                const isHovered = hoveredBarIndex === idx;

                return (
                  <div
                    key={idx}
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    className="flex-1 flex flex-col items-center gap-1 h-full justify-end cursor-pointer group"
                  >
                    <div className="w-full flex flex-col items-center justify-end h-full">
                      <div
                        style={{ height: `${profitH}%` }}
                        className={`w-full max-w-[18px] bg-[#985184] rounded-t-sm transition-all ${
                          isHovered ? 'brightness-125' : ''
                        }`}
                      />
                      <div
                        style={{ height: `${incomeH}%` }}
                        className={`w-full max-w-[18px] bg-[#fbb945] rounded-b-sm transition-all ${
                          isHovered ? 'brightness-125' : ''
                        }`}
                      />
                    </div>
                    <span
                      className={`text-[9px] font-mono truncate ${
                        isHovered ? 'text-white font-bold' : 'text-slate-500'
                      }`}
                    >
                      {item.day.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Customer Demographic */}
        <div className="bg-[#181a20] p-5 sm:p-6 rounded-sm flex flex-col justify-between border border-[#2b2f3a]/60 shadow-sm">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                Customer Demographic
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Purchaser age distribution</p>
            </div>
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
          </div>

          <div className="space-y-4 py-2">
            {demographicData.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-300">{item.range}</span>
                  <span className="font-bold text-white">{item.percent}%</span>
                </div>
                <div className="w-full bg-[#141519] h-2.5 rounded-sm overflow-hidden">
                  <div
                    style={{ width: `${item.percent * 2.5}%` }}
                    className="h-full bg-[#fbb945] rounded-sm transition-all duration-300"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-1 bg-[#141519] p-1 rounded-sm mt-4">
            {(['All time', 'Weekly', 'Monthly'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDemographicTimeRange(range)}
                className={`flex-1 py-1 text-[10px] font-semibold rounded-sm transition-all cursor-pointer ${
                  demographicTimeRange === range
                    ? 'bg-[#985184] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ROW 3: PRODUCT SALES TABLE & RECENT ORDERS FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        <div className="lg:col-span-2 bg-[#181a20] p-5 sm:p-6 rounded-sm space-y-4 overflow-hidden border border-[#2b2f3a]/60 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Product Sales</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Top moving stock items & pricing
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={onOpenNewProduct}
                className="bg-[#985184] hover:bg-[#854372] text-white text-xs font-semibold h-7 px-3 rounded-sm shadow-sm flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Product</span>
              </Button>
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 text-[11px] font-mono border-b border-white/5">
                  <th className="pb-3 font-medium">Item</th>
                  <th className="pb-3 font-medium">Stock</th>
                  <th className="pb-3 font-medium">Old Price</th>
                  <th className="pb-3 font-medium">Sale</th>
                  <th className="pb-3 font-medium">New Price</th>
                  <th className="pb-3 font-medium text-right">Items Sold</th>
                  <th className="pb-3 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {productSales.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                    onClick={() => onOpenProductDetail(product.name)}
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-sm ${product.imgBg} flex items-center justify-center text-slate-300 shrink-0 font-bold text-xs`}
                        >
                          <Package className="w-4 h-4 text-[#fbb945]" />
                        </div>
                        <span className="font-semibold text-white group-hover:text-[#fbb945] transition-colors truncate max-w-[160px]">
                          {product.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 font-mono text-slate-300">{product.stock}</td>
                    <td className="py-3 font-mono text-slate-400 line-through">
                      {currencySymbol}{product.oldPrice.toFixed(2)}
                    </td>
                    <td className="py-3 font-mono text-emerald-400 font-bold">{product.sale}</td>
                    <td className="py-3 font-mono font-bold text-white">
                      {currencySymbol}{product.newPrice.toFixed(2)}
                    </td>
                    <td className="py-3 font-mono text-slate-200 text-right">{product.itemsSold}</td>
                    <td className="py-3 text-right">
                      <MoreVertical className="w-3.5 h-3.5 text-slate-500 hover:text-white" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Orders Feed */}
        <div className="bg-[#181a20] p-5 sm:p-6 rounded-sm space-y-4 border border-[#2b2f3a]/60 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Recent Orders</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Live store register transactions</p>
            </div>
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
          </div>

          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => onOpenOrderDetail(order.id)}
                className="p-3 rounded-sm bg-[#141519] hover:bg-white/5 transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-sm bg-white/5 flex items-center justify-center text-[#fbb945]">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-[#fbb945] transition-colors">
                      {order.id}
                    </div>
                    <div className="text-[10px] text-slate-400">{order.customer}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-white font-mono">
                    {currencySymbol}{order.amount.toFixed(2)}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <span
                      className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-sm ${order.statusColor}`}
                    >
                      ● {order.status}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{order.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
